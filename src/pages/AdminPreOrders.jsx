import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, Clock, Mail, AlertTriangle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const STATUS_COLORS = {
  pending_approval: { bg: "rgba(250,111,48,0.15)", color: "#FA6F30", label: "Pending Approval" },
  approved: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Approved" },
  payment_link_sent: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Payment Link Sent" },
  pending_payment: { bg: "rgba(250,111,48,0.15)", color: "#FA6F30", label: "Pending Payment" },
  paid: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20", label: "Paid" },
  confirmed: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20", label: "Confirmed" },
  completed: { bg: "rgba(200,230,60,0.15)", color: "#a8cc20", label: "Completed" },
  cancelled: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63", label: "Cancelled" },
  rejected: { bg: "rgba(218,106,99,0.15)", color: "#DA6A63", label: "Rejected" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function getFileTypeFromUrl(url) {
  if (!url) return "unknown";
  const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
  const lowerUrl = url.toLowerCase();
  if (cleanUrl.endsWith(".pdf")) return "pdf";
  if (lowerUrl.includes("pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(cleanUrl)) return "image";
  return "unknown";
}

function DocumentPreview({ label, url }) {
  if (!url) return null;

  const fileType = getFileTypeFromUrl(url);
  const isImage = fileType === "image";

  return (
    <div
      className={isImage ? "p-3 rounded-xl" : ""}
      style={isImage ? { background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.1)" } : undefined}
    >
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.45)" }}>{label}</p>

      {isImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            className="w-full max-h-60 object-cover rounded-lg border"
            style={{ borderColor: "rgba(30,37,53,0.15)" }}
          />
        </a>
      ) : (
        <Button
          asChild
          variant="outline"
          className="text-sm font-semibold w-fit"
          style={{ borderColor: "rgba(123,142,200,0.55)", color: "#5f73b3", background: "rgba(123,142,200,0.2)" }}
        >
          <a href={url} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </Button>
      )}
    </div>
  );
}

function PreOrderRow({ order, onApprove, onReject, isProcessing }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isPending = order.status === "pending_approval";

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
      {/* Row header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{order.customer_name}</p>
            <StatusBadge status={order.status} />
            {isPending && (
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(250,111,48,0.25)", color: "#FA6F30", borderRadius: 20, padding: "2px 8px", border: "1px solid rgba(250,111,48,0.4)" }}>
                ACTION NEEDED
              </span>
            )}
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.55)" }}>
            {order.customer_email} · {order.order_type === "course" ? order.course_title : order.service_name}
            {order.course_date ? ` · ${new Date(order.course_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: "#1e2535" }}>${order.amount_paid?.toLocaleString() || "—"}</span>
          <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
            {order.created_date ? format(new Date(order.created_date), "MMM d, yyyy") : ""}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(30,37,53,0.08)" }}>
          <div className="grid sm:grid-cols-3 gap-4 mt-4 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>License</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{order.license_type || "—"}</p>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>{order.license_number} · {order.license_state || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Phone</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{order.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Course / Service</p>
              <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>{order.course_title || order.service_name}</p>
              {order.course_date && (
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.55)" }}>
                  {new Date(order.course_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>

          {(order.license_image_url || order.certification_document_url) && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(30,37,53,0.4)" }}>Submitted Documents</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <DocumentPreview label="License Photo" url={order.license_image_url} />
                <DocumentPreview label="Certification Document" url={order.certification_document_url} />
              </div>
            </div>
          )}

          {order.notes && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(30,37,53,0.05)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(30,37,53,0.4)" }}>Notes from applicant</p>
            <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{order.notes}</p>
            </div>
          )}

          {order.rejection_reason && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(218,106,99,0.08)", border: "1px solid rgba(218,106,99,0.2)" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#DA6A63" }}>Rejection Reason</p>
              <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>{order.rejection_reason}</p>
            </div>
          )}

          {order.approved_by && (
            <p className="text-xs mb-4" style={{ color: "rgba(30,37,53,0.45)" }}>
              Approved by {order.approved_by} · {order.approved_at ? format(new Date(order.approved_at), "MMM d, yyyy 'at' h:mm a") : ""}
              {order.payment_link_sent_at && ` · Payment link sent ${format(new Date(order.payment_link_sent_at), "MMM d")}`}
            </p>
          )}

          {/* Actions */}
          {isPending && !showRejectForm && (
            <div className="flex gap-3">
              <Button
                onClick={() => onApprove(order.id)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
                style={{ background: "#C8E63C", color: "#1a2540", border: "none" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve & Send Payment Link
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                variant="outline"
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ border: "1px solid rgba(218,106,99,0.4)", color: "#DA6A63", background: "transparent" }}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
            </div>
          )}

          {isPending && showRejectForm && (
            <div className="space-y-3">
              <Textarea
                placeholder="Reason for rejection (will be included in email to applicant)..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={3}
                className="rounded-xl text-sm resize-none"
                style={{ background: "rgba(30,37,53,0.05)", border: "1px solid rgba(30,37,53,0.15)", color: "#1e2535" }}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => onReject(order.id, rejectionReason)}
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl text-sm font-bold"
                  style={{ background: "#DA6A63", color: "#fff", border: "none" }}
                >
                  Confirm Rejection
                </Button>
                <Button
                  onClick={() => setShowRejectForm(false)}
                  variant="ghost"
                  className="px-5 py-2 rounded-xl text-sm"
                  style={{ color: "rgba(30,37,53,0.5)" }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(order.status === "payment_link_sent" || order.status === "approved") && (
            <Button
              onClick={() => onApprove(order.id)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(123,142,200,0.2)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.3)" }}
            >
              <Send className="w-4 h-4" />
              Resend Payment Link
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPreOrders() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending_approval");

  const { data: preOrders = [], isLoading } = useQuery({
    queryKey: ["pre-orders"],
    queryFn: () => base44.entities.PreOrder.list("-created_date", 200),
  });

  const actionMutation = useMutation({
    mutationFn: ({ pre_order_id, action, rejection_reason }) =>
      base44.functions.invoke("approvePreOrder", { pre_order_id, action, rejection_reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pre-orders"] }),
  });

  const filtered = statusFilter === "all"
    ? preOrders
    : preOrders.filter(o => o.status === statusFilter);

  const pendingCount = preOrders.filter(o => o.status === "pending_approval").length;

  const tabs = [
    { value: "pending_approval", label: "Pending Approval", count: pendingCount },
    { value: "payment_link_sent", label: "Awaiting Payment" },
    { value: "paid", label: "Paid" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="space-y-6 max-w-5xl w-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)", letterSpacing: "0.14em" }}>Admin</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Pre-Order Applications</h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>Review and approve course & service enrollment applications from the landing page</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pending Approval", value: preOrders.filter(o => o.status === "pending_approval").length, color: "#FA6F30" },
          { label: "Awaiting Payment", value: preOrders.filter(o => o.status === "payment_link_sent").length, color: "#7B8EC8" },
          { label: "Paid", value: preOrders.filter(o => o.status === "paid" || o.status === "confirmed").length, color: "#a8cc20" },
          { label: "Total Applications", value: preOrders.length, color: "rgba(30,37,53,0.7)" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 16px rgba(30,37,53,0.07)" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: s.color, lineHeight: 1, fontWeight: 400 }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: statusFilter === tab.value ? "rgba(200,230,60,0.2)" : "rgba(30,37,53,0.07)",
              color: statusFilter === tab.value ? "#5a7a20" : "rgba(30,37,53,0.6)",
              border: statusFilter === tab.value ? "1px solid rgba(200,230,60,0.4)" : "1px solid rgba(30,37,53,0.1)",
            }}
          >
            {tab.label}{tab.count > 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(30,37,53,0.1)", borderTopColor: "#C8E63C" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#1e2535" }} />
          <p style={{ color: "rgba(30,37,53,0.4)" }}>No applications in this category</p>
        </div>
      ) : (
        <div>
          {filtered.map(order => (
            <PreOrderRow
              key={order.id}
              order={order}
              isProcessing={actionMutation.isPending}
              onApprove={(id) => actionMutation.mutate({ pre_order_id: id, action: "approve" })}
              onReject={(id, reason) => actionMutation.mutate({ pre_order_id: id, action: "reject", rejection_reason: reason })}
            />
          ))}
        </div>
      )}
    </div>
  );
}