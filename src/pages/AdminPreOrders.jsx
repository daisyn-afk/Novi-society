import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { coursePaymentsAdminApi } from "@/api/coursePaymentsAdminApi";
import { migratedUsersAdminApi } from "@/api/migratedUsersAdminApi";
import { PasswordSetupStatusBadge } from "@/components/admin/PasswordSetupTracking";
import { isPasswordSetupComplete, SHOW_ADMIN_PASSWORD_RESET_UI } from "@/lib/passwordSetupStatus";
import { CheckCircle2, XCircle, Clock, Mail, ChevronDown, ChevronUp, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const STATUS_COLORS = {
  pending_approval: { bg: "rgba(250,111,48,0.15)", color: "#FA6F30", label: "Pending Approval" },
  approved: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Approved" },
  payment_link_sent: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Signup Link Sent" },
  signup_link_sent: { bg: "rgba(123,142,200,0.15)", color: "#7B8EC8", label: "Signup Link Sent" },
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

const PAID_STATUSES = new Set(["paid", "confirmed", "completed"]);

const SIGNUP_LINK_SENT_STATUSES = new Set(["signup_link_sent", "payment_link_sent", "approved"]);

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

function PreOrderRow({ order, onApprove, onReject, onSendPasswordReset, isProcessing, isSendingPasswordReset }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isPending = order.status === "pending_approval";
  const isPaid = PAID_STATUSES.has(order.status);
  const awaitingSignup = SIGNUP_LINK_SENT_STATUSES.has(order.status);
  const canExpand = !isPaid;
  const passwordAlreadySet = isPasswordSetupComplete(order.password_setup_status);
  const canResendSignupLink = awaitingSignup && !passwordAlreadySet;

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(30,37,53,0.1)" }}>
      {/* Row header */}
      <div
        className={`flex items-center gap-4 px-5 py-4${canExpand ? " cursor-pointer hover:bg-white/5 transition-colors" : ""}`}
        onClick={canExpand ? () => setExpanded((e) => !e) : undefined}
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={
          canExpand
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }
            : undefined
        }
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <p className="font-semibold text-sm truncate" style={{ color: "#1e2535" }}>{order.customer_name}</p>
            <StatusBadge status={order.status} />
            {SHOW_ADMIN_PASSWORD_RESET_UI && isPaid ? (
              <PasswordSetupStatusBadge status={order.password_setup_status} showNotSent />
            ) : null}
            {isPending && (
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(250,111,48,0.25)", color: "#FA6F30", borderRadius: 20, padding: "2px 8px", border: "1px solid rgba(250,111,48,0.4)" }}>
                ACTION NEEDED
              </span>
            )}
          </div>
          <p className="text-xs truncate" style={{ color: "rgba(30,37,53,0.55)" }}>
            {isPaid
              ? order.customer_email
              : (
                <>
                  {order.customer_email} · {order.order_type === "course" ? order.course_title : order.service_name}
                  {order.course_date
                    ? ` · ${new Date(order.course_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </>
              )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: "#1e2535" }}>${order.amount_paid?.toLocaleString() || "—"}</span>
          <span className="text-xs" style={{ color: "rgba(30,37,53,0.4)" }}>
            {order.created_date ? format(new Date(order.created_date), "MMM d, yyyy") : ""}
          </span>
          {canExpand
            ? expanded
              ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />
              : <ChevronDown className="w-4 h-4" style={{ color: "rgba(30,37,53,0.4)" }} />
            : null}
        </div>
      </div>

      {/* Expanded detail (not shown for paid enrollments) */}
      {canExpand && expanded && (
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
              {order.payment_link_sent_at && ` · Signup link sent ${format(new Date(order.payment_link_sent_at), "MMM d")}`}
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
                Approve & Send Sign up link
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
                  disabled={isProcessing || !rejectionReason.trim()}
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

          {canResendSignupLink && (
            <Button
              onClick={() => onApprove(order.id)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(123,142,200,0.2)", color: "#7B8EC8", border: "1px solid rgba(123,142,200,0.3)" }}
            >
              <Send className="w-4 h-4" />
              Resend Sign up link
            </Button>
          )}

          {awaitingSignup && passwordAlreadySet && (
            <p className="text-xs font-semibold" style={{ color: "#2d5016" }}>
              Provider registered — they can sign in at login
            </p>
          )}

          {SHOW_ADMIN_PASSWORD_RESET_UI && isPaid && order.customer_email && (
            <div
              className="flex flex-wrap items-center gap-3 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              {passwordAlreadySet ? (
                <p className="text-xs font-semibold" style={{ color: "#2d5016" }}>
                  Password already set — user can sign in at login
                </p>
              ) : (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSendPasswordReset(order);
                  }}
                  disabled={isSendingPasswordReset}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(45,107,127,0.12)", color: "#2D6B7F", border: "1px solid rgba(45,107,127,0.35)" }}
                >
                  <Mail className="w-4 h-4" />
                  {isSendingPasswordReset ? "Sending…" : "Send Password Reset Email"}
                </Button>
              )}
              {!passwordAlreadySet && order.password_reset_email_sent_at ? (
                <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
                  Last sent {format(new Date(order.password_reset_email_sent_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoursePaymentRow({ row, onSendPasswordReset, isSendingPasswordReset }) {
  const emailSent = Boolean(row.confirmation_email_sent);
  const passwordAlreadySet = isPasswordSetupComplete(row.password_setup_status);
  const amount = Number(row.amount_total ?? 0);
  const currency = String(row.currency || "usd").toUpperCase();
  const formatted =
    currency === "USD"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
      : `${amount.toFixed(2)} ${currency}`;

  const email = row.customer_email || "—";
  const course = row.course_title || "Course";

  return (
    <div
      className="rounded-2xl mb-3 flex items-center justify-between gap-4 px-5 py-3.5 font-sans"
      style={{
        background: "linear-gradient(90deg, rgba(255,255,255,0.82) 0%, rgba(248,252,235,0.88) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.65)",
        boxShadow: "0 2px 14px rgba(30,37,53,0.06)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight truncate font-normal" style={{ color: "#1e2535" }}>
          {row.customer_name || "—"}
        </p>
        <p className="text-xs mt-0.5 leading-tight" style={{ color: "rgba(30,37,53,0.58)" }}>
          <span className="break-words">{email}</span>
          <span style={{ color: "rgba(30,37,53,0.35)" }}> · </span>
          <span className="break-words">{course}</span>
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <p className="text-sm font-bold tabular-nums leading-none whitespace-nowrap" style={{ color: "#1e2535" }}>
          {formatted}
        </p>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
          style={
            emailSent
              ? { background: "rgba(200, 230, 60, 0.5)", color: "#2d5016", border: "1px solid rgba(175, 205, 50, 0.55)" }
              : { background: "rgba(250, 111, 48, 0.18)", color: "#c45a30", border: "1px solid rgba(250, 111, 48, 0.35)" }
          }
        >
          {emailSent ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
              Email Sent
            </>
          ) : (
            <>Pending</>
          )}
        </span>
        {SHOW_ADMIN_PASSWORD_RESET_UI ? (
          <>
            <PasswordSetupStatusBadge status={row.password_setup_status} showNotSent />
            {passwordAlreadySet ? (
              <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "#2d5016" }}>
                Password set
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSendingPasswordReset || !row.customer_email}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSendPasswordReset(row);
                }}
                className="h-8 px-3 text-xs font-semibold rounded-full shrink-0"
                style={{ borderColor: "rgba(45,107,127,0.35)", color: "#2D6B7F", background: "rgba(255,255,255,0.85)" }}
              >
                <Mail className="w-3.5 h-3.5 mr-1" />
                {isSendingPasswordReset ? "Sending…" : "Send Email"}
              </Button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPreOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("applications");
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const { data: preOrders = [], isLoading } = useQuery({
    queryKey: ["pre-orders"],
    queryFn: () => base44.entities.PreOrder.list("-created_date", 200),
    enabled: mainTab === "applications",
  });

  const { data: coursePayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["admin-course-payments"],
    queryFn: () => coursePaymentsAdminApi.list(500),
    enabled: mainTab === "course_payments",
  });

  const [sendingPasswordResetId, setSendingPasswordResetId] = useState(null);

  const passwordResetMutation = useMutation({
    mutationFn: ({ email, customer_name }) =>
      migratedUsersAdminApi.sendPasswordReset({ email, customer_name }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pre-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-course-payments"] });
      toast({
        title: "Password reset email sent",
        description: `Reset link sent to ${variables.email}. They can set a password and sign in as a provider.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Could not send email",
        description: err?.message || "Request failed. Restart npm run dev if the admin API was updated recently.",
        variant: "destructive",
      });
    },
    onSettled: () => setSendingPasswordResetId(null),
  });

  const handleSendPasswordReset = (record) => {
    const email = record.customer_email;
    if (!email) return;
    if (isPasswordSetupComplete(record.password_setup_status)) {
      toast({
        title: "Password already set",
        description: `${email} has already created a password and can sign in.`,
        variant: "destructive",
      });
      return;
    }
    const rowKey = record.id || email;
    setSendingPasswordResetId(rowKey);
    passwordResetMutation.mutate({
      email,
      customer_name: record.customer_name,
      frontend_origin: typeof window !== "undefined" ? window.location.origin : "",
    });
  };

  const actionMutation = useMutation({
    mutationFn: ({ pre_order_id, action, rejection_reason }) =>
      base44.functions.invoke("approvePreOrder", {
        pre_order_id,
        action,
        rejection_reason,
        frontend_origin: typeof window !== "undefined" ? window.location.origin : "",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pre-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-course-payments"] });
      toast({
        title: variables.action === "approve" ? "Signup link sent" : "Application rejected",
        description:
          variables.action === "approve"
            ? "The provider will receive an email with their registration link."
            : "The applicant has been notified by email.",
      });
    },
    onError: (err, variables) => {
      toast({
        title: variables.action === "approve" ? "Could not send signup link" : "Could not reject application",
        description: err?.message || "Request failed. Restart npm run dev if the admin API was updated recently.",
        variant: "destructive",
      });
    },
  });

  const signupLinkSentCount = preOrders.filter((o) => SIGNUP_LINK_SENT_STATUSES.has(o.status)).length;

  const filtered = statusFilter === "all"
    ? preOrders
    : statusFilter === "paid"
      ? preOrders.filter((o) => PAID_STATUSES.has(o.status))
      : statusFilter === "signup_link_sent"
        ? preOrders.filter((o) => SIGNUP_LINK_SENT_STATUSES.has(o.status))
        : preOrders.filter((o) => o.status === statusFilter);

  const pendingCount = preOrders.filter(o => o.status === "pending_approval").length;

  const tabs = [
    { value: "pending_approval", label: "Pending Approval", count: pendingCount },
    { value: "signup_link_sent", label: "Signup Link Sent", count: signupLinkSentCount },
    { value: "paid", label: "Paid" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="space-y-6 max-w-5xl w-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(218,106,99,0.9)", letterSpacing: "0.14em" }}>Admin</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#1e2535", lineHeight: 1.15 }}>Pre-Order Applications</h1>
        <p style={{ color: "rgba(30,37,53,0.58)", fontSize: 13, marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
          Review and approve course & service enrollment applications from the landing page
        </p>
      </div>

      {/* Applications vs Course Payments — no bar background; only each pill is filled */}
      <div className="inline-flex gap-2 flex-wrap font-sans">
        {[
          { id: "applications", label: "Applications", Icon: Clock },
          { id: "course_payments", label: "Course Payments", Icon: Wallet },
        ].map((t) => {
          const active = mainTab === t.id;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className="inline-flex items-center gap-2 pl-3.5 pr-4 py-2 rounded-full text-[13px] font-bold transition-colors duration-150"
              style={
                active
                  ? {
                      background: "rgba(200, 230, 60, 0.72)",
                      color: "#24330a",
                      border: "1px solid rgba(168, 198, 48, 0.65)",
                      boxShadow: "0 1px 4px rgba(200, 230, 60, 0.35)",
                    }
                  : {
                      background: "rgba(255, 255, 255, 0.55)",
                      color: "rgba(30, 37, 53, 0.65)",
                      border: "1px solid rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(8px)",
                    }
              }
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {mainTab === "applications" && (
        <>
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pending Approval", value: preOrders.filter(o => o.status === "pending_approval").length, color: "#FA6F30" },
          { label: "Signup Link Sent", value: signupLinkSentCount, color: "#7B8EC8" },
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
              isSendingPasswordReset={sendingPasswordResetId === order.id && passwordResetMutation.isPending}
              onSendPasswordReset={handleSendPasswordReset}
              onApprove={(id) => actionMutation.mutate({ pre_order_id: id, action: "approve" })}
              onReject={(id, reason) => actionMutation.mutate({ pre_order_id: id, action: "reject", rejection_reason: reason })}
            />
          ))}
        </div>
      )}
        </>
      )}

      {mainTab === "course_payments" && (
        <div className="space-y-3 font-sans">
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "rgba(30,37,53,0.52)" }}
          >
            All payments ({coursePayments.length})
          </h2>
          {loadingPayments ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "rgba(30,37,53,0.1)", borderTopColor: "#C8E63C" }} />
            </div>
          ) : coursePayments.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(30,37,53,0.04)", border: "1px solid rgba(30,37,53,0.08)" }}>
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#1e2535" }} />
              <p style={{ color: "rgba(30,37,53,0.4)" }}>No course payments recorded yet</p>
            </div>
          ) : (
            <div>
              {coursePayments.map((row) => (
                <CoursePaymentRow
                  key={row.id}
                  row={row}
                  isSendingPasswordReset={sendingPasswordResetId === row.id && passwordResetMutation.isPending}
                  onSendPasswordReset={handleSendPasswordReset}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}