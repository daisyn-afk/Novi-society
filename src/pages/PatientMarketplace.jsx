import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, MapPin, Award, Calendar, DollarSign, Clock, MessageSquare, Info, Sparkles, Filter, Gift, Package, Tag } from "lucide-react";
import MessageThread from "@/components/messaging/MessageThread";

export default function PatientMarketplace() {
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [bookDialog, setBookDialog] = useState(null);
  const [bookForm, setBookForm] = useState({ service: "", appointment_date: "", appointment_time: "", patient_notes: "" });
  const [booked, setBooked] = useState(false);
  const [msgDialog, setMsgDialog] = useState(null);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchDialog, setAiMatchDialog] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["certifications"],
    queryFn: () => base44.entities.Certification.filter({ status: "active" }),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => base44.entities.Review.filter({ is_verified: true }),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["all-licenses"],
    queryFn: () => base44.entities.License.filter({ status: "verified" }),
  });

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["all-md-subs"],
    queryFn: () => base44.entities.MDSubscription.filter({ status: "active" }),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  // Only show providers with at least 1 verified license AND active MD coverage
  const verifiedProviderIds = new Set(licenses.map(l => l.provider_id));
  const mdCoveredProviderIds = new Set(mdSubs.map(s => s.provider_id));

  const providers = users.filter(u =>
    u.role === "provider" &&
    u.accepts_new_patients !== false &&
    verifiedProviderIds.has(u.id) &&
    mdCoveredProviderIds.has(u.id)
  );

  // Service filter: only show providers with active MD subscription for selected service
  const serviceFiltered = serviceFilter === "all" ? providers : providers.filter(p => {
    return mdSubs.some(sub => 
      sub.provider_id === p.id && 
      sub.service_type_name === serviceFilter
    );
  });

  const filtered = serviceFiltered.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.specialty?.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase())
  );

  const servicesFor = (providerId) => {
    return mdSubs
      .filter(sub => sub.provider_id === providerId)
      .map(sub => sub.service_type_name);
  };

  const certsFor = (id) => certs.filter(c => c.provider_id === id);
  const avgRating = (id) => {
    const r = reviews.filter(rv => rv.provider_id === id);
    if (!r.length) return null;
    return (r.reduce((s, rv) => s + rv.rating, 0) / r.length).toFixed(1);
  };

  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const handleAIMatch = async () => {
    setAiMatching(true);
    try {
      const me = await base44.auth.me();
      const journey = await base44.entities.PatientJourney.filter({ patient_id: me.id });
      
      const concerns = journey[0]?.skin_concerns || [];
      const goals = journey[0]?.treatment_goals || [];
      
      const prompt = `I'm looking for aesthetic treatment providers. My skin concerns: ${concerns.join(", ")}. My goals: ${goals.join(", ")}. 
      
Available services and their typical uses:
${serviceTypes.map(st => `- ${st.name}: ${st.description || "aesthetic treatment"}`).join("\n")}

Based on my concerns and goals, which service types would be most relevant? Return a JSON array of service names in priority order.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommended_services: {
              type: "array",
              items: { type: "string" }
            },
            reasoning: { type: "string" }
          }
        }
      });

      setAiMatchDialog(res.recommended_services?.[0] || serviceTypes[0]?.name || "all");
    } catch (error) {
      console.error("AI matching failed:", error);
    } finally {
      setAiMatching(false);
    }
  };

  const handleBook = async () => {
    setBookingError("");
    setBookingLoading(true);
    
    try {
      // Validate provider scope eligibility before booking
      try {
        const validation = await base44.functions.invoke("validateBookingScope", {
          provider_id: bookDialog.id,
          service: bookForm.service,
        });
        if (!validation.data?.eligible) {
          setBookingError(validation.data?.reason || "This provider is not currently eligible to perform this service.");
          setBookingLoading(false);
          return;
        }
      } catch (fnError) {
        console.warn('Scope validation skipped:', fnError);
      }

      const me = await base44.auth.me();
      await base44.entities.Appointment.create({
        patient_id: me.id,
        patient_email: me.email,
        patient_name: me.full_name,
        provider_id: bookDialog.id,
        provider_email: bookDialog.email,
        provider_name: bookDialog.full_name,
        service: bookForm.service,
        appointment_date: bookForm.appointment_date,
        appointment_time: bookForm.appointment_time || "09:00",
        patient_notes: bookForm.patient_notes,
        status: "requested",
      });

      // Notify provider
      await base44.entities.Notification.create({
        user_id: bookDialog.id,
        user_email: bookDialog.email,
        type: 'appointment_request',
        message: `New appointment request from ${me.full_name} for ${bookForm.service}`,
        link_page: 'ProviderAppointments'
      });

      setBooked(true);
    } catch (error) {
      setBookingError(error.message || "Failed to create appointment");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Find Providers</h2>
          <p className="text-slate-500 text-sm mt-1">Book appointments with certified aesthetic providers</p>
        </div>
        <Button onClick={handleAIMatch} disabled={aiMatching} variant="outline" className="flex items-center gap-2 whitespace-nowrap">
          <Sparkles className="w-4 h-4" />
          {aiMatching ? "Matching..." : "AI Match"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, specialty, or city..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="pl-9">
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {[...new Set(mdSubs.map(s => s.service_type_name))].sort().map(service => (
                <SelectItem key={service} value={service}>{service}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {aiMatchDialog && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <p className="text-sm text-purple-900 flex-1">
            <strong>AI Recommendation:</strong> Based on your journey, we suggest starting with <strong>{aiMatchDialog}</strong> providers
          </p>
          <Button size="sm" onClick={() => setServiceFilter(aiMatchDialog)} className="bg-purple-600 text-white hover:bg-purple-700">
            Apply Filter
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => {
          const rating = avgRating(p.id);
          const providerCerts = certsFor(p.id);
          return (
            <Card key={p.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} className="font-bold text-lg">
                      {p.full_name?.[0] || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-900">{p.full_name}</p>
                    {p.specialty && <p className="text-xs text-slate-500">{p.specialty}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {p.city && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}{p.state ? `, ${p.state}` : ""}</span>}
                      {rating && <span className="text-xs flex items-center gap-1 text-amber-600"><Star className="w-3 h-3 fill-amber-400" />{rating}</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {servicesFor(p.id).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {servicesFor(p.id).slice(0, 3).map(service => (
                        <Badge key={service} className="text-xs bg-green-50 text-green-700 border-green-200">
                          {service}
                        </Badge>
                      ))}
                      {servicesFor(p.id).length > 3 && <Badge variant="outline" className="text-xs">+{servicesFor(p.id).length - 3} more</Badge>}
                    </div>
                  )}
                  {providerCerts.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {providerCerts.slice(0, 2).map(c => (
                        <Badge key={c.id} className="text-xs bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                          <Award className="w-3 h-3" />{c.certification_name}
                        </Badge>
                      ))}
                      {providerCerts.length > 2 && <Badge variant="outline" className="text-xs">+{providerCerts.length - 2}</Badge>}
                    </div>
                  )}
                </div>
                {p.bio && <p className="text-xs text-slate-500 line-clamp-2">{p.bio}</p>}
                
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  {p.consultation_fee && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />${p.consultation_fee} consult
                    </span>
                  )}
                  {p.booking_deposit && (
                    <span className="flex items-center gap-1 text-purple-600">
                      ${p.booking_deposit} deposit
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" style={{ background: "#FA6F30", color: "#fff" }}
                    onClick={() => setSelectedProvider(p)}>
                    <Info className="w-3.5 h-3.5 mr-2" /> View Profile
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setMsgDialog(p)} title="Message provider">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400">No providers found</div>
        )}
      </div>

      {/* Provider Profile Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedProvider?.full_name}</DialogTitle></DialogHeader>
          {selectedProvider && (
            <Tabs defaultValue="about">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="book">Book Appointment</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-4">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback style={{ background: "var(--novi-gold)", color: "#1A1A2E" }} className="font-bold text-2xl">
                      {selectedProvider.full_name?.[0] || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{selectedProvider.full_name}</h3>
                    {selectedProvider.specialty && <p className="text-sm text-slate-500">{selectedProvider.specialty}</p>}
                    {selectedProvider.practice_name && <p className="text-sm text-slate-600 mt-1">{selectedProvider.practice_name}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {selectedProvider.city && (
                        <span className="text-sm text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedProvider.city}{selectedProvider.state ? `, ${selectedProvider.state}` : ""}
                        </span>
                      )}
                      {avgRating(selectedProvider.id) && (
                        <span className="text-sm flex items-center gap-1 text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {avgRating(selectedProvider.id)} ({reviews.filter(r => r.provider_id === selectedProvider.id).length} reviews)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProvider.bio && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">About</h4>
                    <p className="text-sm text-slate-600">{selectedProvider.bio}</p>
                  </div>
                )}

                {selectedProvider.years_experience && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Experience</h4>
                    <p className="text-sm text-slate-600">{selectedProvider.years_experience} years in aesthetic medicine</p>
                  </div>
                )}

                {servicesFor(selectedProvider.id).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Services Offered</h4>
                    <div className="flex gap-2 flex-wrap">
                      {servicesFor(selectedProvider.id).map(service => (
                        <Badge key={service} className="bg-green-50 text-green-700 border-green-200">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {certsFor(selectedProvider.id).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Certifications</h4>
                    <div className="flex gap-2 flex-wrap">
                      {certsFor(selectedProvider.id).map(c => (
                        <Badge key={c.id} className="bg-amber-50 text-amber-700 border-amber-200">
                          {c.certification_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {selectedProvider.consultation_fee && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Consultation Fee</p>
                      <p className="text-lg font-semibold text-slate-900">${selectedProvider.consultation_fee}</p>
                    </div>
                  )}
                  {selectedProvider.booking_deposit && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Booking Deposit</p>
                      <p className="text-lg font-semibold text-purple-600">${selectedProvider.booking_deposit}</p>
                    </div>
                  )}
                </div>

                {(selectedProvider.deposit_percent || selectedProvider.cancellation_hours) && (
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 space-y-1">
                    <h4 className="font-semibold text-sm text-slate-800 mb-1">Booking Policy</h4>
                    {selectedProvider.deposit_percent && <p>💳 {selectedProvider.deposit_percent}% deposit required at booking</p>}
                    {selectedProvider.cancellation_hours && <p>⏰ Cancel {selectedProvider.cancellation_hours}+ hours in advance</p>}
                  </div>
                )}

                {(selectedProvider.practice_packages || []).filter(p => p.is_active).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Packages & Deals</h4>
                    <div className="space-y-2">
                      {selectedProvider.practice_packages.filter(p => p.is_active).map((pkg, i) => {
                        const icons = { bundle: Package, reward: Gift, promo: Tag };
                        const PIcon = icons[pkg.type] || Package;
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.25)" }}>
                            <PIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900">{pkg.title}</p>
                                {pkg.price && <span className="text-xs font-bold" style={{ color: "#FA6F30" }}>${pkg.price}</span>}
                                {pkg.original_price && <span className="text-xs line-through text-slate-400">${pkg.original_price}</span>}
                                {pkg.sessions && <span className="text-xs text-slate-500">{pkg.sessions} sessions</span>}
                              </div>
                              {pkg.description && <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  style={{ background: "#FA6F30", color: "#fff" }}
                  onClick={() => {
                    setBookDialog(selectedProvider);
                    setBookForm({ service: "", appointment_date: "", appointment_time: "", patient_notes: "" });
                    setBooked(false);
                    setSelectedProvider(null);
                  }}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Appointment
                </Button>
              </TabsContent>

              <TabsContent value="book" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Service *</Label>
                    <Select value={bookForm.service} onValueChange={v => setBookForm({ ...bookForm, service: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicesFor(selectedProvider.id).map(service => (
                          <SelectItem key={service} value={service}>{service}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" value={bookForm.appointment_date} onChange={e => setBookForm({ ...bookForm, appointment_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Time</Label>
                      <Input type="time" value={bookForm.appointment_time} onChange={e => setBookForm({ ...bookForm, appointment_time: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={bookForm.patient_notes} onChange={e => setBookForm({ ...bookForm, patient_notes: e.target.value })} placeholder="Any special requests or info..." />
                  </div>
                  {bookingError && (
                    <div className="rounded-xl overflow-hidden border border-red-200">
                      <div className="px-4 py-3 bg-red-50 flex items-start gap-2">
                        <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                        <div>
                          <p className="text-sm font-semibold text-red-700">Provider Not Currently Eligible</p>
                          <p className="text-xs text-red-600 mt-0.5">{bookingError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Payment Required</p>
                    <p className="text-xs text-purple-600">
                      A ${selectedProvider.booking_deposit || 50} deposit will be required after request confirmation.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setSelectedProvider(null)}>Cancel</Button>
                    <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={handleBook} disabled={!bookForm.service || !bookForm.appointment_date || bookingLoading}>
                      {bookingLoading ? "Checking eligibility…" : "Request Appointment"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Book Dialog */}
      <Dialog open={!!bookDialog} onOpenChange={() => setBookDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Book with {bookDialog?.full_name}</DialogTitle></DialogHeader>
          {booked ? (
            <div className="text-center py-6">
              <p className="text-green-600 font-semibold text-lg">Request Sent!</p>
              <p className="text-slate-500 text-sm mt-1">The provider will confirm your appointment soon.</p>
              <Button className="mt-4" onClick={() => setBookDialog(null)} style={{ background: "#FA6F30", color: "#fff" }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Service *</Label>
                <Select value={bookForm.service} onValueChange={v => setBookForm({ ...bookForm, service: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookDialog && servicesFor(bookDialog.id).map(service => (
                      <SelectItem key={service} value={service}>{service}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={bookForm.appointment_date} onChange={e => setBookForm({ ...bookForm, appointment_date: e.target.value })} />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={bookForm.appointment_time} onChange={e => setBookForm({ ...bookForm, appointment_time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={bookForm.patient_notes} onChange={e => setBookForm({ ...bookForm, patient_notes: e.target.value })} placeholder="Any special requests or info..." />
              </div>
              {bookingError && (
                <div className="rounded-xl overflow-hidden border border-red-200">
                  <div className="px-4 py-3 bg-red-50 flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-red-700">Provider Not Currently Eligible</p>
                      <p className="text-xs text-red-600 mt-0.5">{bookingError}</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-orange-50 border-t border-orange-100">
                    <p className="text-xs font-semibold text-orange-700 mb-1.5">What you can do:</p>
                    <ul className="space-y-1">
                      {[
                        "Try a different service this provider offers",
                        "Search for another provider certified for this treatment",
                        "Contact the provider directly to discuss your options",
                      ].map(tip => (
                        <li key={tip} className="flex items-start gap-1.5 text-xs text-orange-600">
                          <span className="flex-shrink-0 mt-0.5">›</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setBookDialog(null)}>Cancel</Button>
                <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={handleBook} disabled={!bookForm.service || !bookForm.appointment_date || bookingLoading}>
                  {bookingLoading ? "Checking eligibility…" : "Request Appointment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-booking Message Dialog */}
      <Dialog open={!!msgDialog} onOpenChange={() => setMsgDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Message {msgDialog?.full_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 mb-4">Ask questions before booking your appointment</p>
          {msgDialog && (
            <MessageThread
              appointmentId={`pre-${msgDialog.id}`}
              recipientId={msgDialog.id}
              recipientName={msgDialog.full_name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}