import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Calendar, Clock, ExternalLink, Video } from "lucide-react";

export default function UpcomingRepCalls({ manufacturerId }) {
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["provider-rep-calls", manufacturerId],
    queryFn: async () => {
      const rows = await base44.entities.ProviderRepCall.filter({
        manufacturer_id: manufacturerId,
        upcoming: true,
      });
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!manufacturerId,
  });

  if (isLoading || calls.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: "2px solid #1e2535",
        boxShadow: "0 4px 20px rgba(30,37,53,0.12)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: "linear-gradient(135deg, #1e2535 0%, #2a3355 100%)" }}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" style={{ color: "#C8E63C" }} />
          <p
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: "#fff", letterSpacing: "0.16em" }}
          >
            Upcoming Calls
          </p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: "#C8E63C", color: "#1e2535" }}
        >
          {calls.length}
        </span>
      </div>

      <div className="px-3 py-3 space-y-2.5" style={{ background: "#fff" }}>
        {calls.slice(0, 3).map((call) => (
          <div
            key={call.id}
            className="rounded-xl px-3.5 py-3"
            style={{
              background: "rgba(123,142,200,0.12)",
              border: "1.5px solid rgba(74,95,160,0.35)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="text-[15px] font-bold leading-snug truncate"
                  style={{ color: "#1e2535" }}
                >
                  {call.topic || "Rep call"}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md"
                    style={{ background: "#fff", color: "#1e2535", border: "1px solid rgba(30,37,53,0.15)" }}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "#4a5fa0" }} />
                    {call.scheduled_at ? format(new Date(call.scheduled_at), "EEE, MMM d · h:mm a") : "—"}
                  </span>
                  {call.duration_minutes ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md"
                      style={{ background: "#1e2535", color: "#C8E63C" }}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {call.duration_minutes} min
                    </span>
                  ) : null}
                </div>
              </div>

              {call.meet_link ? (
                <a
                  href={call.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #FA6F30, #e05a20)",
                    color: "#fff",
                    boxShadow: "0 3px 10px rgba(250,111,48,0.35)",
                  }}
                >
                  <Video className="w-3.5 h-3.5" />
                  Join Meet
                  <ExternalLink className="w-3 h-3 opacity-90" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
