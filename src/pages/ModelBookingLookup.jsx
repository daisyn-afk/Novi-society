import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Mail, Phone, Clock, MapPin, AlertCircle, CheckCircle2, XCircle, Search, Copy } from "lucide-react";
import NoviFooter from "@/components/NoviFooter";

export default function ModelBookingLookup() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["model-bookings", email, phone],
    queryFn: async () => {
      if (!email || !phone) return [];
      const res = await base44.functions.invoke("lookupModelBookings", { email, phone });
      return Array.isArray(res?.data?.bookings) ? res.data.bookings : [];
    },
    enabled: !!email && !!phone && searched,
  });

  const handleSearch = () => {
    setSearched(true);
  };

  const handleCancel = async (booking) => {
    if (!confirm("Are you sure you want to cancel this booking? Your $50 will be refunded.")) return;
    setCancelling(true);
    try {
      await base44.functions.invoke("cancelModelBooking", { booking_id: booking.id });
      setSelectedBooking(null);
      queryClient.invalidateQueries({ queryKey: ["model-bookings", email, phone] });
      alert("Booking cancelled. Refund will be processed within 3-5 business days.");
    } catch (err) {
      alert("Error cancelling booking: " + err.message);
    }
    setCancelling(false);
  };

  const getStatusBadge = (booking) => {
    if (booking.status === "cancelled") return <XCircle className="w-4 h-4" style={{ color: "#DA6A63" }} />;
    if (booking.status === "attended") return <CheckCircle2 className="w-4 h-4" style={{ color: "#5a7a20" }} />;
    if (booking.is_waitlist) return <Clock className="w-4 h-4" style={{ color: "#FA6F30" }} />;
    return <CheckCircle2 className="w-4 h-4" style={{ color: "#2D6B7F" }} />;
  };

  const getStatusLabel = (booking) => {
    if (booking.status === "cancelled") return "Cancelled";
    if (booking.status === "attended") return "Attended";
    if (booking.is_waitlist) return "Waitlisted";
    if (booking.payment_status === "completed") return "Confirmed";
    return "Pending Payment";
  };

  return (
    <div className="min-h-screen" style={{ background: "#f5f3ef", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #1e2535 0%, #2D6B7F 55%, #7B8EC8 100%)",
        padding: "60px 24px 40px",
      }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-baseline justify-center gap-2 mb-6">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#fff", fontStyle: "italic", fontWeight: 400 }}>novi</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Society</span>
          </div>

          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2rem, 6vw, 3rem)",
            color: "#fff",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.05,
            marginBottom: "12px",
          }}>
            Your Model Booking
          </h1>

          <p style={{
            fontSize: "0.95rem",
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.6,
          }}>
            Look up your training session, view details, or manage your booking.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="py-12 px-6" style={{ background: "#fff" }}>
        <div className="max-w-lg mx-auto">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-xl"
                style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block" style={{ color: "#1e2535" }}>Phone Number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="h-11 rounded-xl"
                style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!email || !phone || isLoading}
              className="w-full py-5 text-base font-bold rounded-xl"
              style={{ background: email && phone && !isLoading ? "#C8E63C" : "rgba(0,0,0,0.1)", color: "#1a2540" }}
            >
              <Search className="w-4 h-4 mr-2" /> Find My Booking
            </Button>
          </div>
        </div>
      </section>

      {/* Results */}
      {searched && (
        <section className="py-12 px-6" style={{ background: "#f5f3ef" }}>
          <div className="max-w-2xl mx-auto">
            {bookings.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}>
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold mb-1" style={{ color: "#1e2535" }}>No Bookings Found</p>
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>Make sure the email and phone match your signup</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className="p-5 rounded-2xl cursor-pointer transition-all hover:shadow-md"
                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)" }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(booking)}
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
                          background: booking.status === "cancelled" ? "rgba(218,106,99,0.15)" : booking.is_waitlist ? "rgba(250,111,48,0.15)" : "rgba(200,230,60,0.12)",
                          color: booking.status === "cancelled" ? "#DA6A63" : booking.is_waitlist ? "#FA6F30" : "#3d5a0a",
                        }}>
                          {getStatusLabel(booking)}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-lg mb-2" style={{ color: "#1e2535" }}>{booking.course_title}</h3>

                    <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
                      {booking.course_date && (
                        <div className="flex items-center gap-2" style={{ color: "rgba(30,37,53,0.65)" }}>
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          {new Date(booking.course_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                      {booking.model_time_slot && !booking.is_waitlist && (
                        <div className="flex items-center gap-2" style={{ color: "rgba(30,37,53,0.65)" }}>
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          {booking.model_time_slot}
                        </div>
                      )}
                      <div className="flex items-center gap-2" style={{ color: "rgba(30,37,53,0.65)" }}>
                        <span className="capitalize">{booking.treatment_type}</span>
                      </div>
                    </div>

                    {booking.status !== "cancelled" && (
                      <div className="text-xs font-semibold cursor-pointer" style={{ color: "#2D6B7F" }}>
                        View Details →
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <NoviFooter />

      {/* Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "#1e2535", fontSize: "1.5rem" }}>
                  {selectedBooking.course_title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Status */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                  background: selectedBooking.status === "cancelled" ? "rgba(218,106,99,0.1)" : selectedBooking.is_waitlist ? "rgba(250,111,48,0.1)" : "rgba(200,230,60,0.1)",
                }}>
                  {getStatusBadge(selectedBooking)}
                  <span className="font-semibold text-sm" style={{
                    color: selectedBooking.status === "cancelled" ? "#DA6A63" : selectedBooking.is_waitlist ? "#FA6F30" : "#3d5a0a",
                  }}>
                    {getStatusLabel(selectedBooking)}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm">
                  {selectedBooking.course_date && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>Training Date:</span>
                      <span className="font-semibold" style={{ color: "#1e2535" }}>
                        {new Date(selectedBooking.course_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {selectedBooking.model_time_slot && !selectedBooking.is_waitlist && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>Time Slot:</span>
                      <span className="font-semibold" style={{ color: "#1e2535" }}>{selectedBooking.model_time_slot}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(30,37,53,0.6)" }}>Treatment Type:</span>
                    <span className="font-semibold capitalize" style={{ color: "#1e2535" }}>{selectedBooking.treatment_type}</span>
                  </div>
                  {selectedBooking.gfe_completed_at && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>GFE Status:</span>
                      <span className="font-semibold flex items-center gap-1" style={{ color: "#5a7a20" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    </div>
                  )}
                  {selectedBooking.payment_status === "completed" && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(30,37,53,0.6)" }}>Payment:</span>
                      <span className="font-semibold" style={{ color: "#5a7a20" }}>$50 Paid</span>
                    </div>
                  )}
                </div>

                {/* Confirmation Code */}
                <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "rgba(30,37,53,0.5)" }}>BOOKING ID</p>
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-sm" style={{ color: "#1e2535" }}>{selectedBooking.id.slice(0, 8)}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedBooking.id)}
                      className="p-1.5 rounded hover:bg-gray-100 transition"
                    >
                      <Copy className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />
                    </button>
                  </div>
                </div>

                {/* Next Steps */}
                {!selectedBooking.gfe_completed_at && selectedBooking.status !== "cancelled" && (
                  <div className="p-3 rounded-lg" style={{ background: "rgba(45,107,127,0.08)", border: "1px solid rgba(45,107,127,0.2)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "#2D6B7F" }}>Next: Complete GFE</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(30,37,53,0.6)" }}>
                      A Good Faith Exam is required before training. Check your email for the GFE link from our admin team.
                    </p>
                  </div>
                )}

                {/* Actions */}
                {selectedBooking.status !== "cancelled" && selectedBooking.status !== "attended" && (
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => handleCancel(selectedBooking)}
                      disabled={cancelling}
                      variant="outline"
                      className="w-full rounded-lg"
                      style={{ borderColor: "#DA6A63", color: "#DA6A63" }}
                    >
                      {cancelling ? "Cancelling..." : "Cancel Booking"}
                    </Button>
                    <p className="text-xs text-center" style={{ color: "rgba(30,37,53,0.45)" }}>
                      Refund will be processed within 3-5 business days
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => setSelectedBooking(null)}
                  className="w-full rounded-lg"
                  style={{ background: "#C8E63C", color: "#1a2540" }}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}