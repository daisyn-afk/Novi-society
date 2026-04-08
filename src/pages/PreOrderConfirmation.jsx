import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Sparkles, Calendar, Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PreOrderConfirmation() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

  const { data: order } = useQuery({
    queryKey: ["preorder", orderId],
    queryFn: () => base44.entities.PreOrder.get(orderId),
    enabled: !!orderId,
  });

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-2xl text-center">
        {/* Success icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C8E63C, #a8c020)" }}>
            <CheckCircle className="w-10 h-10" style={{ color: "#1a2540" }} />
          </div>
        </div>

        <div className="rounded-3xl overflow-hidden mb-8" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.22)" }}>
          <div className="px-8 py-10">
            <h1 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>
              You're on the list!
            </h1>
            <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.7)" }}>
              Your pre-launch reservation has been confirmed.
            </p>

            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: "#C8E63C" }} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>Reserved</p>
                  <p className="text-white font-semibold">{order.order_type === "course" ? order.course_title : order.service_name}</p>
                </div>
              </div>

              {order.course_date && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: "#7B8EC8" }} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>Date</p>
                    <p className="text-white font-semibold">{new Date(order.course_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 px-5 py-4 rounded-xl" style={{ background: "rgba(255,255,255,0.1)" }}>
                <Mail className="w-5 h-5 flex-shrink-0" style={{ color: "#DA6A63" }} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>Confirmation sent to</p>
                  <p className="text-white font-semibold">{order.customer_email}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 px-6 py-5 rounded-2xl" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.3)" }}>
              <p className="text-sm font-semibold text-white mb-2">What happens next?</p>
              <ul className="text-sm space-y-2 text-left" style={{ color: "rgba(255,255,255,0.7)" }}>
                <li>✓ You'll receive a confirmation email shortly</li>
                <li>✓ We'll notify you 2 weeks before launch with payment details</li>
                <li>✓ Early access to the NOVI Society platform before public release</li>
                <li>✓ Priority enrollment for in-person training sessions</li>
              </ul>
            </div>
          </div>
        </div>

        <button onClick={() => navigate(createPageUrl("NoviLanding"))} className="flex items-center gap-2 mx-auto text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Return to NOVI Society
        </button>
      </div>
    </div>
  );
}