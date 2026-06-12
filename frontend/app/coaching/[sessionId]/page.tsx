"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

interface CoachingMessage {
  id: number;
  session_id: number;
  role: "assistant" | "user";
  content: string;
  created_at: string;
}

interface CoachingSession {
  id: number;
  session_date: string;
  status: "in_progress" | "completed";
  context: string | null;
  messages: CoachingMessage[];
}

interface ContextData {
  achievement_rate: number;
  kpt: { keep: string[]; problem: string[]; try: string[] };
  prev_try_items: { content: string; is_completed: boolean }[];
  active_goals: { id: number; title: string }[];
  week_start: string;
  week_end: string;
}

export default function CoachingSessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { data: authSession, status } = useSession();

  const [coachingSession, setCoachingSession] = useState<CoachingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/login"); return; }
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionId]);

  async function fetchSession() {
    const email = authSession?.user?.email;
    if (!email) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/coaching/sessions/${sessionId}`, {
        headers: { "X-User-Email": email },
      });
      if (res.ok) {
        setCoachingSession(await res.json());
      } else {
        router.replace("/coaching");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const email = authSession?.user?.email;
    if (!email || !userInput.trim() || isSubmitting || !coachingSession) return;
    if (coachingSession.status === "completed") return;

    const content = userInput.trim();
    setUserInput("");
    setIsSubmitting(true);

    // Optimistic: add user message
    const tempUserMsg: CoachingMessage = {
      id: -Date.now(),
      session_id: coachingSession.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setCoachingSession((prev) => prev ? { ...prev, messages: [...prev.messages, tempUserMsg] } : prev);

    try {
      const res = await apiFetch(`/coaching/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "X-User-Email": email },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const aiMsg: CoachingMessage = await res.json();
        setCoachingSession((prev) => {
          if (!prev) return prev;
          // Replace temp user message with confirmed, add AI message
          const msgs = prev.messages.map((m) => m.id === tempUserMsg.id ? { ...tempUserMsg, id: tempUserMsg.id } : m);
          return { ...prev, messages: [...msgs, aiMsg] };
        });
        setTimeout(() => {
          historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
        }, 100);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteSession() {
    const email = authSession?.user?.email;
    if (!email || isCompleting || !coachingSession) return;
    setIsCompleting(true);
    try {
      const res = await apiFetch(`/coaching/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "X-User-Email": email },
      });
      if (res.ok) {
        const updated: CoachingSession = await res.json();
        setCoachingSession(updated);
        setTimeout(() => {
          historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
        }, 100);
      }
    } finally {
      setIsCompleting(false);
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">セッションを準備中...</p>
      </div>
    );
  }

  if (!coachingSession) return null;

  const messages = coachingSession.messages;
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const isCompleted = coachingSession.status === "completed";

  // The latest assistant message shown prominently (if not completed, the last one for input)
  // Past messages = everything except what's shown prominently
  const prominentMsg = isCompleted
    ? messages[messages.length - 1] // summary is the last message
    : lastAssistantMsg;

  const historyMessages = isCompleted
    ? messages.slice(0, messages.length - 1)
    : messages.slice(0, -1); // everything except the last assistant message

  const contextData: ContextData | null = coachingSession.context
    ? (() => { try { return JSON.parse(coachingSession.context); } catch { return null; } })()
    : null;

  return (
    <main>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/coaching")}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="戻る"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-white">{formatDate(coachingSession.session_date)}</h1>
            <p className="text-xs text-gray-500">コーチングセッション</p>
          </div>
        </div>
        {!isCompleted && (
          <button
            onClick={handleCompleteSession}
            disabled={isCompleting || messages.length < 3}
            className="text-xs px-3 py-1.5 border border-indigo-700 text-indigo-400 rounded-lg hover:bg-indigo-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isCompleting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                まとめ中...
              </span>
            ) : "セッションを完了する"}
          </button>
        )}
      </div>

      {/* Context summary (collapsible) */}
      {contextData && (
        <div className="mb-6">
          <button
            onClick={() => setContextOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-400 hover:border-gray-600 transition-colors"
          >
            <span>今週のデータ（達成率 {contextData.achievement_rate}%）</span>
            <svg className={`w-4 h-4 transition-transform ${contextOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {contextOpen && (
            <div className="mt-2 px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-400 space-y-1">
              <p>📅 {contextData.week_start} 〜 {contextData.week_end}</p>
              <p>✅ 達成率: <span className="text-white">{contextData.achievement_rate}%</span></p>
              {contextData.kpt.problem.length > 0 && (
                <p>⚠️ Problem: {contextData.kpt.problem.join("、")}</p>
              )}
              {contextData.kpt.try.length > 0 && (
                <p>🚀 Try: {contextData.kpt.try.join("、")}</p>
              )}
              {contextData.active_goals.length > 0 && (
                <p>🎯 ゴール: {contextData.active_goals.map((g) => g.title).join("、")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prominent current question / summary */}
      {prominentMsg && (
        <div className={`mb-6 rounded-2xl border p-5 ${isCompleted ? "border-green-800 bg-green-950/30" : "border-indigo-700 bg-indigo-950/50"}`}>
          {isCompleted && (
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3">セッションまとめ</p>
          )}
          <p className="text-white leading-relaxed whitespace-pre-wrap" style={{ fontSize: "20px" }}>
            {prominentMsg.content}
          </p>
          {isCompleted && (
            <button
              onClick={() => router.push("/coaching")}
              className="mt-5 w-full py-3 bg-indigo-700 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
            >
              セッションを終了する
            </button>
          )}
        </div>
      )}

      {/* Input area (only for in_progress) */}
      {!isCompleted && (
        <form onSubmit={handleSendMessage} className="mb-8">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendMessage(e as unknown as React.FormEvent);
              }
            }}
            placeholder="ここに回答を入力してください..."
            disabled={isSubmitting}
            rows={4}
            className="w-full bg-gray-900 border border-indigo-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-60"
            style={{ fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={!userInput.trim() || isSubmitting}
            className="mt-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AIが考えています...
              </span>
            ) : "回答する"}
          </button>
          <p className="mt-1 text-xs text-gray-600 text-center">⌘ + Enter でも送信できます</p>
        </form>
      )}

      {/* Past conversation history */}
      {historyMessages.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">過去のやり取り</h2>
          <div ref={historyRef} className="space-y-3 max-h-[400px] overflow-y-auto">
            {historyMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-indigo-950/80 border border-indigo-800 text-indigo-100"
                      : "bg-gray-900 border border-gray-700 text-gray-200"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
