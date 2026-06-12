import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, MapPin, Award, Calendar, DollarSign, MessageSquare, Sparkles, Filter, Gift, Package, Tag, ImageIcon, Info, X, Loader2 } from "lucide-react";
import MessageThread from "@/components/messaging/MessageThread";
import MessageUnreadBadge from "@/components/messaging/MessageUnreadBadge";
import { useAppointmentMessageUnread, unreadCountForThread } from "@/hooks/useAppointmentMessageUnread";
import {
  buildPreBookingThreadId,
  parsePreBookingThreadId,
} from "@/lib/appointmentMessageThreads";
import { broadcastAppointmentsRefresh } from "@/lib/appointmentSync";
import { providerReviewAverage } from "@/lib/providerRating";
import { galleryPairsForPatientDisplay } from "@/lib/galleryPhotos";
import { BeforeAfterGallery } from "@/components/marketplace/BeforeAfterGallery";
import { referralCodeMatchesProvider } from "@/lib/referralCode";
import { isAppointmentInPast, todayDateInputValue } from "@/lib/repCallScheduling";
import { AppointmentTimeField, currentTimeInputValue } from "@/components/appointments/AppointmentTimePicker";
import {
  providerBookableServiceNames,
  providerBookableServices,
} from "@/lib/providerOfferingServices";

/** Matches AI scan treatment categories → service_types.category (MD marketplace). */
const JOURNEY_CATEGORY_SLUGS = new Set([
  "injectables",
  "fillers",
  "laser",
  "skincare",
  "body_contouring",
  "prp",
  "other",
]);

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

const surfaceCard = {
  background: "#ffffff",
  border: "1px solid rgba(30,37,53,0.07)",
  boxShadow: "0 2px 16px rgba(30,37,53,0.06)",
};

const servicePill = {
  background: "rgba(123,142,200,0.1)",
  color: "#4a5fa8",
  border: "1px solid rgba(123,142,200,0.2)",
};

function displayName(provider) {
  return provider.practice_name || provider.full_name || "Provider";
}

function specialtyLabels(provider, serviceTypes = []) {
  const ids = Array.isArray(provider.specialties) ? provider.specialties : [];
  if (ids.length) {
    return ids
      .map((id) => {
        const st = serviceTypes.find((s) => String(s.id) === String(id));
        return st?.name || null;
      })
      .filter(Boolean);
  }
  if (provider.specialty) return [provider.specialty];
  return [];
}

function activePackages(provider) {
  return (provider.practice_packages || []).filter((pkg) => pkg && pkg.is_active !== false);
}

export default function PatientMarketplace() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const journeyCategory = String(searchParams.get("category") || "").trim().toLowerCase();
  const deepLinkProviderId = String(searchParams.get("provider") || "").trim();

  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [bookDialog, setBookDialog] = useState(null);
  const [bookForm, setBookForm] = useState({
    service: "",
    appointment_date: "",
    appointment_time: "",
    patient_notes: "",
    referral_code: "",
  });
  const [booked, setBooked] = useState(false);
  const [msgDialog, setMsgDialog] = useState(null);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchDialog, setAiMatchDialog] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 60_000,
  });

  const { data: unreadSummary } = useAppointmentMessageUnread({ enabled: !!me && !msgDialog });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["marketplace-catalog"],
    queryFn: () => base44.marketplace.getCatalog(),
    staleTime: 30_000,
    refetchInterval: msgDialog ? false : 5_000,
    refetchIntervalInBackground: false,
  });

  const providers = catalog?.providers || [];

  useEffect(() => {
    const openId = String(searchParams.get("open_message") || "").trim();
    if (!openId || !me?.id) return;
    const pre = parsePreBookingThreadId(openId);
    if (!pre?.providerId) return;
    const provider = (providers || []).find((p) => String(p.id) === pre.providerId);
    if (provider) setMsgDialog(provider);
    const next = new URLSearchParams(searchParams);
    next.delete("open_message");
    setSearchParams(next, { replace: true });
  }, [searchParams, providers, setSearchParams, me?.id]);
  const mdSubs = catalog?.md_subscriptions || [];
  const certs = catalog?.certifications || [];
  const reviews = catalog?.reviews || [];

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const serviceFiltered = useMemo(() => {
    let list = providers;

    if (stateFilter !== "all") {
      list = list.filter((p) => String(p.state || "").toUpperCase() === stateFilter);
    }

    if (serviceFilter !== "all") {
      list = list.filter((p) =>
        providerBookableServiceNames({
          providerId: p.id,
          providerOfferings: p.service_offerings_v2,
          mdSubscriptions: mdSubs,
          serviceTypes,
        }).includes(serviceFilter)
      );
    }

    if (JOURNEY_CATEGORY_SLUGS.has(journeyCategory) && serviceFilter === "all") {
      list = list.filter((p) =>
        providerBookableServices({
          providerId: p.id,
          providerOfferings: p.service_offerings_v2,
          mdSubscriptions: mdSubs,
          serviceTypes,
        }).some((svc) => svc.category === journeyCategory)
      );
    }

    return list;
  }, [providers, mdSubs, serviceFilter, serviceTypes, journeyCategory, stateFilter]);

  const filtered = serviceFiltered.filter((p) =>
    !search ||
    displayName(p).toLowerCase().includes(search.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.specialty?.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase())
  );

  const availableServiceNames = useMemo(() => {
    const names = new Set();
    for (const p of providers) {
      for (const name of providerBookableServiceNames({
        providerId: p.id,
        providerOfferings: p.service_offerings_v2,
        mdSubscriptions: mdSubs,
        serviceTypes,
      })) {
        names.add(name);
      }
    }
    return [...names].sort();
  }, [providers, mdSubs, serviceTypes]);

  const availableStates = useMemo(() => {
    const fromProviders = providers.map((p) => String(p.state || "").toUpperCase()).filter(Boolean);
    return [...new Set(fromProviders)].sort();
  }, [providers]);

  const servicesFor = (provider) =>
    providerBookableServiceNames({
      providerId: provider?.id,
      providerOfferings: provider?.service_offerings_v2,
      mdSubscriptions: mdSubs,
      serviceTypes,
    });

  const certsFor = (id) => certs.filter((c) => c.provider_id === id);
  const ratingFor = (id) => providerReviewAverage(reviews, id, { verifiedOnly: true });

  useEffect(() => {
    if (!deepLinkProviderId || !providers.length) return;
    const match = providers.find((p) => String(p.id) === deepLinkProviderId);
    if (match) setSelectedProvider(match);
  }, [deepLinkProviderId, providers]);

  const handleAIMatch = async () => {
    setAiMatching(true);
    try {
      const me = await base44.auth.me();
      const journey = await base44.entities.PatientJourney.filter({ patient_id: me.id });
      const concerns = journey[0]?.skin_concerns || [];
      const goals = journey[0]?.treatment_goals || [];

      const prompt = `I'm looking for aesthetic treatment providers. My skin concerns: ${concerns.join(", ")}. My goals: ${goals.join(", ")}. 
      
Available services and their typical uses:
${serviceTypes.map((st) => `- ${st.name}: ${st.description || "aesthetic treatment"}`).join("\n")}

Based on my concerns and goals, which service types would be most relevant? Return a JSON array of service names in priority order.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommended_services: { type: "array", items: { type: "string" } },
            reasoning: { type: "string" },
          },
        },
      });

      setAiMatchDialog(res.recommended_services?.[0] || serviceTypes[0]?.name || "all");
    } catch (error) {
      console.error("AI matching failed:", error);
    } finally {
      setAiMatching(false);
    }
  };

  const openBookDialog = (provider) => {
    setBookDialog(provider);
    setBookForm({
      service: "",
      appointment_date: "",
      appointment_time: "",
      patient_notes: "",
      referral_code: "",
    });
    setBooked(false);
    setBookingError("");
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      const activeProvider = bookDialog ?? selectedProvider;
      if (!me?.id) throw new Error("Please sign in to book an appointment.");
      if (!activeProvider?.id) throw new Error("No provider selected.");

      const enteredReferral = bookForm.referral_code?.trim() || "";
      if (
        enteredReferral &&
        activeProvider.referral_program_active &&
        activeProvider.referral_code &&
        !referralCodeMatchesProvider(enteredReferral, activeProvider.referral_code)
      ) {
        const code = String(activeProvider.referral_code || "").trim();
        const disc = activeProvider.referral_discount ? ` (${activeProvider.referral_discount})` : "";
        const err = new Error(`Enter proper referral code: ${code}${disc}.`);
        err.isEligibilityError = true;
        throw err;
      }

      if (isAppointmentInPast(bookForm.appointment_date, bookForm.appointment_time)) {
        const err = new Error("Appointment date and time cannot be in the past.");
        err.isEligibilityError = true;
        throw err;
      }

      const validation = await base44.functions.invoke("validateBookingScope", {
        provider_id: activeProvider.id,
        service: bookForm.service,
        referral_code: enteredReferral || undefined,
      });
      if (!validation.data?.eligible) {
        const reason = validation.data?.reason || "This provider is not currently eligible to perform this service.";
        const err = new Error(reason);
        err.isEligibilityError = true;
        throw err;
      }

      return base44.entities.Appointment.create({
        patient_id: me.id,
        patient_email: me.email,
        patient_name: me.full_name,
        provider_id: activeProvider.id,
        provider_email: activeProvider.email,
        provider_name: activeProvider.full_name,
        service: bookForm.service,
        appointment_date: bookForm.appointment_date,
        appointment_time: bookForm.appointment_time || "09:00",
        patient_notes: bookForm.patient_notes,
        referral_code: validation.data?.referral_code || undefined,
        status: "requested",
      });
    },
    onSuccess: (appointment) => {
      const activeProvider = bookDialog ?? selectedProvider;
      if (appointment?.id) {
        qc.setQueryData(["patient-appointments"], (old) => {
          const list = Array.isArray(old) ? old : [];
          return [appointment, ...list];
        });
        if (me?.id && activeProvider?.id) {
          const preThreadId = buildPreBookingThreadId(activeProvider.id, me.id);
          if (preThreadId) {
            qc.removeQueries({ queryKey: ["appointment-messages", preThreadId] });
          }
          void qc.invalidateQueries({ queryKey: ["appointment-messages", appointment.id] });
          void qc.invalidateQueries({ queryKey: ["appointment-message-unread"] });
        }
      }
      if (activeProvider?.id) {
        void base44.entities.Notification.create({
          user_id: activeProvider.id,
          user_email: activeProvider.email,
          type: "appointment_request",
          message: `New appointment request from ${me?.full_name || "A patient"} for ${bookForm.service}`,
          link_page: "ProviderPractice?tab=appointments",
        }).catch(() => {});
      }
      broadcastAppointmentsRefresh();
      void qc.refetchQueries({ queryKey: ["patient-appointments"] });
      void qc.invalidateQueries({ queryKey: ["my-notifications"] });
      setBooked(true);
      setBookingError("");
    },
    onError: (error) => {
      let message = error.message || "Failed to create appointment";
      try {
        const parsed = JSON.parse(message.replace(/^\[lovable-provider\] \d+ /, ""));
        message = parsed.reason || parsed.error || message;
      } catch {
        // keep original message
      }
      setBookingError(message);
    },
  });

  const handleBook = () => {
    setBookingError("");
    bookMutation.mutate();
  };

  const bookingLoading = bookMutation.isPending;

  const ProviderAvatar = ({ provider, size = "w-12 h-12" }) => {
    const logo = provider.brand_logo_url || provider.avatar_url;
    const label = displayName(provider);
    return (
      <Avatar className={size}>
        {logo ? <AvatarImage src={logo} alt={label} /> : null}
        <AvatarFallback
          style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)", color: "#fff" }}
          className="font-bold text-lg"
        >
          {label[0] || "P"}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl leading-tight" style={{ fontFamily: "'DM Serif Display', serif", color: "#2a3050" }}>
            Find a Provider
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(42,48,80,0.55)" }}>
            Browse Novi-verified providers with active medical director coverage.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAIMatch}
          disabled={aiMatching}
          variant="outline"
          className="rounded-xl font-semibold shrink-0"
          style={{ borderColor: "rgba(123,142,200,0.35)", color: "#4a5fa8", background: "rgba(255,255,255,0.85)" }}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {aiMatching ? "Matching…" : "AI Match"}
        </Button>
      </div>

      <div className="rounded-2xl p-4" style={surfaceCard}>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, specialty, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="pl-9">
              <SelectValue placeholder="Filter by service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {availableServiceNames.map((service) => (
                <SelectItem key={service} value={service}>{service}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="pl-9">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {(availableStates.length ? availableStates : US_STATES).map((st) => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      </div>

      {JOURNEY_CATEGORY_SLUGS.has(journeyCategory) && serviceFilter === "all" && (
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl text-sm"
          style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)", color: "#243257" }}
        >
          <Tag className="w-4 h-4 flex-shrink-0" />
          <span>
            Showing providers offering treatments in <strong className="font-semibold">{journeyCategory.replace(/_/g, " ")}</strong> (from your NOVI scan).
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-semibold h-8"
            style={{ color: "#4a5fa8" }}
            onClick={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("category");
                return next;
              });
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {aiMatchDialog && (
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl text-sm"
          style={{ background: "rgba(200,230,60,0.18)", color: "#3D5600", border: "1px solid rgba(90,122,32,0.25)" }}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#5a7a20" }} />
          <p className="flex-1">
            Based on your journey, we suggest providers offering <strong>{aiMatchDialog}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setServiceFilter(aiMatchDialog)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{ background: "rgba(200,230,60,0.35)", color: "#3D5600", border: "1px solid rgba(90,122,32,0.25)" }}
          >
            Apply filter
          </button>
        </div>
      )}

      {!catalogLoading && filtered.length > 0 && (
        <p className="text-xs px-1" style={{ color: "#94a3b8" }}>
          {filtered.length} provider{filtered.length !== 1 ? "s" : ""} with active MD coverage
        </p>
      )}

      {catalogLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse space-y-4" style={surfaceCard}>
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                  <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-slate-100 rounded-full w-20" />
                <div className="h-6 bg-slate-100 rounded-full w-16" />
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 min-w-0">
          {filtered.map((p) => (
            <MarketplaceProviderCard
              key={p.id}
              provider={p}
              services={servicesFor(p)}
              certs={certsFor(p.id)}
              specialties={specialtyLabels(p, serviceTypes)}
              rating={ratingFor(p.id).average}
              reviewCount={ratingFor(p.id).count}
              onBook={() => openBookDialog(p)}
              onProfile={() => setSelectedProvider(p)}
              onMessage={() => setMsgDialog(p)}
              messageUnreadCount={unreadCountForThread(
                unreadSummary,
                me?.id ? buildPreBookingThreadId(p.id, me.id) : null
              )}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 rounded-2xl" style={surfaceCard}>
              <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(123,142,200,0.45)" }} />
              <p className="font-semibold text-slate-800">No providers found</p>
              <p className="text-sm mt-1" style={{ color: "rgba(42,48,80,0.5)" }}>
                Try adjusting your filters or search term.
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent
          hideCloseButton
          className="max-w-3xl w-full sm:w-[calc(100%-2rem)] left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl flex flex-col p-0 gap-0 overflow-hidden border-0 sm:border"
        >
          {selectedProvider && (
            <Tabs defaultValue="about" className="flex flex-col flex-1 min-h-0 w-full">
              <div
                className="shrink-0 sticky top-0 z-20 bg-white border-b"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
              >
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pb-3">
                  <DialogHeader className="text-left p-0 flex-1 min-w-0 space-y-0">
                    <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900 truncate pr-2">
                      {displayName(selectedProvider)}
                    </DialogTitle>
                  </DialogHeader>
                  <DialogClose asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      aria-label="Close profile"
                    >
                      <X className="h-4 w-4 shrink-0" />
                      <span>Close</span>
                    </button>
                  </DialogClose>
                </div>
                <div className="px-4 sm:px-6 pb-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="about" className="min-h-[44px] text-xs sm:text-sm">Profile</TabsTrigger>
                    <TabsTrigger value="book" className="min-h-[44px] text-xs sm:text-sm">Book Appointment</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                <TabsContent value="about" className="mt-0 px-4 sm:px-6 py-5 focus-visible:outline-none">
                  <ProviderProfilePanel
                    provider={selectedProvider}
                    mdServices={servicesFor(selectedProvider)}
                    certs={certsFor(selectedProvider.id)}
                    rating={ratingFor(selectedProvider.id).average}
                    reviewCount={ratingFor(selectedProvider.id).count}
                    serviceTypes={serviceTypes}
                    onBook={() => {
                      openBookDialog(selectedProvider);
                      setSelectedProvider(null);
                    }}
                  />
                </TabsContent>

                <TabsContent value="book" className="mt-0 px-4 sm:px-6 py-5 space-y-4 focus-visible:outline-none">
                  <BookingForm
                    provider={selectedProvider}
                    bookForm={bookForm}
                    setBookForm={setBookForm}
                    services={servicesFor(selectedProvider)}
                    bookingError={bookingError}
                    bookingLoading={bookingLoading}
                    onCancel={() => setSelectedProvider(null)}
                    onSubmit={handleBook}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!bookDialog} onOpenChange={() => setBookDialog(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book with {bookDialog ? displayName(bookDialog) : ""}</DialogTitle>
          </DialogHeader>
          {booked ? (
            <div className="text-center py-6">
              <p className="text-green-600 font-semibold text-lg">Request Sent!</p>
              <p className="text-slate-500 text-sm mt-1">The provider will confirm your appointment soon.</p>
              <Button className="mt-4" onClick={() => setBookDialog(null)} style={{ background: "#FA6F30", color: "#fff" }}>
                Done
              </Button>
            </div>
          ) : bookDialog ? (
            <BookingForm
              provider={bookDialog}
              bookForm={bookForm}
              setBookForm={setBookForm}
              services={servicesFor(bookDialog)}
              bookingError={bookingError}
              bookingLoading={bookingLoading}
              onCancel={() => setBookDialog(null)}
              onSubmit={handleBook}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!msgDialog}
        onOpenChange={(open) => {
          if (!open) setMsgDialog(null);
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100%-1rem)] max-h-[92dvh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Message {msgDialog ? displayName(msgDialog) : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 mb-2 px-6 shrink-0 break-words">
            Answer a few quick questions about your visit. After that, book an appointment to keep messaging.
          </p>
          <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
          {msgDialog && me?.id ? (
            <MessageThread
              key={buildPreBookingThreadId(msgDialog.id, me.id)}
              className="h-full min-h-0"
              appointmentId={buildPreBookingThreadId(msgDialog.id, me.id)}
              recipientId={msgDialog.id}
              recipientName={displayName(msgDialog)}
              providerIdForBooking={msgDialog.id}
            />
          ) : msgDialog ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileSection({ title, icon: Icon = null, children, emptyText }) {
  const hasContent = children != null && children !== false;
  return (
    <section>
      <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5" style={{ color: "rgba(30,37,53,0.45)" }}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </h4>
      {hasContent ? children : emptyText ? (
        <p className="text-sm" style={{ color: "rgba(42,48,80,0.4)" }}>{emptyText}</p>
      ) : null}
    </section>
  );
}

function ProviderProfilePanel({ provider, mdServices, certs, rating, reviewCount, serviceTypes, onBook }) {
  const brandLogo = provider.brand_logo_url;
  const avatarUrl = provider.avatar_url;
  const specialties = specialtyLabels(provider, serviceTypes);
  const packages = activePackages(provider);
  const photoPairs = galleryPairsForPatientDisplay(provider.gallery_photos);
  const showReferral = provider.referral_program_active && provider.referral_code;
  const showGallery = photoPairs.length > 0;

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div
        className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 p-4 rounded-2xl min-w-0"
        style={{ background: "rgba(123,142,200,0.06)", border: "1px solid rgba(123,142,200,0.12)" }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName(provider)}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-md ring-1 ring-slate-200/80"
          />
        ) : brandLogo ? (
          <img
            src={brandLogo}
            alt={displayName(provider)}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-contain bg-white border border-slate-100 p-2 flex-shrink-0 shadow-sm"
          />
        ) : (
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center font-bold text-3xl text-white flex-shrink-0 shadow-md"
            style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)" }}
          >
            {displayName(provider)[0] || "P"}
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 leading-tight tracking-tight break-words">{displayName(provider)}</h2>
            {provider.practice_name && provider.full_name && provider.practice_name !== provider.full_name && (
              <p className="text-sm text-slate-600 leading-snug">{provider.full_name}</p>
            )}
            {provider.email && (
              <p className="text-xs text-slate-500 truncate" title={provider.email}>{provider.email}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-600">
            {(provider.city || provider.state) && (
              <span className="inline-flex items-start gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                <span className="break-words min-w-0">
                  {provider.city}
                  {provider.city && provider.state ? ", " : ""}
                  {provider.state || ""}
                </span>
              </span>
            )}
            {provider.consultation_fee != null && provider.consultation_fee !== "" && (
              <p className="text-sm leading-relaxed">
                <span className="text-slate-500">Consultation </span>
                <strong className="text-slate-900 font-semibold">${provider.consultation_fee}</strong>
                {Number(provider.booking_deposit) > 0 && (
                  <span className="text-slate-500">
                    {" "}
                    · Booking deposit <strong style={{ color: "#7B8EC8" }}>${provider.booking_deposit}</strong>
                    <span className="font-normal"> (due after provider confirms)</span>
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <ProfileSection title="About" emptyText={!provider.bio ? "No bio added yet." : null}>
        {provider.bio && <p className="text-sm text-slate-600 leading-relaxed break-words">{provider.bio}</p>}
      </ProfileSection>

      <ProfileSection title="Star rating" emptyText={rating ? null : "No patient reviews yet."}>
        {rating && <StarRatingDisplay average={rating} reviewCount={reviewCount} size="md" />}
      </ProfileSection>

      <ProfileSection title="Specialties" emptyText={specialties.length ? null : "No specialties listed."}>
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((label) => (
              <Badge key={label} variant="outline" className="text-xs font-medium border" style={{ color: "#4a5fa8", borderColor: "rgba(123,142,200,0.35)", background: "rgba(123,142,200,0.08)" }}>
                {label}
              </Badge>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Treatments offered" emptyText={mdServices.length ? null : "No treatments listed yet."}>
        {mdServices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mdServices.map((service) => (
              <Badge key={service} variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-medium">
                {service}
              </Badge>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Certifications" emptyText={certs.length ? null : "No certifications on file."}>
        {certs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {certs.map((c) => (
              <Badge key={c.id} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-medium inline-flex items-center gap-1">
                <Award className="w-3 h-3" />
                {c.certification_name || c.cert_name}
              </Badge>
            ))}
          </div>
        )}
      </ProfileSection>

      {showGallery && (
        <ProfileSection title="Before & after gallery" icon={ImageIcon}>
          <BeforeAfterGallery pairs={photoPairs} variant="profile" />
        </ProfileSection>
      )}

      {packages.length > 0 && (
        <ProfileSection title="Packages & deals" icon={Package}>
          <div className="space-y-2">
            {packages.map((pkg, i) => {
              const icons = { bundle: Package, reward: Gift, promo: Tag };
              const PIcon = icons[pkg.type] || Package;
              const typeLabel = pkg.type === "promo" ? "Promo" : pkg.type === "reward" ? "Reward" : "Bundle";
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(200,230,60,0.07)", border: "1px solid rgba(200,230,60,0.25)" }}
                >
                  <PIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#4a6b10" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{pkg.title}</p>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(123,142,200,0.12)", color: "#4a5fa8" }}>
                        {typeLabel}
                      </span>
                      {pkg.price != null && pkg.price !== "" && (
                        <span className="text-xs font-bold" style={{ color: "#FA6F30" }}>${pkg.price}</span>
                      )}
                      {pkg.original_price != null && pkg.original_price !== "" && (
                        <span className="text-xs line-through text-slate-400">${pkg.original_price}</span>
                      )}
                      {pkg.sessions && <span className="text-xs text-slate-500">{pkg.sessions} sessions</span>}
                    </div>
                    {pkg.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pkg.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </ProfileSection>
      )}

      {showReferral && (
        <section className="p-4 rounded-2xl" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
          <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-2" style={{ color: "#2a3050" }}>
            <Gift className="w-4 h-4" style={{ color: "#7B8EC8" }} />
            Referral program
          </h4>
          <p className="text-sm text-slate-600">
            Use code{" "}
            <strong className="font-mono px-2 py-0.5 rounded bg-white border border-slate-200">{provider.referral_code}</strong>
            {provider.referral_discount ? ` — ${provider.referral_discount}` : " when you book."}
          </p>
        </section>
      )}

      <Button className="w-full h-11 rounded-xl font-semibold" style={{ background: "#FA6F30", color: "#fff" }} onClick={onBook}>
        <Calendar className="w-4 h-4 mr-2" />
        Book appointment
      </Button>
    </div>
  );
}

function CardBrandMark({ provider, className = "w-24 h-24 sm:w-28 sm:h-28" }) {
  const label = displayName(provider);
  const avatar = provider.avatar_url;
  const brand = provider.brand_logo_url;

  // Headshot first on marketplace: large circle so patients recognize the provider.
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={label}
        className={`${className} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-md ring-1 ring-slate-200/80`}
      />
    );
  }
  if (brand) {
    return (
      <img
        src={brand}
        alt={label}
        className={`${className} rounded-2xl object-contain bg-white border border-slate-100 p-1.5 flex-shrink-0 shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-2xl sm:text-3xl shadow-md`}
      style={{ background: "linear-gradient(135deg, #7B8EC8, #2D6B7F)", color: "white" }}
    >
      {label[0] || "P"}
    </div>
  );
}

/** Small section heading — text only, no boxes */
function CardSectionHeading({ children }) {
  return (
    <p className="text-sm font-semibold text-slate-900 mt-3 mb-1.5">{children}</p>
  );
}

function StarRatingDisplay({ average, reviewCount, size = "sm" }) {
  if (!average) return null;
  const starClass = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const textClass = size === "md" ? "text-base" : "text-sm";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-amber-700 ${textClass}`}>
      <Star className={`${starClass} fill-amber-400 text-amber-400`} />
      {average}
      {reviewCount > 0 && (
        <span className="font-normal text-slate-500">
          ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
        </span>
      )}
    </span>
  );
}

const mdServiceBadge = "text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 break-words max-w-full";
const certBadge = "text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 break-words max-w-full";

function MarketplaceProviderCard({
  provider,
  services,
  certs,
  specialties,
  rating,
  reviewCount,
  onBook,
  onProfile,
  onMessage,
  messageUnreadCount = 0,
}) {
  const photoPairs = galleryPairsForPatientDisplay(provider.gallery_photos);
  const packages = activePackages(provider);
  const showReferral = provider.referral_program_active && provider.referral_code;
  const showGallery = photoPairs.length > 0;

  return (
    <article
      className="rounded-2xl p-4 sm:p-5 flex flex-col h-full min-w-0 max-w-full overflow-hidden transition-shadow hover:shadow-md"
      style={surfaceCard}
    >
      <div className="flex items-start gap-4 min-w-0">
        <CardBrandMark provider={provider} />
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="min-w-0 space-y-1">
            <h3 className="font-semibold text-base text-slate-900 leading-tight tracking-tight break-words">
              {displayName(provider)}
            </h3>
            {provider.practice_name && provider.full_name && provider.practice_name !== provider.full_name && (
              <p className="text-sm text-slate-600 leading-snug truncate">{provider.full_name}</p>
            )}
            {provider.email && (
              <p className="text-xs text-slate-500 leading-normal truncate" title={provider.email}>
                {provider.email}
              </p>
            )}
          </div>
          {(provider.city || provider.state || (provider.consultation_fee != null && provider.consultation_fee !== "")) && (
            <div className="flex flex-col gap-1.5 text-sm text-slate-600">
              {(provider.city || provider.state) && (
                <span className="inline-flex items-start gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                  <span className="break-words min-w-0">
                    {provider.city}
                    {provider.city && provider.state ? ", " : ""}
                    {provider.state || ""}
                  </span>
                </span>
              )}
              {provider.consultation_fee != null && provider.consultation_fee !== "" && (
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>
                    <strong className="text-slate-900 font-semibold">${provider.consultation_fee}</strong>
                    <span className="text-slate-500 font-normal"> consultation</span>
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {provider.bio && (
        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mt-3 break-words">{provider.bio}</p>
      )}

      {rating && (
        <div>
          <CardSectionHeading>Star Rating:</CardSectionHeading>
          <StarRatingDisplay average={rating} reviewCount={reviewCount} />
        </div>
      )}

      {specialties.length > 0 && (
        <div>
          <CardSectionHeading>Specialties:</CardSectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {specialties.slice(0, 4).map((name) => (
              <span key={name} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border" style={servicePill}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {services.length > 0 && (
        <div>
          <CardSectionHeading>Treatments offered:</CardSectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {services.slice(0, 4).map((service) => (
              <span key={service} className={mdServiceBadge}>
                {service}
              </span>
            ))}
            {services.length > 4 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full text-slate-500 bg-slate-50 border border-slate-100">
                +{services.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {certs.length > 0 && (
        <div>
          <CardSectionHeading>Certifications:</CardSectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {certs.slice(0, 3).map((c) => (
              <span key={c.id} className={certBadge}>
                <Award className="w-3 h-3 shrink-0" />
                {c.certification_name || c.cert_name}
              </span>
            ))}
            {certs.length > 3 && (
              <span className="text-[11px] text-slate-500">+{certs.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {showGallery && (
        <div className="min-w-0 w-full overflow-hidden">
          <CardSectionHeading>Before/After Gallery Photos:</CardSectionHeading>
          <BeforeAfterGallery pairs={photoPairs} variant="card" maxSets={2} />
        </div>
      )}

      {packages.length > 0 && (
        <div>
          <CardSectionHeading>Packages & deals:</CardSectionHeading>
          <div className="space-y-1.5">
            {packages.slice(0, 2).map((pkg, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}
              >
                <Package className="w-3.5 h-3.5 shrink-0" style={{ color: "#4a6b10" }} />
                <span className="font-semibold text-slate-800 truncate">{pkg.title}</span>
                {pkg.price != null && pkg.price !== "" && (
                  <span className="font-bold shrink-0" style={{ color: "#FA6F30" }}>${pkg.price}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showReferral && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-600 px-2.5 py-2 rounded-lg min-w-0" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.15)" }}>
          <Gift className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
          <span className="break-words min-w-0">
            Referral: <strong className="font-mono text-slate-800 break-all">{provider.referral_code}</strong>
            {provider.referral_discount ? ` · ${provider.referral_discount}` : ""}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-2" />

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 min-w-0 w-full">
        <Button
          type="button"
          className="flex-1 min-w-0 h-10 rounded-xl font-semibold text-sm"
          style={{ background: "#FA6F30", color: "#fff" }}
          onClick={onBook}
        >
          <Calendar className="w-4 h-4 mr-1.5 shrink-0" />
          Book
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 min-w-[2.5rem] rounded-xl shrink-0"
          style={{ borderColor: "rgba(123,142,200,0.25)", color: "#7B8EC8" }}
          onClick={onProfile}
          title="View profile"
        >
          <Info className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 min-w-[2.5rem] rounded-xl shrink-0 relative"
          style={{ borderColor: "rgba(123,142,200,0.25)", color: "#7B8EC8" }}
          onClick={onMessage}
          title="Message"
        >
          <MessageSquare className="w-4 h-4" />
          <MessageUnreadBadge count={messageUnreadCount} />
        </Button>
      </div>
    </article>
  );
}

function BookingForm({ provider, bookForm, setBookForm, services, bookingError, bookingLoading, onCancel, onSubmit }) {
  const today = todayDateInputValue();
  const showReferral = provider?.referral_program_active && provider?.referral_code;
  const enteredReferral = bookForm.referral_code?.trim() || "";
  const referralMismatch =
    showReferral &&
    enteredReferral &&
    !referralCodeMatchesProvider(enteredReferral, provider.referral_code);
  const referralOk =
    !showReferral ||
    !enteredReferral ||
    referralCodeMatchesProvider(enteredReferral, provider.referral_code);
  const appointmentInPast = isAppointmentInPast(bookForm.appointment_date, bookForm.appointment_time);
  const displayError = referralMismatch ? "" : bookingError;

  return (
    <div className="space-y-4">
      <div>
        <Label>Service *</Label>
        <Select value={bookForm.service} onValueChange={(v) => setBookForm({ ...bookForm, service: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a service" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service} value={service}>{service}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
        <div className="min-w-0 space-y-2">
          <Label>Date *</Label>
          <Input
            type="date"
            className="w-full min-w-0 max-w-full box-border"
            min={today}
            value={bookForm.appointment_date}
            onChange={(e) => setBookForm({ ...bookForm, appointment_date: e.target.value })}
          />
        </div>
        <AppointmentTimeField
          min={bookForm.appointment_date === today ? currentTimeInputValue() : undefined}
          value={bookForm.appointment_time}
          onChange={(appointment_time) => setBookForm({ ...bookForm, appointment_time })}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Input
          value={bookForm.patient_notes}
          onChange={(e) => setBookForm({ ...bookForm, patient_notes: e.target.value })}
          placeholder="Any special requests or info..."
        />
      </div>
      {showReferral && (
        <div>
          <Label>Referral code (optional)</Label>
          <Input
            value={bookForm.referral_code}
            onChange={(e) => setBookForm({ ...bookForm, referral_code: e.target.value.toUpperCase() })}
            placeholder={provider.referral_code}
            className={referralMismatch ? "border-red-400 focus-visible:ring-red-200" : ""}
            aria-invalid={referralMismatch}
            aria-describedby={referralMismatch ? "referral-code-error" : undefined}
          />
          {referralMismatch ? (
            <p id="referral-code-error" className="text-xs text-red-600 mt-1.5 font-medium">
              Enter proper referral code:{" "}
              <span className="font-mono font-semibold">{provider.referral_code}</span>
              {provider.referral_discount ? ` (${provider.referral_discount})` : ""}.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Enter{" "}
              <span className="font-mono font-semibold">{provider.referral_code}</span>
              {provider.referral_discount ? ` (${provider.referral_discount})` : ""}.
            </p>
          )}
        </div>
      )}
      {displayError && (
        <div className="rounded-xl overflow-hidden border border-red-200">
          <div className="px-4 py-3 bg-red-50 flex items-start gap-2">
            <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-700">Provider Not Currently Eligible</p>
              <p className="text-xs text-red-600 mt-0.5">{displayError}</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          style={{ background: "#FA6F30", color: "#fff" }}
          onClick={onSubmit}
          disabled={!bookForm.service || !bookForm.appointment_date || appointmentInPast || bookingLoading || !referralOk}
        >
          {bookingLoading ? "Checking eligibility…" : "Request Appointment"}
        </Button>
      </div>
    </div>
  );
}
