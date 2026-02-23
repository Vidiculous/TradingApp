"use client";

import { Bot, Send, Sparkles, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: any;
  initialContext: any;
}

interface Message {
  role: "user" | "agent";
  text: string;
}

import { createPortal } from "react-dom";

export const AgentChatModal = ({ isOpen, onClose, agent, initialContext }: AgentChatModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("chat-open");
    } else {
      document.body.classList.remove("chat-open");
    }
    return () => document.body.classList.remove("chat-open");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Initial greeting
      const conclusion = agent.result?.conclusion;
      const summary = agent.result?.summary || agent.result?.reasoning;

      let text = `Hello! I am the ${agent.name}. I've analyzed ${initialContext?.ticker || "the ticker"}.`;
      if (conclusion) text += ` My conclusion is: **${conclusion}**.`;
      if (summary) text += ` \n\n${summary}`;

      setMessages([
        {
          role: "agent",
          text: text,
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: agent.id,
          message: userMsg,
          context: agent.result, // specific agent result + full context if needed
          provider: localStorage.getItem("trading_llm_provider"),
          model: localStorage.getItem("trading_llm_model"),
          api_key: localStorage.getItem("trading_llm_api_key"),
        }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, { role: "agent", text: data.response }]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "Sorry, I lost connection to the server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="animate-in fade-in fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 duration-200"
      onClick={onClose}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <div
        className="animate-in zoom-in-95 relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#09090b] shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-white/5 p-4 ${agent.bg}`}
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-xl bg-black/20 p-2 ${agent.color}`}>
              <agent.icon size={20} />
            </div>
            <div>
              <h3 className={`font-bold ${agent.color}`}>{agent.name}</h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                AI Specialist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === "user"
                    ? "rounded-br-none bg-blue-500 text-white"
                    : "rounded-bl-none bg-white/10 text-gray-200"
                  }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-gray-400">
                <Sparkles size={12} className="animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-white/5 bg-black/20 p-4">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Ask ${agent.name}...`}
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white transition-all placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="absolute right-2 top-1.5 rounded-lg bg-blue-500 p-1.5 text-white transition-all hover:bg-blue-400 disabled:bg-gray-700 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
