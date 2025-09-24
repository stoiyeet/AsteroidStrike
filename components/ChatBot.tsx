"use client";

import React, { useEffect, useRef, useState } from "react";
import MitigationEducation from "@/components/MitigationEducation";
import { Send, Bot, User, ChevronDown, BookOpen, MessageSquare, Zap, ZapOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ---------------------------- Types ---------------------------- */
type EffectKey =
  | "kineticImpactor"
  | "nuclearDetonation"
  | "gravityTractor"
  | "laserAblation"
  | "ionBeamShepherd"
  | "analyze";

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  effects?: EffectKey[];
}

/* ------------------------- Effect config ------------------------ */
const EFFECTS_CONFIG = {
  kineticImpactor: { icon: "🚀", label: "Kinetic Impactor" },
  nuclearDetonation: { icon: "☢️", label: "Nuclear Detonation" },
  gravityTractor: { icon: "🛸", label: "Gravity Tractor" },
  laserAblation: { icon: "🔦", label: "Laser Ablation" },
  ionBeamShepherd: { icon: "⚡", label: "Ion Beam Shepherd" },
  analyze: { icon: "🔍", label: "Analyze Target" },
} as const;

/* ------------------------- Helpers ------------------------- */
function normalizeEffectNameToKey(raw: string): EffectKey | "complete" | null {
  const s = raw.trim().toLowerCase();
  if (["complete", "stop", "end", "clear", "finish"].includes(s)) return "complete";
  if (["kinetic", "kinetic impactor", "dart", "dart mission"].includes(s)) return "kineticImpactor";
  if (["nuclear", "nuclear detonation", "nuke", "warhead"].includes(s)) return "nuclearDetonation";
  if (["gravity", "gravity tractor", "tractor"].includes(s)) return "gravityTractor";
  if (["laser", "laser ablation", "ablation"].includes(s)) return "laserAblation";
  if (["ion", "ion beam", "ion beam shepherd", "shepherd"].includes(s)) return "ionBeamShepherd";
  if (["analyze", "scan", "analysis"].includes(s)) return "analyze";
  return null;
}

function sniffEffectFromFreeText(t: string): EffectKey | null {
  const L = t.toLowerCase();
  if (/(kinetic|dart|ram|crash probe)/.test(L)) return "kineticImpactor";
  if (/(nuclear|nuke|warhead|thermonuclear|blast)/.test(L)) return "nuclearDetonation";
  if (/(gravity tractor|gravitational tug|space tug)/.test(L)) return "gravityTractor";
  if (/(laser|ablation|vaporize)/.test(L)) return "laserAblation";
  if (/(ion beam|shepherd|plasma thruster)/.test(L)) return "ionBeamShepherd";
  if (/(analy[sz]e|scan|examine|assess|investigate|evaluate)/.test(L)) return "analyze";
  return null;
}

function parsePrefixBlock(text: string): { key: EffectKey | "complete" | null; body: string; rawEffect: string | null } {
  const EFFECT_PREFIX_RE = /^\s*--\s*(.+?)\s*--\s*([\s\S]*)$/;
  const m = text.match(EFFECT_PREFIX_RE);
  if (!m) return { key: null, body: text.trim(), rawEffect: null };
  const rawEffect = m[1];
  const body = m[2].trim();
  const keyOrComplete = normalizeEffectNameToKey(rawEffect);
  return { key: keyOrComplete, body, rawEffect };
}

function extractBody(text: string): string {
  const EFFECT_PREFIX_RE = /^\s*--\s*(.+?)\s*--\s*([\s\S]*)$/;
  const m = text.match(EFFECT_PREFIX_RE);
  return m ? m[2].trim() : text.trim();
}

function formatDisplay(effectKey: EffectKey | "complete" | null, body: string): string {
  if (effectKey === "complete") return `-- complete -- ${body}`;
  if (!effectKey) return body;
  const label = EFFECTS_CONFIG[effectKey].label;
  return `-- ${label} -- ${body}`;
}

/* ------------------------------- Props -------------------------------- */
type ChatBotProps = {
  effects: Record<EffectKey, boolean>;
  onSetSingleEffect: (key: EffectKey | null) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
};

const ChatBot: React.FC<ChatBotProps> = ({
  effects,
  onSetSingleEffect,
  expanded,
  onToggleExpanded,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: formatDisplay(
        null,
        "Welcome to **Asteroid Mitigation AI Simulator**! What mitigation strategy would you like to try?"
      ),
      role: "assistant",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "education">("chat");
  const [aiCanActivateEffects, setAiCanActivateEffects] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleOutgoingUserMessage = (raw: string) => {
    // Show the user's message in chat
    const display = extractBody(raw);
    setMessages((prev) => [...prev, { id: Date.now().toString(), content: display, role: "user" }]);

    // Only process effects if toggle is enabled
    if (!aiCanActivateEffects) {
      return; // Exit early if effects are disabled
    }

    // Parse for effects
    const pref = parsePrefixBlock(raw);
    let key = pref.key;

    // If no explicit prefix, try to detect effect from free text
    if (key === null) {
      if (/^\s*(complete|stop|end|clear|finish)\s*$/i.test(raw)) {
        key = "complete";
      } else {
        key = sniffEffectFromFreeText(raw);
      }
    }

    // Activate the effect
    if (key === "complete") {
      onSetSingleEffect(null);
    } else if (key) {
      onSetSingleEffect(key);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userRaw = input;
    setInput("");
    handleOutgoingUserMessage(userRaw);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { 
              role: "user", 
              content: `Please reply with the format \`-- effect -- message\`. Valid effects: kinetic, nuclear, gravity, laser, ion, analyze, complete. Then your explanation.\n\n${userRaw}` 
            },
          ],
        }),
      });

      const data = await res.json();
      const assistantContent: string = data?.answer ?? "I couldn't process that strategy.";

      // Parse assistant response
      let { key, body } = parsePrefixBlock(assistantContent);

      // Fallback: sniff effect from free text if needed
      if (key === null) {
        const sniffed = sniffEffectFromFreeText(assistantContent);
        key = sniffed;
        body = assistantContent.trim();
      }

      // Only activate effects if toggle is enabled
      if (aiCanActivateEffects && key) {
        if (key === "complete") {
          onSetSingleEffect(null);
        } else {
          onSetSingleEffect(key);
        }
      }

      // Display the assistant's message
      const display = extractBody(assistantContent);
      const chips: EffectKey[] = aiCanActivateEffects && key && key !== "complete" ? [key] : [];

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), content: display, role: "assistant", effects: chips },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content: "⚠️ **Failed to reach the AI.** Please try again.",
          role: "assistant",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const ActiveChips = () => (
    <div className="flex flex-wrap gap-1 ml-4">
      {Object.entries(effects)
        .filter(([, active]) => active)
        .map(([key]) => {
          const cfg = EFFECTS_CONFIG[key as EffectKey];
          if (!cfg) return null;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 bg-blue-500/30 px-2 py-1 rounded-full text-xs"
            >
              {cfg.icon} {cfg.label}
            </span>
          );
        })}
    </div>
  );

  const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
    const isUser = msg.role === "user";
    return (
      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`flex gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isUser ? "bg-blue-500" : "bg-purple-600"
            }`}
          >
            {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
          </div>
          <div
            className={`p-3 rounded-2xl ${
              isUser ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
            }`}
          >
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>

            {msg.effects && msg.effects.length > 0 && (
              <div className="mt-2 pt-2 border-top border-gray-500/50">
                <div className="text-xs opacity-80 mb-1">Activated:</div>
                <div className="flex flex-wrap gap-1">
                  {msg.effects.map((effect) => {
                    const cfg = EFFECTS_CONFIG[effect];
                    return (
                      <span
                        key={effect}
                        className="inline-flex items-center gap-1 bg-green-500/30 px-2 py-1 rounded-full text-xs"
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col border-l border-gray-700 bg-gray-900/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {activeTab === "chat" ? <Bot size={20} /> : <BookOpen size={20} />}
            <h2 className="text-xl font-bold">
              {activeTab === "chat" ? "Strategy AI" : "Defense Methods"}
            </h2>
            {activeTab === "chat" && <ActiveChips />}
          </div>

          <button
            onClick={onToggleExpanded}
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors flex items-center gap-2"
            aria-label={expanded ? "Minimize chat" : "Expand chat"}
          >
            <ChevronDown size={16} />
            <span className="text-sm">{expanded ? "Minimize" : "Expand"}</span>
          </button>
        </div>

        {/* AI Effect Control Toggle */}
        {activeTab === "chat" && (
          <div className="flex items-center justify-between mb-3 p-2 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              {aiCanActivateEffects ? <Zap size={16} className="text-green-400" /> : <ZapOff size={16} className="text-red-400" />}
              <span className="text-sm font-medium">AI Effect Control</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                aiCanActivateEffects ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {aiCanActivateEffects ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <button
              onClick={() => setAiCanActivateEffects(!aiCanActivateEffects)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiCanActivateEffects ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiCanActivateEffects ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
              activeTab === "chat" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <MessageSquare size={16} />
            Strategy AI
          </button>
          <button
            onClick={() => setActiveTab("education")}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
              activeTab === "education" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <BookOpen size={16} />
            Learn Methods
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" ? (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                    <div className="bg-gray-700 p-3 rounded-2xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/30">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={aiCanActivateEffects ? "Talk to Impact AI..." : "Talk to Impact AI (effects disabled)..."}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 rounded-xl flex items-center justify-center transition-colors"
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Plan a mitigation strategy for Impactor-2025
                {!aiCanActivateEffects && (
                  <span className="text-red-400"> • Effect activation disabled</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <MitigationEducation />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBot;