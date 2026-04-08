import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MessageThread({ appointmentId, recipientId, recipientName }) {
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const messagesEndRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", appointmentId],
    queryFn: () => {
      if (!appointmentId) return [];
      return base44.entities.Message.filter({ 
        thread_id: appointmentId 
      }, "created_date");
    },
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!appointmentId,
  });

  const send = useMutation({
    mutationFn: async () => {
      await base44.entities.Message.create({
        appointment_id: appointmentId,
        sender_id: user.id,
        sender_email: user.email,
        sender_name: user.full_name,
        sender_role: user.role,
        recipient_id: recipientId,
        message: message,
        thread_id: appointmentId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["messages", appointmentId]);
      setMessage("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 rounded-t-xl">
        {messages.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map(m => {
            const isMe = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isMe ? "bg-indigo-600 text-white" : "bg-white text-slate-900 border border-slate-200"
                }`}>
                  <p className="text-xs opacity-70 mb-1">{m.sender_name}</p>
                  <p className="text-sm">{m.message}</p>
                  <p className={`text-xs mt-1 ${isMe ? "opacity-60" : "text-slate-400"}`}>
                    {format(new Date(m.created_date), "h:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white border-t border-slate-200 rounded-b-xl">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Message ${recipientName}...`}
            rows={2}
            className="resize-none"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim()) send.mutate();
              }
            }}
          />
          <Button
            onClick={() => send.mutate()}
            disabled={!message.trim() || send.isPending}
            style={{ background: "#FA6F30", color: "#fff" }}
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}