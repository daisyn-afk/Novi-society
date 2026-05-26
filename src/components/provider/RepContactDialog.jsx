import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Download,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { resolveRepDisplay } from "@/components/provider/SaveRepContactForm";
import {
  formatMessageTime,
  getMessageDisplayBody,
  isMessageFromProvider,
} from "@/lib/emailBodyUtils";
import {
  downloadAttachment,
  fetchGmailConnectUrl,
  fetchGmailStatus,
  fetchRepThreadPointer,
  fetchThreadMessages,
  sendGmailReply,
  startGmailThread,
} from "@/lib/gmailApi";

// First-message templates (Q9: only used when no thread exists with this rep).
const TEMPLATES = {
  order: {
    label: "Place Order Request",
    icon: Send,
    color: "#FA6F30",
    subject: () => `Order Request — NOVI Provider`,
    body: (me, mfrName) =>
`Hi ${mfrName} Team,

I'd like to place a product order. My account details are below:

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Email: ${me?.email || ""}
Phone: ${me?.phone || ""}

Products I'm interested in ordering:
[Please list products and quantities here]

I'm a verified NOVI Society provider with active MD board oversight.

Thank you,
${me?.full_name || ""}`,
  },
  message: {
    label: "Send a Message",
    icon: Mail,
    color: "#2D6B7F",
    subject: (mfrName) => `Provider Inquiry — ${mfrName}`,
    body: (me, mfrName) =>
`Hi ${mfrName} Team,

I have a question regarding my account:

[Write your message here]

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Email: ${me?.email || ""}

Thanks,
${me?.full_name || ""}`,
  },
};

function bytesLabel(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RepContactDialog({
  open,
  onClose,
  manufacturer,
  me,
  initialType,
  savedRep = null,
}) {
  const qc = useQueryClient();
  const mfrName = manufacturer?.name || "Supplier";
  const rep = resolveRepDisplay(savedRep, manufacturer);
  const repEmail = String(rep.rep_email || "").trim();
  const repName = rep.rep_name || "Account Rep";

  const close = (boolValue) => {
    onClose(typeof boolValue === "boolean" ? boolValue : false);
  };

  // ---------- Gmail status + thread pointer ----------

  const statusQuery = useQuery({
    queryKey: ["gmail-status"],
    queryFn: fetchGmailStatus,
    enabled: open,
    staleTime: 30_000,
  });

  const threadPointerQuery = useQuery({
    queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
    queryFn: () =>
      fetchRepThreadPointer({
        repEmail,
        manufacturerId: manufacturer?.id || null,
      }),
    enabled:
      open &&
      Boolean(repEmail) &&
      Boolean(statusQuery.data?.gmail_connected),
    staleTime: 30_000,
  });

  const threadId = threadPointerQuery.data?.thread?.thread_id || null;

  const threadMessagesQuery = useQuery({
    queryKey: ["gmail-thread-messages", threadId],
    queryFn: () => fetchThreadMessages(threadId),
    enabled: open && Boolean(threadId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  // ---------- Mutations ----------

  const startThreadMutation = useMutation({
    mutationFn: ({ subject, body }) =>
      startGmailThread({
        repEmail,
        subject,
        body,
        manufacturerId: manufacturer?.id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ body }) =>
      sendGmailReply(threadId, body, { repEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmail-thread-messages", threadId] });
    },
  });

  const connectMutation = useMutation({
    mutationFn: fetchGmailConnectUrl,
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  // ---------- First-message compose state ----------

  const [type, setType] = useState(initialType || "order");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const wasOpenRef = useRef(false);

  // Reset compose fields only when the dialog opens — not on every parent
  // re-render while it stays open (e.g. react-query refetching `me`).
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const t = initialType || "order";
    setType(t);
    setSubject(TEMPLATES[t].subject(mfrName));
    setBody(TEMPLATES[t].body(me, mfrName));
    setReplyBody("");
    startThreadMutation.reset();
    replyMutation.reset();
  }, [open, initialType, mfrName, me, startThreadMutation, replyMutation]);

  const selectType = (t) => {
    setType(t);
    setSubject(TEMPLATES[t].subject(mfrName));
    setBody(TEMPLATES[t].body(me, mfrName));
  };

  // ---------- Render branches ----------

  const status = statusQuery.data;
  const gmailConnected = Boolean(status?.gmail_connected);
  const googleConnected = Boolean(status?.google_connected);
  const messages = threadMessagesQuery.data?.messages || [];
  const hasThread = Boolean(threadId);

  const headerTitle = (
    <DialogTitle
      style={{
        fontFamily: "'DM Serif Display', serif",
        fontWeight: 400,
      }}
    >
      {hasThread ? "Conversation with" : "Contact"} {repName || `${mfrName} Rep`}
    </DialogTitle>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => close(v ? open : false)}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-slate-100">
          {headerTitle}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {!repEmail ? (
          <NoRepEmailNotice />
        ) : statusQuery.isLoading ? (
          <LoadingPanel label="Checking your Gmail connection…" />
        ) : !gmailConnected ? (
          <ConnectGmailCTA
            googleConnected={googleConnected}
            providerEmail={me?.email || ""}
            onConnect={() => connectMutation.mutate()}
            connecting={connectMutation.isPending}
          />
        ) : threadPointerQuery.isLoading ? (
          <LoadingPanel label="Looking up your conversation with this rep…" />
        ) : !hasThread ? (
          <FirstMessageCompose
            repEmail={repEmail}
            repName={repName}
            type={type}
            subject={subject}
            body={body}
            onSelectType={selectType}
            onSubject={setSubject}
            onBody={setBody}
            sending={startThreadMutation.isPending}
            sent={startThreadMutation.isSuccess}
            error={startThreadMutation.error?.message || ""}
            onSend={() => startThreadMutation.mutate({ subject, body })}
            onReset={() => startThreadMutation.reset()}
            onClose={() => close(false)}
          />
        ) : (
          <ThreadView
            repEmail={repEmail}
            repName={repName}
            providerEmail={me?.email || status?.google_email || ""}
            messages={messages}
            threadId={threadId}
            loading={threadMessagesQuery.isLoading}
            refreshing={threadMessagesQuery.isFetching}
            onRefresh={() =>
              qc.invalidateQueries({
                queryKey: ["gmail-thread-messages", threadId],
              })
            }
            replyBody={replyBody}
            onReplyBody={setReplyBody}
            sending={replyMutation.isPending}
            error={replyMutation.error?.message || ""}
            onSendReply={() => {
              const trimmed = replyBody.trim();
              if (!trimmed) return;
              replyMutation.mutate(
                { body: trimmed },
                { onSuccess: () => setReplyBody("") }
              );
            }}
            onClose={() => close(false)}
          />
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Sub-views ----------

function NoRepEmailNotice() {
  return (
    <div className="py-8 text-center space-y-3">
      <Mail
        className="w-9 h-9 mx-auto"
        style={{ color: "rgba(30,37,53,0.4)" }}
      />
      <p className="font-semibold text-slate-900">No rep email on file</p>
      <p className="text-sm" style={{ color: "rgba(30,37,53,0.55)" }}>
        Save this supplier&rsquo;s rep contact before messaging.
      </p>
    </div>
  );
}

function LoadingPanel({ label }) {
  return (
    <div className="py-10 text-center text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>
      <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" style={{ color: "#7B8EC8" }} />
      {label}
    </div>
  );
}

function ConnectGmailCTA({ googleConnected, providerEmail, onConnect, connecting }) {
  return (
    <div className="py-8 text-center space-y-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
        style={{ background: "rgba(123,142,200,0.12)" }}
      >
        <ShieldCheck className="w-7 h-7" style={{ color: "#7B8EC8" }} />
      </div>
      <div>
        <p
          className="font-bold text-lg"
          style={{
            fontFamily: "'DM Serif Display', serif",
            color: "#1e2535",
          }}
        >
          Connect Gmail to message your reps
        </p>
        <p
          className="text-sm mt-2 max-w-md mx-auto leading-relaxed"
          style={{ color: "rgba(30,37,53,0.6)" }}
        >
          Messages are sent from your Gmail{providerEmail ? ` (${providerEmail})` : ""} and
          show up in your real inbox &mdash; not from a NOVI no-reply address.
          {googleConnected
            ? " Adds Gmail messaging to your existing Google connection."
            : " You'll be redirected to Google to grant access."}
        </p>
      </div>
      <Button
        onClick={onConnect}
        disabled={connecting}
        className="font-bold"
        style={{ background: "#1e2535", color: "#fff" }}
      >
        {connecting ? "Opening Google…" : "Connect Gmail"}
      </Button>
    </div>
  );
}

function FirstMessageCompose({
  repEmail,
  repName,
  type,
  subject,
  body,
  onSelectType,
  onSubject,
  onBody,
  sending,
  sent,
  error,
  onSend,
  onReset,
  onClose,
}) {
  if (sent) {
    return (
      <div className="text-center py-8 space-y-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "rgba(200,230,60,0.2)" }}
        >
          <CheckCircle className="w-7 h-7" style={{ color: "#4a6b10" }} />
        </div>
        <div>
          <p
            className="font-bold text-lg"
            style={{ fontFamily: "'DM Serif Display', serif", color: "#1e2535" }}
          >
            Message Sent!
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>
            Sent to {repEmail} from your Gmail. Reopen to see the thread.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onReset}>
            Send another
          </Button>
          <Button
            onClick={onClose}
            style={{ background: "#1e2535", color: "#fff" }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "rgba(123,142,200,0.08)",
          border: "1px solid rgba(123,142,200,0.15)",
        }}
      >
        <Mail
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "#7B8EC8" }}
        />
        <div>
          <p className="text-xs font-bold" style={{ color: "#1e2535" }}>
            {repName || "Account Rep"}
          </p>
          <p className="text-xs" style={{ color: "rgba(30,37,53,0.5)" }}>
            {repEmail}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(TEMPLATES).map(([key, tpl]) => {
          const Icon = tpl.icon;
          const active = type === key;
          return (
            <button
              key={key}
              onClick={() => onSelectType(key)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: active ? `${tpl.color}18` : "rgba(30,37,53,0.04)",
                border: `1.5px solid ${
                  active ? `${tpl.color}50` : "rgba(30,37,53,0.1)"
                }`,
                color: active ? tpl.color : "rgba(30,37,53,0.5)",
              }}
            >
              <Icon className="w-4 h-4" />
              {tpl.label}
            </button>
          );
        })}
      </div>

      <div>
        <label
          className="text-xs font-semibold mb-1 block"
          style={{ color: "rgba(30,37,53,0.55)" }}
        >
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => onSubject(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(30,37,53,0.12)",
            color: "#1e2535",
          }}
        />
      </div>

      <div>
        <label
          className="text-xs font-semibold mb-1 block"
          style={{ color: "rgba(30,37,53,0.55)" }}
        >
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={10}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none font-mono"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(30,37,53,0.12)",
            color: "#1e2535",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        />
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "#DA6A63" }}>
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 gap-2 font-bold"
          disabled={!repEmail || sending || !subject.trim() || !body.trim()}
          style={{ background: TEMPLATES[type].color, color: "#fff" }}
          onClick={onSend}
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? "Sending…" : "Send Message"}
        </Button>
      </div>
    </div>
  );
}

function ThreadView({
  repEmail,
  repName,
  providerEmail,
  messages,
  threadId,
  loading,
  refreshing,
  onRefresh,
  replyBody,
  onReplyBody,
  sending,
  error,
  onSendReply,
  onClose,
}) {
  const chatRef = useRef(null);
  const subject = useMemo(() => {
    const raw = messages[0]?.subject || "(no subject)";
    return raw.replace(/^re:\s*/i, "").trim() || raw;
  }, [messages]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  return (
    <div className="flex flex-col min-h-[420px]">
      {/* Thread meta */}
      <div
        className="rounded-xl px-3 py-2.5 mb-3 shrink-0"
        style={{
          background: "rgba(123,142,200,0.08)",
          border: "1px solid rgba(123,142,200,0.15)",
        }}
      >
        <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>
          {subject}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.55)" }}>
          With {repName} · {repEmail}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-3 text-[11px]" style={{ color: "rgba(30,37,53,0.5)" }}>
          <span className="inline-flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "#2D6B7F" }}
            />
            You
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "#E8ECF4", border: "1px solid rgba(30,37,53,0.12)" }}
            />
            {repName.split(" ")[0] || "Rep"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-1 h-7 px-2 text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 min-h-[220px] max-h-[340px] overflow-y-auto rounded-xl px-2 py-3 space-y-3"
        style={{
          background: "rgba(30,37,53,0.03)",
          border: "1px solid rgba(30,37,53,0.08)",
        }}
      >
        {loading && messages.length === 0 ? (
          <LoadingPanel label="Loading messages…" />
        ) : messages.length === 0 ? (
          <p
            className="text-center text-sm py-8"
            style={{ color: "rgba(30,37,53,0.55)" }}
          >
            No messages yet. Send a reply below.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              threadId={threadId}
              providerEmail={providerEmail}
              repName={repName}
            />
          ))
        )}
      </div>

      {/* Reply box — pinned at bottom */}
      <div
        className="mt-3 pt-3 shrink-0 space-y-2"
        style={{ borderTop: "1px solid rgba(30,37,53,0.08)" }}
      >
        <label
          className="text-xs font-semibold block"
          style={{ color: "rgba(30,37,53,0.55)" }}
        >
          Your reply
        </label>
        <textarea
          value={replyBody}
          onChange={(e) => onReplyBody(e.target.value)}
          rows={3}
          placeholder={`Message ${repName.split(" ")[0] || "rep"}…`}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{
            background: "#fff",
            border: "1px solid rgba(30,37,53,0.12)",
            color: "#1e2535",
            lineHeight: 1.55,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSendReply();
            }
          }}
        />
        {error ? (
          <p className="text-xs" style={{ color: "#DA6A63" }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1 gap-2 font-bold"
            disabled={sending || !replyBody.trim()}
            style={{ background: "#2D6B7F", color: "#fff" }}
            onClick={onSendReply}
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
        <p className="text-[10px] text-center" style={{ color: "rgba(30,37,53,0.4)" }}>
          Ctrl+Enter to send · Attachments open in Gmail for now
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message, threadId, providerEmail, repName }) {
  const isMine = isMessageFromProvider(message, providerEmail);
  const body = getMessageDisplayBody(message);
  const time = formatMessageTime(message.date, message.internal_date);
  const senderLabel = isMine ? "You" : repName || "Rep";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm"
        style={
          isMine
            ? {
                background: "#2D6B7F",
                color: "#fff",
                borderBottomRightRadius: 6,
              }
            : {
                background: "#fff",
                color: "#1e2535",
                border: "1px solid rgba(30,37,53,0.1)",
                borderBottomLeftRadius: 6,
              }
        }
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ opacity: isMine ? 0.9 : 0.65 }}
          >
            {senderLabel}
          </span>
          <span
            className="text-[10px] whitespace-nowrap shrink-0"
            style={{ opacity: isMine ? 0.75 : 0.5 }}
          >
            {time}
          </span>
        </div>

        <p
          className="text-sm whitespace-pre-wrap break-words leading-relaxed"
          style={{ opacity: body ? 1 : 0.6 }}
        >
          {body || "(No message text)"}
        </p>

        {message.attachments?.length > 0 ? (
          <div className={`mt-2 flex flex-wrap gap-1.5 ${isMine ? "" : ""}`}>
            {message.attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                threadId={threadId}
                messageId={message.id}
                attachment={att}
                inverted={isMine}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentChip({ threadId, messageId, attachment, inverted = false }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await downloadAttachment({ threadId, messageId, attachment });
    } catch (err) {
      window.alert(err?.message || "Could not download attachment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition"
      style={
        inverted
          ? {
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
            }
          : {
              background: "rgba(123,142,200,0.1)",
              border: "1px solid rgba(123,142,200,0.2)",
              color: "#2D6B7F",
            }
      }
    >
      {busy ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <Paperclip className="w-3 h-3" />
      )}
      <span className="max-w-[180px] truncate">{attachment.filename}</span>
      <span style={{ color: "rgba(30,37,53,0.45)" }}>
        &middot; {bytesLabel(attachment.size)}
      </span>
      <Download className="w-3 h-3" />
    </button>
  );
}
