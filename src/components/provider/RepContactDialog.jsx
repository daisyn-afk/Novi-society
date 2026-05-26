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
  ChevronDown,
  Download,
  Mail,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Reply,
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

const COMPOSE_TEMPLATE = {
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
};

function bytesLabel(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function repInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return "R";
}

export default function RepContactDialog({
  open,
  onClose,
  manufacturer,
  me,
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
      setStartingNewThread(false);
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

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [startingNewThread, setStartingNewThread] = useState(false);
  const wasOpenRef = useRef(false);

  const resetComposeFields = () => {
    setSubject(COMPOSE_TEMPLATE.subject(mfrName));
    setBody(COMPOSE_TEMPLATE.body(me, mfrName));
    setReplyBody("");
  };

  const beginNewThread = () => {
    setStartingNewThread(true);
    resetComposeFields();
    startThreadMutation.reset();
  };

  // Reset compose fields only when the dialog opens — not on every parent
  // re-render while it stays open (e.g. react-query refetching `me`).
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setStartingNewThread(false);
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    resetComposeFields();
    setStartingNewThread(false);
    startThreadMutation.reset();
    replyMutation.reset();
  }, [open, mfrName, me, startThreadMutation, replyMutation]);

  // ---------- Render branches ----------

  const status = statusQuery.data;
  const gmailConnected = Boolean(status?.gmail_connected);
  const googleConnected = Boolean(status?.google_connected);
  const messages = threadMessagesQuery.data?.messages || [];
  const hasThread = Boolean(threadId);
  const showThread = hasThread && !startingNewThread;
  const showCompose = !hasThread || startingNewThread;

  return (
    <Dialog open={open} onOpenChange={(v) => close(v ? open : false)}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl shadow-2xl">
        <DialogHeader className="px-5 pt-5 pb-4 shrink-0 border-b border-slate-100/80 bg-gradient-to-b from-white to-slate-50/80">
          <RepDialogHeader
            repName={repName}
            repEmail={repEmail}
            mfrName={mfrName}
            showThread={showThread}
            startingNewThread={startingNewThread}
            refreshing={threadMessagesQuery.isFetching}
            onRefresh={() => {
              if (threadId) {
                qc.invalidateQueries({
                  queryKey: ["gmail-thread-messages", threadId],
                });
              }
            }}
            onNewThread={beginNewThread}
            showNewThread={gmailConnected && Boolean(repEmail) && hasThread}
          />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 bg-[#f6f8fb]">
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
        ) : showCompose ? (
          <FirstMessageCompose
            repEmail={repEmail}
            repName={repName}
            subject={subject}
            onSubject={setSubject}
            onBody={setBody}
            sending={startThreadMutation.isPending}
            sent={startThreadMutation.isSuccess}
            error={startThreadMutation.error?.message || ""}
            onSend={() => startThreadMutation.mutate({ subject, body })}
            onReset={() => startThreadMutation.reset()}
            onClose={() => close(false)}
            isNewThread={startingNewThread && hasThread}
            onBackToThread={
              startingNewThread && hasThread
                ? () => setStartingNewThread(false)
                : null
            }
          />
        ) : (
          <ThreadView
            repEmail={repEmail}
            repName={repName}
            providerEmail={me?.email || status?.google_email || ""}
            messages={messages}
            threadId={threadId}
            loading={threadMessagesQuery.isLoading}
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
            onNewThread={beginNewThread}
          />
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Sub-views ----------

function RepDialogHeader({
  repName,
  repEmail,
  mfrName,
  showThread,
  startingNewThread,
  refreshing,
  onRefresh,
  onNewThread,
  showNewThread,
}) {
  const title = startingNewThread
    ? "New conversation"
    : showThread
      ? `Conversation with ${repName}`
      : `Contact ${repName || `${mfrName} Rep`}`;

  return (
    <div className="flex items-start gap-3 pr-8">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-sm"
        style={{
          background: "linear-gradient(135deg, #2D6B7F 0%, #7B8EC8 100%)",
          color: "#fff",
        }}
      >
        {repInitials(repName)}
      </div>
      <div className="flex-1 min-w-0">
        <DialogTitle
          className="text-left text-lg leading-tight"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
            color: "#1e2535",
          }}
        >
          {title}
        </DialogTitle>
        {repEmail ? (
          <p
            className="text-xs mt-1 truncate"
            style={{ color: "rgba(30,37,53,0.55)" }}
            title={repEmail}
          >
            {repEmail}
            {startingNewThread ? " · separate email thread in Gmail" : ""}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showNewThread ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewThread}
            className="gap-1.5 h-8 text-xs font-semibold hidden sm:inline-flex"
            style={{ borderColor: "rgba(45,107,127,0.35)", color: "#2D6B7F" }}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            New thread
          </Button>
        ) : null}
        {showThread ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="gap-1 h-8 px-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

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
  subject,
  body,
  onSubject,
  onBody,
  sending,
  sent,
  error,
  onSend,
  onReset,
  onClose,
  isNewThread = false,
  onBackToThread = null,
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
      {isNewThread ? (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
          style={{
            background: "rgba(45,107,127,0.08)",
            border: "1px solid rgba(45,107,127,0.2)",
            color: "#2D6B7F",
          }}
        >
          <MessageSquarePlus className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            This sends a brand-new email thread to {repEmail}. Your previous
            conversation stays in Gmail.
          </span>
        </div>
      ) : null}

      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{
          background: "#fff",
          border: "1px solid rgba(30,37,53,0.1)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "rgba(30,37,53,0.08)" }}
        >
          <Reply className="w-4 h-4 shrink-0" style={{ color: "rgba(30,37,53,0.45)" }} />
          <div className="flex-1 min-w-0 text-sm" style={{ color: "#1e2535" }}>
            <span className="text-slate-500 mr-1">To</span>
            <span className="font-medium">{repName || "Account Rep"}</span>
            <span
              className="ml-1 underline decoration-[#FDE68A] decoration-2 underline-offset-2"
              style={{ color: "rgba(30,37,53,0.75)" }}
            >
              ({repEmail})
            </span>
          </div>
        </div>

        <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(30,37,53,0.06)" }}>
          <label className="sr-only">Subject</label>
          <input
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-sm font-medium outline-none bg-transparent"
            style={{ color: "#1e2535" }}
          />
        </div>

        <textarea
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={12}
          placeholder="Write your message…"
          className="w-full px-4 py-3 text-sm outline-none resize-none leading-relaxed"
          style={{
            color: "#1e2535",
            minHeight: 200,
            lineHeight: 1.65,
          }}
        />
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "#DA6A63" }}>
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        {onBackToThread ? (
          <Button variant="outline" className="flex-1" onClick={onBackToThread}>
            Back to thread
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        )}
        <GmailSendButton
          label={sending ? "Sending…" : isNewThread ? "Send new thread" : "Send"}
          disabled={!repEmail || sending || !subject.trim() || !body.trim()}
          color={COMPOSE_TEMPLATE.color}
          onClick={onSend}
        />
      </div>
    </div>
  );
}

function GmailSendButton({ label, disabled, color, onClick, fullWidth = true }) {
  return (
    <div
      className={`${fullWidth ? "flex-1" : ""} flex rounded-full overflow-hidden shadow-md min-w-[120px]`}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105 disabled:pointer-events-none"
        style={{ background: color || "#2D6B7F" }}
      >
        <Send className="w-4 h-4" />
        {label}
      </button>
      <span
        className="flex items-center px-2 border-l border-white/25"
        style={{ background: color || "#2D6B7F", color: "#fff" }}
        aria-hidden
      >
        <ChevronDown className="w-4 h-4 opacity-80" />
      </span>
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
  replyBody,
  onReplyBody,
  sending,
  error,
  onSendReply,
  onClose,
  onNewThread,
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
    <div className="flex flex-col min-h-[440px]">
      <div
        className="rounded-xl px-4 py-3 mb-3 shrink-0 flex items-center justify-between gap-2"
        style={{
          background: "#fff",
          border: "1px solid rgba(30,37,53,0.1)",
          boxShadow: "0 1px 3px rgba(30,37,53,0.06)",
        }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#1e2535" }}>
            {subject}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(30,37,53,0.55)" }}>
            {repName} · {repEmail}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewThread}
          className="gap-1 h-8 text-xs font-semibold shrink-0 sm:hidden"
          style={{ borderColor: "rgba(45,107,127,0.35)", color: "#2D6B7F" }}
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      <div
        ref={chatRef}
        className="flex-1 min-h-[240px] max-h-[360px] overflow-y-auto rounded-2xl px-3 py-4 space-y-4"
        style={{
          background: "linear-gradient(180deg, #eef1f6 0%, #e8ecf4 100%)",
          border: "1px solid rgba(30,37,53,0.06)",
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

      <div
        className="mt-4 shrink-0 rounded-2xl overflow-hidden shadow-md"
        style={{
          background: "#fff",
          border: "1px solid rgba(30,37,53,0.1)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b text-sm"
          style={{ borderColor: "rgba(30,37,53,0.08)", color: "#1e2535" }}
        >
          <Reply className="w-4 h-4 shrink-0" style={{ color: "rgba(30,37,53,0.45)" }} />
          <span className="text-slate-500">Reply to</span>
          <span className="font-medium truncate">{repName}</span>
          <span
            className="truncate underline decoration-[#FDE68A] decoration-2 underline-offset-2 text-xs sm:text-sm"
            style={{ color: "rgba(30,37,53,0.65)" }}
          >
            ({repEmail})
          </span>
        </div>
        <textarea
          value={replyBody}
          onChange={(e) => onReplyBody(e.target.value)}
          rows={4}
          placeholder="Write your reply…"
          className="w-full px-4 py-3 text-sm outline-none resize-none"
          style={{
            color: "#1e2535",
            lineHeight: 1.6,
            minHeight: 96,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSendReply();
            }
          }}
        />
        <div
          className="flex items-center justify-between gap-2 px-3 py-2.5 border-t"
          style={{
            borderColor: "rgba(30,37,53,0.08)",
            background: "rgba(246,248,251,0.9)",
          }}
        >
          <p className="text-[10px] pl-1" style={{ color: "rgba(30,37,53,0.45)" }}>
            Ctrl+Enter to send
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
            <GmailSendButton
              label={sending ? "Sending…" : "Send"}
              disabled={sending || !replyBody.trim()}
              color="#2D6B7F"
              onClick={onSendReply}
              fullWidth={false}
            />
          </div>
        </div>
      </div>
      {error ? (
        <p className="text-xs mt-2 px-1" style={{ color: "#DA6A63" }}>
          {error}
        </p>
      ) : null}
      <p className="text-[10px] text-center mt-2" style={{ color: "rgba(30,37,53,0.4)" }}>
        Attachments download here · full thread history lives in Gmail
      </p>
    </div>
  );
}

function MessageBubble({ message, threadId, providerEmail, repName }) {
  const isMine = isMessageFromProvider(message, providerEmail);
  const body = getMessageDisplayBody(message);
  const time = formatMessageTime(message.date, message.internal_date);
  const senderLabel = isMine ? "You" : repName || "Rep";

  return (
    <div className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      {!isMine ? (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-1"
          style={{
            background: "rgba(123,142,200,0.2)",
            color: "#2D6B7F",
            border: "1px solid rgba(123,142,200,0.25)",
          }}
        >
          {repInitials(repName)}
        </div>
      ) : null}
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3 shadow-sm"
        style={
          isMine
            ? {
                background: "linear-gradient(135deg, #2D6B7F 0%, #3a7d94 100%)",
                color: "#fff",
                borderBottomRightRadius: 4,
              }
            : {
                background: "#fff",
                color: "#1e2535",
                border: "1px solid rgba(30,37,53,0.08)",
                borderBottomLeftRadius: 4,
                boxShadow: "0 1px 2px rgba(30,37,53,0.06)",
              }
        }
      >
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ opacity: isMine ? 0.92 : 0.6 }}
          >
            {senderLabel}
          </span>
          <span
            className="text-[10px] whitespace-nowrap shrink-0 tabular-nums"
            style={{ opacity: isMine ? 0.8 : 0.5 }}
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
          <div className="mt-2.5 flex flex-wrap gap-1.5">
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
