import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { mdMessagesApi } from "@/api/mdMessagesApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Plus, Send, X, Loader2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

function formatMsgTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return format(d, "HH:mm");
}

function formatThreadTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function computeThreadId(idA, idB) {
  return [String(idA), String(idB)].sort().join("-");
}

const glassCard = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 16,
};

export default function MDMessaging() {
  const qc = useQueryClient();
  const [activeThread, setActiveThread] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerProvider, setComposerProvider] = useState("");
  const [composerMessage, setComposerMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // Active relationships — for the "New Message" provider dropdown
  const { data: relationships = [] } = useQuery({
    queryKey: ["md-relationships"],
    queryFn: () => base44.entities.MedicalDirectorRelationship.list(),
    enabled: !!me,
    staleTime: 30_000,
  });

  const activeRelationships = useMemo(
    () => relationships.filter((r) => r.status === "active"),
    [relationships]
  );

  // Thread list — shared query key ["msg-threads"] with Layout.jsx sidebar badge.
  // staleTime prevents double-fetching when Layout already polled recently.
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["msg-threads"],
    queryFn: () => mdMessagesApi.getThreads(),
    enabled: !!me,
    refetchInterval: 5000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
  });

  // Messages for the active thread — faster poll since the user is actively reading.
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["md-messages", activeThread],
    queryFn: () => mdMessagesApi.getMessages(activeThread),
    enabled: !!activeThread,
    refetchInterval: 3000,
    staleTime: 2000,
  });

  // Auto-scroll only when new messages arrive (count increases), not on every re-render.
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Mark as read — optimistic: immediately zero unread count in cache, then confirm.
  const markReadMutation = useMutation({
    mutationFn: (threadId) => mdMessagesApi.markRead(threadId),
    onMutate: (threadId) => {
      qc.setQueryData(["msg-threads"], (old) =>
        (Array.isArray(old) ? old : []).map((t) =>
          t.thread_id === threadId ? { ...t, unread_count: 0 } : t
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["msg-threads"] }),
  });

  // Send message — optimistic: append to chat immediately, replace with real msg on success.
  const sendMutation = useMutation({
    mutationFn: (payload) => mdMessagesApi.sendMessage(payload),
    onMutate: async (payload) => {
      if (!me?.id) return;
      const threadId = computeThreadId(me.id, payload.recipient_id);
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        thread_id: threadId,
        sender_id: me.id,
        sender_email: me.email || null,
        sender_name: payload.sender_name,
        sender_role: payload.sender_role,
        recipient_id: payload.recipient_id,
        recipient_email: payload.recipient_email,
        recipient_name: payload.recipient_name,
        message: payload.message,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      // Add optimistic message to the thread view
      qc.setQueryData(["md-messages", threadId], (old) => [
        ...(Array.isArray(old) ? old : []),
        optimisticMsg,
      ]);

      // Optimistically update the thread list preview
      qc.setQueryData(["msg-threads"], (old) => {
        const existing = (Array.isArray(old) ? old : []).find(
          (t) => t.thread_id === threadId
        );
        if (existing) {
          return old.map((t) =>
            t.thread_id === threadId
              ? { ...t, last_message: payload.message, last_message_at: optimisticMsg.created_at }
              : t
          );
        }
        // Brand-new thread — prepend it
        return [
          {
            thread_id: threadId,
            last_message: payload.message,
            last_message_at: optimisticMsg.created_at,
            unread_count: 0,
            other_user_id: payload.recipient_id,
            other_user_email: payload.recipient_email,
            other_user_name: payload.recipient_name,
            other_user_role: "provider",
          },
          ...(Array.isArray(old) ? old : []),
        ];
      });

      return { optimisticMsg, threadId };
    },
    onSuccess: (newMsg, _payload, context) => {
      // Replace the optimistic placeholder with the real message
      if (context?.threadId) {
        qc.setQueryData(["md-messages", context.threadId], (old) =>
          (Array.isArray(old) ? old : []).map((m) =>
            m.id === context.optimisticMsg?.id ? newMsg : m
          )
        );
      }
      qc.invalidateQueries({ queryKey: ["msg-threads"] });
      setActiveThread(newMsg.thread_id);
      setReplyText("");
      setComposerMessage("");
      setComposerProvider("");
      setShowComposer(false);
    },
    onError: (_err, _payload, context) => {
      // Roll back the optimistic message on failure
      if (context?.threadId) {
        qc.setQueryData(["md-messages", context.threadId], (old) =>
          (Array.isArray(old) ? old : []).filter(
            (m) => m.id !== context.optimisticMsg?.id
          )
        );
      }
    },
  });

  // Mark thread as read immediately when opened
  useEffect(() => {
    if (activeThread) {
      markReadMutation.mutate(activeThread);
    }
  }, [activeThread]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectThread(thread) {
    setActiveThread(thread.thread_id);
    setShowComposer(false);
  }

  function handleSendReply() {
    if (!replyText.trim() || !activeThread || sendMutation.isPending) return;
    const thread = threads.find((t) => t.thread_id === activeThread);
    if (!thread) return;
    sendMutation.mutate({
      recipient_id: thread.other_user_id,
      recipient_email: thread.other_user_email,
      recipient_name: thread.other_user_name,
      message: replyText.trim(),
      sender_name: me?.full_name || me?.email || "",
      sender_role: "medical_director",
    });
  }

  function handleReplyKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  }

  function handleComposerSend() {
    if (!composerProvider || !composerMessage.trim() || sendMutation.isPending) return;
    const rel = activeRelationships.find((r) => r.provider_id === composerProvider);
    sendMutation.mutate({
      recipient_id: composerProvider,
      recipient_email: rel?.provider_email || "",
      recipient_name: rel?.provider_name || "",
      message: composerMessage.trim(),
      sender_name: me?.full_name || me?.email || "",
      sender_role: "medical_director",
    });
  }

  const activeThreadData = useMemo(
    () => threads.find((t) => t.thread_id === activeThread),
    [threads, activeThread]
  );

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Page header */}
      <div className="mb-4 flex-shrink-0">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-1"
          style={{ color: "rgba(218,106,99,0.9)" }}
        >
          M D Messaging
        </p>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 28,
            color: "#1e2535",
            lineHeight: 1.1,
            fontStyle: "italic",
          }}
        >
          Provider Messages
        </h1>
        <p style={{ color: "rgba(30,37,53,0.6)", fontSize: 13, marginTop: 4 }}>
          Direct messaging with your supervised providers
        </p>
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 gap-4 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT PANEL — Thread List */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden"
          style={{ width: 264, ...glassCard }}
        >
          {/* Thread list header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/60">
            <div>
              <p className="font-semibold text-sm text-slate-800">Messages</p>
              <p className="text-xs text-slate-400">
                {threads.length} conversation{threads.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => {
                setShowComposer((v) => !v);
                setActiveThread(null);
              }}
              className="flex items-center justify-center w-7 h-7 rounded-full text-white transition-opacity hover:opacity-80"
              style={{ background: "rgba(218,106,99,0.85)" }}
              title="New message"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          {/* New Message Composer (mini panel) */}
          {showComposer && (
            <div className="px-3 py-3 border-b border-white/60 bg-white/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-700">New Message</p>
                <button
                  onClick={() => setShowComposer(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              </div>
              <Select value={composerProvider} onValueChange={setComposerProvider}>
                <SelectTrigger className="h-8 text-xs mb-2">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {activeRelationships.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400">
                      No active supervised providers
                    </div>
                  )}
                  {activeRelationships.map((rel) => (
                    <SelectItem key={rel.provider_id} value={rel.provider_id} className="text-xs">
                      {rel.provider_name || rel.provider_email || rel.provider_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={composerMessage}
                onChange={(e) => setComposerMessage(e.target.value)}
                placeholder="Type a message..."
                className="text-xs resize-none mb-2"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComposerSend();
                  }
                }}
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                disabled={!composerProvider || !composerMessage.trim() || sendMutation.isPending}
                onClick={handleComposerSend}
                style={{ background: "rgba(218,106,99,0.85)" }}
              >
                {sendMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Send size={12} className="mr-1" />
                )}
                Send
              </Button>
            </div>
          )}

          {/* Thread rows */}
          <div className="flex-1 overflow-y-auto">
            {threadsLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-slate-300" />
              </div>
            )}
            {!threadsLoading && threads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <MessageSquare size={28} className="text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No conversations yet</p>
                <p className="text-xs text-slate-300 mt-1">Click + to start a new message</p>
              </div>
            )}
            {threads.map((thread) => {
              const isActive = thread.thread_id === activeThread;
              const hasUnread = thread.unread_count > 0;
              return (
                <button
                  key={thread.thread_id}
                  onClick={() => handleSelectThread(thread)}
                  className="w-full text-left px-4 py-3 border-b border-white/40 transition-colors hover:bg-white/50"
                  style={{
                    background: isActive ? "rgba(218,106,99,0.08)" : "transparent",
                    borderLeft: isActive
                      ? "3px solid rgba(218,106,99,0.7)"
                      : "3px solid transparent",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold"
                      style={{ background: "rgba(218,106,99,0.55)" }}
                    >
                      {getInitials(thread.other_user_name || thread.other_user_email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className="text-xs font-semibold truncate"
                          style={{ color: hasUnread ? "#1e2535" : "rgba(30,37,53,0.75)" }}
                        >
                          {thread.other_user_name ||
                            thread.other_user_email ||
                            thread.other_user_id}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {hasUnread && (
                            <Badge
                              className="h-4 min-w-[16px] px-1 text-[10px] text-white border-0"
                              style={{ background: "rgba(218,106,99,0.85)" }}
                            >
                              {thread.unread_count}
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatThreadTime(thread.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {thread.last_message || ""}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL — Chat View */}
        <div
          className="flex flex-col flex-1 overflow-hidden"
          style={{ minWidth: 0, ...glassCard }}
        >
          {!activeThread ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ background: "rgba(30,37,53,0.06)" }}
              >
                <MessageSquare size={26} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/60 flex-shrink-0">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold"
                  style={{ background: "rgba(218,106,99,0.55)" }}
                >
                  {getInitials(
                    activeThreadData?.other_user_name || activeThreadData?.other_user_email
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {activeThreadData?.other_user_name ||
                      activeThreadData?.other_user_email ||
                      activeThreadData?.other_user_id}
                  </p>
                  <p className="text-[11px] text-slate-400">Provider</p>
                </div>
              </div>

              {/* Message list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messagesLoading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={20} className="animate-spin text-slate-300" />
                  </div>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs text-slate-400">No messages yet. Say hello!</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.sender_id === me?.id;
                  const isOptimistic = String(msg.id).startsWith("optimistic-");
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      style={{ opacity: isOptimistic ? 0.65 : 1, transition: "opacity 0.2s" }}
                    >
                      <div
                        className="max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                        style={
                          isMe
                            ? {
                                background: "rgba(99,130,218,0.15)",
                                borderBottomRightRadius: 4,
                                color: "#1e2535",
                              }
                            : {
                                background: "rgba(30,37,53,0.07)",
                                borderBottomLeftRadius: 4,
                                color: "#1e2535",
                              }
                        }
                      >
                        <p style={{ fontSize: 13 }}>{msg.message}</p>
                        <p
                          className="mt-1 text-right"
                          style={{ fontSize: 10, color: "rgba(30,37,53,0.4)" }}
                        >
                          {isOptimistic ? "Sending…" : formatMsgTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="flex items-end gap-2 px-4 py-3 border-t border-white/60 flex-shrink-0">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 resize-none text-sm"
                  rows={1}
                  style={{ minHeight: 38, maxHeight: 120 }}
                />
                <Button
                  size="icon"
                  disabled={!replyText.trim() || sendMutation.isPending}
                  onClick={handleSendReply}
                  className="flex-shrink-0 w-9 h-9 rounded-xl"
                  style={{
                    background: replyText.trim()
                      ? "rgba(218,106,99,0.85)"
                      : "rgba(30,37,53,0.1)",
                    border: "none",
                  }}
                >
                  {sendMutation.isPending ? (
                    <Loader2 size={15} className="animate-spin text-white" />
                  ) : (
                    <Send size={15} className="text-white" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
