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
  ChevronLeft,
  ChevronRight,
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
  selectRepThread,
  sendGmailReply,
  startGmailThread,
} from "@/lib/gmailApi";
import { format, isToday, isYesterday } from "date-fns";

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

function formatThreadListDate(internalDate) {
  const ms = Number(internalDate);
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
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

  const savedThreadId = threadPointerQuery.data?.thread?.thread_id || null;
  const threadHistory = threadPointerQuery.data?.threads || [];

  const [activeThreadId, setActiveThreadId] = useState(null);

  useEffect(() => {
    if (!open) setActiveThreadId(null);
  }, [open]);

  useEffect(() => {
    if (!open || !savedThreadId) return;
    setActiveThreadId((prev) => prev || savedThreadId);
  }, [open, savedThreadId]);

  const threadId = activeThreadId || savedThreadId;

  const threadMessagesQuery = useQuery({
    queryKey: ["gmail-thread-messages", threadId],
    queryFn: () => fetchThreadMessages(threadId),
    enabled: open && Boolean(threadId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const selectThreadMutation = useMutation({
    mutationFn: (nextThreadId) =>
      selectRepThread({
        repEmail,
        threadId: nextThreadId,
        manufacturerId: manufacturer?.id || null,
      }),
    onSuccess: (_data, nextThreadId) => {
      setActiveThreadId(nextThreadId);
      qc.invalidateQueries({
        queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
      });
      qc.invalidateQueries({
        queryKey: ["gmail-thread-messages", nextThreadId],
      });
    },
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
    onSuccess: (data) => {
      setStartingNewThread(false);
      if (data?.thread_id) setActiveThreadId(data.thread_id);
      qc.invalidateQueries({
        queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ body }) =>
      sendGmailReply(threadId, body, { repEmail }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
      });
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
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
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
      setHistoryCollapsed(false);
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

  const displayThreads = useMemo(() => {
    const byId = new Map();
    for (const t of threadHistory) {
      if (t?.thread_id) byId.set(t.thread_id, t);
    }
    if (threadId) {
      const existing = byId.get(threadId);
      const rawSubject = messages[0]?.subject || existing?.subject || "(no subject)";
      const subject =
        rawSubject.replace(/^re:\s*/i, "").trim() || rawSubject;
      const last = messages[messages.length - 1];
      byId.set(threadId, {
        ...existing,
        thread_id: threadId,
        subject,
        snippet:
          existing?.snippet ||
          last?.snippet ||
          (last ? getMessageDisplayBody(last).slice(0, 120) : "") ||
          "",
        message_count: messages.length || existing?.message_count || 0,
        internal_date:
          last?.internal_date ||
          messages[0]?.internal_date ||
          existing?.internal_date ||
          null,
      });
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ta = Number(a.internal_date) || 0;
      const tb = Number(b.internal_date) || 0;
      return tb - ta;
    });
  }, [threadHistory, threadId, messages]);

  return (
    <Dialog open={open} onOpenChange={(v) => close(v ? open : false)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[min(92dvh,100dvh)] sm:max-h-[92vh] h-[min(92dvh,100dvh)] sm:h-auto flex flex-col p-0 gap-0 overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl">
        <DialogHeader className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 shrink-0 border-b border-slate-100/80 bg-gradient-to-b from-white to-slate-50/80">
          <RepDialogHeader
            repName={repName}
            repEmail={repEmail}
            mfrName={mfrName}
            showThread={showThread}
            startingNewThread={startingNewThread}
            refreshing={threadMessagesQuery.isFetching}
            onRefresh={() => {
              qc.invalidateQueries({
                queryKey: ["gmail-thread-pointer", repEmail, manufacturer?.id || ""],
              });
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

        <div
          className={`flex-1 min-h-0 px-4 sm:px-5 py-3 sm:py-4 bg-[#f6f8fb] ${
            showThread && !showCompose
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
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
            body={body}
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
          <div className="flex flex-1 min-h-0 gap-2 overflow-hidden min-w-0">
            <ThreadHistorySidebar
              className="max-sm:hidden"
              threads={displayThreads}
              activeThreadId={threadId}
              collapsed={historyCollapsed}
              onToggleCollapse={() => setHistoryCollapsed((v) => !v)}
              loading={
                threadPointerQuery.isLoading || threadPointerQuery.isFetching
              }
              selecting={selectThreadMutation.isPending}
              onSelect={(id) => {
                if (!id || id === threadId) return;
                setReplyBody("");
                setActiveThreadId(id);
                selectThreadMutation.mutate(id);
              }}
              onNewThread={beginNewThread}
            />
            <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
              <ThreadView
                repEmail={repEmail}
                repName={repName}
                providerEmail={me?.email || status?.google_email || ""}
                messages={messages}
                threadId={threadId}
                threads={displayThreads}
                threadsLoading={
                  threadPointerQuery.isLoading || threadPointerQuery.isFetching
                }
                selectingThread={selectThreadMutation.isPending}
                onSelectThread={(id) => {
                  if (!id || id === threadId) return;
                  setReplyBody("");
                  setActiveThreadId(id);
                  selectThreadMutation.mutate(id);
                }}
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
            </div>
          </div>
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
    <div className="flex items-start gap-3 pr-10 sm:pr-8">
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
            className="text-xs mt-1 line-clamp-2 sm:truncate"
            style={{ color: "rgba(30,37,53,0.55)" }}
            title={
              startingNewThread
                ? `${repEmail} · separate email thread in Gmail`
                : repEmail
            }
          >
            {repEmail}
            {startingNewThread ? (
              <span className="hidden sm:inline">
                {" "}
                · separate email thread in Gmail
              </span>
            ) : null}
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
          className="flex items-start sm:items-center gap-2 px-3 sm:px-4 py-3 border-b"
          style={{ borderColor: "rgba(30,37,53,0.08)" }}
        >
          <Reply className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" style={{ color: "rgba(30,37,53,0.45)" }} />
          <div className="flex-1 min-w-0 text-sm break-words" style={{ color: "#1e2535" }}>
            <span className="text-slate-500 mr-1">To</span>
            <span className="font-medium">{repName || "Account Rep"}</span>
            <span
              className="block sm:inline sm:ml-1 mt-0.5 sm:mt-0 underline decoration-[#FDE68A] decoration-2 underline-offset-2 break-all sm:break-normal"
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
          value={body ?? ""}
          onChange={(e) => onBody(e.target.value)}
          rows={10}
          placeholder="Write your message…"
          className="w-full px-3 sm:px-4 py-3 text-sm outline-none resize-none leading-relaxed min-h-[140px] sm:min-h-[200px]"
          style={{
            color: "#1e2535",
            lineHeight: 1.65,
          }}
        />
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "#DA6A63" }}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-2">
        {onBackToThread ? (
          <Button
            variant="outline"
            className="w-full sm:flex-1 h-11"
            onClick={onBackToThread}
          >
            Back to thread
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full sm:flex-1 h-11"
            onClick={onClose}
          >
            Cancel
          </Button>
        )}
        <GmailSendButton
          label={sending ? "Sending…" : isNewThread ? "Send new thread" : "Send"}
          disabled={
            !repEmail ||
            sending ||
            !(subject || "").trim() ||
            !(body || "").trim()
          }
          color={COMPOSE_TEMPLATE.color}
          onClick={onSend}
        />
      </div>
    </div>
  );
}

function ThreadHistorySidebar({
  threads,
  activeThreadId,
  collapsed,
  onToggleCollapse,
  loading,
  selecting,
  onSelect,
  onNewThread,
  className = "",
}) {
  const newThreadBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={onNewThread}
      className={`gap-1.5 h-8 text-xs font-semibold ${
        collapsed ? "w-9 px-0 justify-center" : "w-full"
      }`}
      style={{ borderColor: "rgba(45,107,127,0.35)", color: "#2D6B7F" }}
      title="New thread"
    >
      <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
      {!collapsed ? <span>New thread</span> : null}
    </Button>
  );

  return (
    <aside
      className={`shrink-0 flex flex-col min-h-0 self-stretch rounded-xl overflow-hidden transition-[width] duration-200 ${
        collapsed ? "w-11" : "w-[200px] sm:w-[220px]"
      } ${className}`}
      style={{
        background: "#fff",
        border: "1px solid rgba(30,37,53,0.1)",
        boxShadow: "0 1px 4px rgba(30,37,53,0.06)",
      }}
    >
      <div
        className={`shrink-0 border-b flex items-center gap-1 ${
          collapsed ? "px-1 py-2 justify-center" : "px-2 py-2.5 justify-between"
        }`}
        style={{ borderColor: "rgba(30,37,53,0.08)" }}
      >
        {!collapsed ? (
          <>
            <p
              className="text-[11px] font-bold uppercase tracking-wide pl-1"
              style={{ color: "rgba(30,37,53,0.5)" }}
            >
              Threads
            </p>
            <div className="flex items-center gap-0.5">
              {(loading || selecting) && (
                <RefreshCw
                  className="w-3 h-3 animate-spin shrink-0"
                  style={{ color: "#7B8EC8" }}
                />
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                title="Hide thread history"
                aria-label="Hide thread history"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "#7B8EC8" }} />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
            title="Show thread history"
            aria-label="Show thread history"
          >
            <ChevronRight className="w-4 h-4" style={{ color: "#7B8EC8" }} />
          </button>
        )}
      </div>

      {!collapsed ? (
        <div className="flex-1 min-h-0 overflow-y-auto py-1 overscroll-contain">
          {threads.length === 0 && !loading ? (
            <p
              className="text-xs px-3 py-4 text-center leading-relaxed"
              style={{ color: "rgba(30,37,53,0.5)" }}
            >
              No past threads yet.
            </p>
          ) : (
            threads.map((t) => {
              const active = t.thread_id === activeThreadId;
              return (
                <button
                  key={t.thread_id}
                  type="button"
                  onClick={() => onSelect(t.thread_id)}
                  disabled={selecting}
                  className="w-full text-left px-3 py-2.5 transition-colors border-l-2"
                  style={{
                    borderLeftColor: active ? "#2D6B7F" : "transparent",
                    background: active
                      ? "rgba(45,107,127,0.1)"
                      : "transparent",
                  }}
                >
                  <p
                    className="text-xs font-semibold truncate leading-snug"
                    style={{ color: active ? "#2D6B7F" : "#1e2535" }}
                    title={t.subject}
                  >
                    {t.subject || "(no subject)"}
                  </p>
                  <p
                    className="text-[10px] mt-1 line-clamp-2 leading-relaxed"
                    style={{ color: "rgba(30,37,53,0.5)" }}
                  >
                    {t.snippet || "—"}
                  </p>
                  <p
                    className="text-[10px] mt-1 tabular-nums"
                    style={{ color: "rgba(30,37,53,0.4)" }}
                  >
                    {formatThreadListDate(t.internal_date)}
                    {t.message_count > 1 ? ` · ${t.message_count} msgs` : ""}
                  </p>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0" aria-hidden />
      )}

      <div
        className={`shrink-0 border-t bg-white ${
          collapsed ? "p-1.5 flex justify-center" : "p-2"
        }`}
        style={{
          borderColor: "rgba(30,37,53,0.08)",
          boxShadow: "0 -4px 12px rgba(30,37,53,0.04)",
        }}
      >
        {newThreadBtn}
      </div>
    </aside>
  );
}

function GmailSendButton({ label, disabled, color, onClick, fullWidth = true }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 h-11 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:pointer-events-none whitespace-nowrap ${
        fullWidth ? "w-full sm:flex-1 sm:min-w-0" : "shrink-0"
      }`}
      style={{
        background: color || "#2D6B7F",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Send className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function ThreadView({
  repEmail,
  repName,
  providerEmail,
  messages,
  threadId,
  threads = [],
  threadsLoading = false,
  selectingThread = false,
  onSelectThread,
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

  const showMobileThreadPicker = threads.length > 1;

  return (
    <div className="grid flex-1 min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden min-w-0">
      <div className="shrink-0 space-y-2 mb-2 min-w-0">
        <div
          className="rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 min-w-0"
          style={{
            background: "#fff",
            border: "1px solid rgba(30,37,53,0.1)",
            boxShadow: "0 1px 3px rgba(30,37,53,0.06)",
          }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "#1e2535" }}
            >
              {subject}
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "rgba(30,37,53,0.55)" }}
            >
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

        {showMobileThreadPicker ? (
          <div className="sm:hidden relative">
            <label className="sr-only">Switch thread</label>
            <select
              value={threadId || ""}
              disabled={selectingThread || threadsLoading}
              onChange={(e) => onSelectThread?.(e.target.value)}
              className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-9 text-xs font-semibold truncate outline-none focus:ring-2 focus:ring-[#7B8EC8]/40"
              style={{
                color: "#1e2535",
                borderColor: "rgba(30,37,53,0.12)",
                background: "#fff",
              }}
            >
              {threads.map((t) => (
                <option key={t.thread_id} value={t.thread_id}>
                  {t.subject || "(no subject)"}
                  {t.message_count > 1 ? ` (${t.message_count})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "rgba(30,37,53,0.45)" }}
              aria-hidden
            />
          </div>
        ) : null}
      </div>

      <div
        ref={chatRef}
        className="min-h-0 overflow-y-auto rounded-2xl px-2 sm:px-3 py-3 sm:py-4 space-y-4 overscroll-contain min-w-0"
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
        className="shrink-0 flex-none pt-2 z-10"
        style={{
          boxShadow: "0 -6px 16px rgba(30,37,53,0.06)",
          background: "#f6f8fb",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            border: "1px solid rgba(30,37,53,0.1)",
          }}
        >
          <div
            className="flex items-start sm:items-center gap-2 px-3 sm:px-4 py-2 border-b text-sm min-w-0"
            style={{ borderColor: "rgba(30,37,53,0.08)", color: "#1e2535" }}
          >
            <Reply
              className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0"
              style={{ color: "rgba(30,37,53,0.45)" }}
            />
            <div className="min-w-0 flex-1 break-words">
              <span className="text-slate-500">Reply to </span>
              <span className="font-medium">{repName}</span>
              <span
                className="block sm:inline sm:ml-1 mt-0.5 sm:mt-0 underline decoration-[#FDE68A] decoration-2 underline-offset-2 break-all sm:break-normal text-xs sm:text-sm"
                style={{ color: "rgba(30,37,53,0.65)" }}
              >
                ({repEmail})
              </span>
            </div>
          </div>
          <textarea
            value={replyBody}
            onChange={(e) => onReplyBody(e.target.value)}
            rows={3}
            placeholder="Write your reply…"
            className="w-full px-3 sm:px-4 py-3 text-sm outline-none resize-none min-w-0"
            style={{
              color: "#1e2535",
              lineHeight: 1.6,
              minHeight: 72,
              maxHeight: 120,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSendReply();
              }
            }}
          />
          <div
            className="border-t"
            style={{
              borderColor: "rgba(30,37,53,0.08)",
              background: "rgba(246,248,251,0.95)",
            }}
          >
            <div className="flex flex-col gap-2 px-3 py-2.5 sm:hidden">
              <GmailSendButton
                label={sending ? "Sending…" : "Send"}
                disabled={sending || !replyBody.trim()}
                color="#2D6B7F"
                onClick={onSendReply}
                fullWidth
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="w-full h-10 text-xs font-semibold"
              >
                Close
              </Button>
              <p
                className="text-[10px] leading-tight text-center"
                style={{ color: "rgba(30,37,53,0.45)" }}
              >
                Ctrl+Enter to send
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-between gap-2 px-3 py-2">
              <p
                className="text-[10px] leading-tight"
                style={{ color: "rgba(30,37,53,0.45)" }}
              >
                Ctrl+Enter to send · attachments open in Gmail
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-9 text-xs"
                >
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
        </div>
        {error ? (
          <p className="text-xs mt-1.5 px-1" style={{ color: "#DA6A63" }}>
            {error}
          </p>
        ) : null}
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
    <div
      className={`flex gap-2 w-full min-w-0 ${
        isMine ? "flex-row-reverse" : "flex-row"
      }`}
    >
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
        className="min-w-0 max-w-[calc(100%-2.5rem)] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-3 shadow-sm overflow-hidden"
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
          className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed"
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
