import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, X, Calendar, Award, FileText, Users, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const NOTIF_ICONS = {
  appointment_request: Calendar,
  license_verified: FileText,
  license_rejected: FileText,
  cert_awarded: Award,
  md_relationship_approved: Users,
  md_relationship_pending: Users,
};

const NOTIF_COLORS = {
  appointment_request: "text-blue-500 bg-blue-50",
  license_verified: "text-green-500 bg-green-50",
  license_rejected: "text-red-500 bg-red-50",
  cert_awarded: "text-amber-500 bg-amber-50",
  md_relationship_approved: "text-purple-500 bg-purple-50",
  md_relationship_pending: "text-yellow-500 bg-yellow-50",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 30);
    },
    refetchInterval: 30000, // poll every 30s
  });

  const unread = notifications.filter(n => !n.read_at);

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const markAllRead = async () => {
    for (const n of unread) {
      await base44.entities.Notification.update(n.id, { read_at: new Date().toISOString() });
    }
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: "#FA6F30" }}>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Notifications</p>
              <div className="flex items-center gap-2">
                {unread.length > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = NOTIF_ICONS[n.type] || Bell;
                  const colorClass = NOTIF_COLORS[n.type] || "text-slate-500 bg-slate-50";
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read_at ? "bg-orange-50/30" : ""}`}
                      onClick={() => !n.read_at && markRead.mutate(n.id)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${n.read_at ? "text-slate-600" : "text-slate-900 font-medium"}`}>
                          {n.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {n.created_date ? format(new Date(n.created_date), "MMM d, h:mm a") : ""}
                        </p>
                      </div>
                      {!n.read_at && (
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#FA6F30" }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}