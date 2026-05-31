import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appointmentMessagesApi } from "@/api/appointmentMessagesApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { isPreBookingThreadId } from "@/lib/appointmentMessageThreads";
import {
  PRE_BOOKING_QUESTIONS,
  allPreBookingQuestionsAnswered,
  getAnsweredQuestionKeys,
  getPreBookingQuestion,
  nextUnansweredQuestion,
} from "@/lib/preBookingQuestions";

function MessageBubble({ m, userId }) {
  const isMe = m.sender_id === userId;
  const q = m.question_key ? getPreBookingQuestion(m.question_key) : null;
  const lines = String(m.message || "").split("\n");
  const body = q && lines[0] === q.label ? lines.slice(1).join("\n") : m.message;

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isMe ? "bg-indigo-600 text-white" : "bg-white text-slate-900 border border-slate-200"
        }`}
      >
        <p className="text-xs opacity-70 mb-1">{m.sender_name}</p>
        {q && (
          <p className={`text-[11px] font-semibold mb-1 ${isMe ? "opacity-90" : "text-slate-500"}`}>
            {q.label}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap">{body}</p>
        <p className={`text-xs mt-1 ${isMe ? "opacity-60" : "text-slate-400"}`}>
          {format(new Date(m.created_date || m.created_at), "h:mm a")}
        </p>
      </div>
    </div>
  );
}

export default function MessageThread({
  appointmentId,
  recipientId,
  recipientName,
  recipientEmail,
  providerIdForBooking,
}) {
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const qc = useQueryClient();
  const messagesEndRef = useRef(null);
  const markedReadRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const threadId = String(appointmentId || "").trim();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: messages = [], isPending } = useQuery({
    queryKey: ["appointment-messages", threadId],
    queryFn: () => {
      if (!threadId) return [];
      return appointmentMessagesApi.getMessages(threadId);
    },
    enabled: !!threadId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!threadId || markedReadRef.current === threadId) return;
    markedReadRef.current = threadId;
    void appointmentMessagesApi.markRead(threadId).then(() => {
      void qc.invalidateQueries({ queryKey: ["appointment-message-unread"] });
    });
  }, [threadId, qc]);

  const lastIncomingSender = [...messages]
    .reverse()
    .find((m) => m.sender_id && m.sender_id !== user?.id);
  const effectiveRecipientId = recipientId || lastIncomingSender?.sender_id || null;
  const effectiveRecipientName = recipientName || lastIncomingSender?.sender_name || "Patient";
  const effectiveRecipientEmail = recipientEmail || lastIncomingSender?.sender_email || undefined;

  const isPreBooking = isPreBookingThreadId(threadId);
  const isPatient = String(user?.role || "").toLowerCase() === "patient";

  const answeredKeys = useMemo(
    () => (isPatient && user?.id ? getAnsweredQuestionKeys(messages, user.id) : new Set()),
    [messages, user?.id, isPatient]
  );

  const inquiryComplete = isPreBooking && isPatient && allPreBookingQuestionsAnswered(answeredKeys);
  const currentQuestion =
    isPreBooking && isPatient && !inquiryComplete
      ? nextUnansweredQuestion(answeredKeys)
      : null;

  const answeredCount = PRE_BOOKING_QUESTIONS.filter((q) => answeredKeys.has(q.key)).length;

  const send = useMutation({
    mutationFn: async () => {
      if (!effectiveRecipientId) {
        throw new Error("Select a conversation or wait for a patient message before replying.");
      }
      setSendError("");
      const payload = {
        thread_id: threadId,
        appointment_id: threadId,
        recipient_id: effectiveRecipientId,
        recipient_name: effectiveRecipientName,
        recipient_email: effectiveRecipientEmail,
        sender_name: user?.full_name,
        sender_role: user?.role,
        message: message.trim(),
      };
      if (isPreBooking && isPatient && currentQuestion) {
        payload.question_key = currentQuestion.key;
      }
      await appointmentMessagesApi.sendMessage(payload);
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["appointment-messages", threadId] });
      void qc.invalidateQueries({ queryKey: ["appointment-message-unread"] });
      void qc.invalidateQueries({ queryKey: ["pre-booking-inbox"] });
      setMessage("");
      setSendError("");
    },
    onError: (err) => {
      const msg = String(err?.message || "Could not send message.").replace(
        /^\[lovable-provider\]\s*\d+\s+/,
        ""
      );
      try {
        const parsed = JSON.parse(msg);
        setSendError(parsed.error || msg);
      } catch {
        setSendError(msg);
      }
    },
  });

  useEffect(() => {
    const count = messages.length;
    if (count > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = count;
  }, [messages.length]);

  if (isPending && messages.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const bookingHref = providerIdForBooking
    ? `/PatientMarketplace?provider=${encodeURIComponent(providerIdForBooking)}`
    : "/PatientMarketplace";

  return (
    <div className="flex flex-col h-[500px]">
      {isPreBooking && isPatient && (
        <div className="mx-4 mt-3 rounded-lg px-3 py-2 text-xs bg-slate-50 border border-slate-200 text-slate-600">
          {inquiryComplete ? (
            <p className="flex items-start gap-1.5 text-amber-800">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />
              Thanks — your inquiry is complete. Book an appointment to continue messaging this provider.
            </p>
          ) : (
            <p>
              Answer {PRE_BOOKING_QUESTIONS.length} quick questions before booking ({answeredCount}/
              {PRE_BOOKING_QUESTIONS.length} done). Your provider will see your answers in Messages.
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 rounded-t-xl">
        {isPreBooking && isPatient && messages.length === 0 && currentQuestion && (
          <p className="text-center text-slate-500 text-sm py-4">
            Ask about this provider&apos;s services — one question at a time below.
          </p>
        )}
        {!isPreBooking && messages.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} userId={user?.id} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200 rounded-b-xl space-y-2">
        {sendError && (
          <p className="text-xs text-red-600 flex items-start gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {sendError}
          </p>
        )}

        {inquiryComplete && isPatient && (
          <a
            href={bookingHref}
            className="block text-center text-sm font-semibold py-2.5 rounded-lg"
            style={{ background: "#FA6F30", color: "#fff" }}
          >
            Book an appointment to continue →
          </a>
        )}

        {isPreBooking && isPatient && currentQuestion && !inquiryComplete && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{currentQuestion.label}</p>
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) send.mutate();
                  }
                }}
              />
              <Button
                onClick={() => send.mutate()}
                disabled={!message.trim() || send.isPending || !effectiveRecipientId}
                style={{ background: "#FA6F30", color: "#fff" }}
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400">Press Enter to submit this answer</p>
          </div>
        )}

        {(!isPreBooking || !isPatient) && !inquiryComplete && (
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message ${effectiveRecipientName || recipientName || "..."}...`}
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (message.trim()) send.mutate();
                }
              }}
            />
            <Button
              onClick={() => send.mutate()}
              disabled={!message.trim() || send.isPending || !effectiveRecipientId}
              style={{ background: "#FA6F30", color: "#fff" }}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {isPreBooking && isPatient && inquiryComplete && (
          <p className="text-xs text-center text-slate-400 py-1">
            Messaging is closed until you book an appointment.
          </p>
        )}
      </div>
    </div>
  );
}
