"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface KPTItem {
  id: number;
  review_id: number;
  type: "keep" | "problem" | "try";
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface WeeklyReview {
  id: number;
  week_start_date: string;
  kpt_items: KPTItem[];
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
  return `${fmt(start)} 〜 ${fmt(end)}`;
}

/** Date → "YYYY-MM-DD" in local timezone (avoids UTC offset bug with toISOString()) */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPrevSundayStr(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return toLocalDateStr(d);
}

function getNextSundayStr(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return toLocalDateStr(d);
}

function getTodaySundayStr(): string {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay()); // getDay(): 0=Sun
  return toLocalDateStr(sunday);
}

const KPT_CONFIG = {
  keep: { label: "Keep", emoji: "✅", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  problem: { label: "Problem", emoji: "⚠️", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700" },
  try: { label: "Try", emoji: "🚀", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
} as const;

type KPTType = keyof typeof KPT_CONFIG;

export default function WeeklyReviewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentWeekStart, setCurrentWeekStart] = useState(getTodaySundayStr());
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [prevTryItems, setPrevTryItems] = useState<KPTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState<KPTType | null>(null);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiCreatedAt, setAiCreatedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const todayWeek = getTodaySundayStr();
  const isCurrentWeek = currentWeekStart === todayWeek;

  const hasKPTItems =
    (review?.kpt_items.filter((i) => i.type === "keep").length ?? 0) > 0 ||
    (review?.kpt_items.filter((i) => i.type === "problem").length ?? 0) > 0 ||
    (review?.kpt_items.filter((i) => i.type === "try").length ?? 0) > 0;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    loadReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart, status, session?.user?.email]);

  useEffect(() => {
    if (addingType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingType]);

  useEffect(() => {
    if (editingId !== null && editRef.current) {
      editRef.current.focus();
    }
  }, [editingId]);

  async function loadReview() {
    setLoading(true);
    setPrevTryItems([]);
    setAiAnalysis(null);
    setAiCreatedAt(null);
    const email = session!.user!.email!;
    const headers = { "X-User-Email": email };

    try {
      const [reviewRes, prevRes, analysisRes] = await Promise.all([
        fetch(`${API}/reviews/weekly/${currentWeekStart}`, { headers }),
        fetch(
          `${API}/reviews/weekly/${getPrevSundayStr(currentWeekStart)}`,
          { headers }
        ).then(async (r) => {
          if (!r.ok) throw new Error();
          const data: WeeklyReview = await r.json();
          return data.kpt_items.filter((i) => i.type === "try");
        }).catch(() => [] as KPTItem[]),
        fetch(`${API}/reviews/weekly/${currentWeekStart}/analysis`, { headers }),
      ]);

      const reviewData: WeeklyReview = await reviewRes.json();
      setReview(reviewData);
      setPrevTryItems(prevRes);

      if (analysisRes.ok) {
        const analysisData: { analysis: string; created_at: string } = await analysisRes.json();
        setAiAnalysis(analysisData.analysis);
        setAiCreatedAt(analysisData.created_at);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAnalysis() {
    const email = session!.user!.email!;
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch(
        `${API}/reviews/weekly/${currentWeekStart}/analysis/generate`,
        { method: "POST", headers: { "X-User-Email": email } }
      );
      if (res.ok) {
        const data: { analysis: string; created_at: string } = await res.json();
        setAiAnalysis(data.analysis);
        setAiCreatedAt(data.created_at);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAdd() {
    if (!addingType || !newContent.trim() || !review) return;
    const email = session!.user!.email!;
    const type = addingType;
    const content = newContent.trim();
    const reviewId = review.id;
    const tempId = -Date.now();
    const tempItem: KPTItem = { id: tempId, review_id: reviewId, type, content, is_completed: false, created_at: new Date().toISOString() };
    setReview((prev) => prev ? { ...prev, kpt_items: [...prev.kpt_items, tempItem] } : prev);
    setNewContent("");
    setAddingType(null);
    try {
      const res = await fetch(`${API}/reviews/weekly/${reviewId}/kpt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Email": email },
        body: JSON.stringify({ type, content }),
      });
      const item: KPTItem = await res.json();
      setReview((prev) => prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === tempId ? item : i)) } : prev);
    } catch {
      setReview((prev) => prev ? { ...prev, kpt_items: prev.kpt_items.filter((i) => i.id !== tempId) } : prev);
    }
  }

  async function handleToggleComplete(item: KPTItem) {
    const email = session!.user!.email!;
    setReview((prev) =>
      prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i)) } : prev
    );
    try {
      await fetch(`${API}/reviews/kpt/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Email": email },
        body: JSON.stringify({ is_completed: !item.is_completed }),
      });
    } catch {
      setReview((prev) =>
        prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === item.id ? item : i)) } : prev
      );
    }
  }

  async function handleEditSave(itemId: number) {
    if (!editContent.trim()) return;
    const email = session!.user!.email!;
    const content = editContent.trim();
    const prevItem = review?.kpt_items.find((i) => i.id === itemId);
    setReview((prev) =>
      prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === itemId ? { ...i, content } : i)) } : prev
    );
    setEditingId(null);
    setSavingId(itemId);
    try {
      const res = await fetch(`${API}/reviews/kpt/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Email": email },
        body: JSON.stringify({ content }),
      });
      const updated: KPTItem = await res.json();
      setReview((prev) =>
        prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === updated.id ? updated : i)) } : prev
      );
    } catch {
      if (prevItem) setReview((prev) =>
        prev ? { ...prev, kpt_items: prev.kpt_items.map((i) => (i.id === itemId ? prevItem : i)) } : prev
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(itemId: number) {
    const email = session!.user!.email!;
    const prevItems = review?.kpt_items ?? [];
    setReview((prev) =>
      prev ? { ...prev, kpt_items: prev.kpt_items.filter((i) => i.id !== itemId) } : prev
    );
    try {
      await fetch(`${API}/reviews/kpt/${itemId}`, {
        method: "DELETE",
        headers: { "X-User-Email": email },
      });
    } catch {
      setReview((prev) => prev ? { ...prev, kpt_items: prevItems } : prev);
    }
  }

  function itemsOf(type: KPTType): KPTItem[] {
    return review?.kpt_items.filter((i) => i.type === type) ?? [];
  }

  if (status === "loading" || loading) {
    return (
      <main>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">週の振り返り</h1>
          </div>
        </div>
        <div className="flex justify-center py-16 text-gray-400 text-sm">読み込み中…</div>
      </main>
    );
  }

  return (
    <main>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="戻る"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">週の振り返り</h1>
        </div>
        <HamburgerMenu
          user={session?.user}
          onSignOut={() => signOut({ callbackUrl: "/login" })}
          items={[
            {
              label: "TODO",
              onClick: () => router.push("/"),
              icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
            },
            {
              label: "TODOメモ",
              onClick: () => router.push("/memo"),
              icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
            },
            {
              label: "テンプレートを管理",
              onClick: () => router.push("/templates"),
              icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>,
            },
            {
              label: "月の振り返り",
              onClick: () => router.push("/review/monthly"),
              icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
            },
          ]}
        />
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentWeekStart(getPrevSundayStr(currentWeekStart))}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">
            {formatWeekRange(currentWeekStart)}
          </p>
          {isCurrentWeek && (
            <span className="text-xs text-indigo-500 font-medium">今週</span>
          )}
        </div>
        <button
          onClick={() => setCurrentWeekStart(getNextSundayStr(currentWeekStart))}
          disabled={isCurrentWeek}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 先週のTry達成状況 */}
      {prevTryItems.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-3 uppercase tracking-wide">
            先週のTry
          </p>
          <ul className="space-y-2">
            {prevTryItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span className={`mt-0.5 text-sm ${item.is_completed ? "text-emerald-500" : "text-gray-300"}`}>
                  {item.is_completed ? "✓" : "○"}
                </span>
                <span className={`text-sm ${item.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPTセクション */}
      {(["keep", "problem", "try"] as KPTType[]).map((type) => {
        const cfg = KPT_CONFIG[type];
        const items = itemsOf(type);

        return (
          <div key={type} className={`mb-4 rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
            {/* セクションヘッダー */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span>{cfg.emoji}</span>
                <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                {items.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setAddingType(addingType === type ? null : type);
                  setNewContent("");
                }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${cfg.color} hover:bg-white/60`}
                aria-label="追加"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* アイテム一覧 */}
            {items.length > 0 && (
              <ul className="px-4 pb-3 space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    {type === "try" ? (
                      /* Try: チェックボタン＋シンプルテキスト（・なし）、既存の編集ボタンも維持 */
                      <div className="flex items-start gap-2 group">
                        <button
                          onClick={() => handleToggleComplete(item)}
                          className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                            item.is_completed
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "border-blue-300 hover:border-blue-400"
                          }`}
                        >
                          {item.is_completed && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {editingId === item.id ? (
                          <div className="flex-1 flex gap-2">
                            <textarea
                              ref={editRef}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onBlur={() => window.scrollTo(0, 0)}
                              className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              rows={2}
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleEditSave(item.id)}
                                className="text-xs px-2 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`flex-1 text-sm leading-relaxed ${
                              item.is_completed ? "line-through text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {item.content}
                          </span>
                        )}

                        {editingId !== item.id && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => { setEditingId(item.id); setEditContent(item.content); }}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white/80 rounded"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : editingId === item.id ? (
                      /* Keep/Problem: 編集中（インライン） */
                      <div className="bg-white rounded-xl border border-indigo-300 shadow-sm p-3">
                        <textarea
                          ref={editRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => {
                            if (editContent.trim()) {
                              handleEditSave(item.id);
                            } else {
                              setEditingId(null);
                            }
                          }}
                          className="w-full text-sm resize-none focus:outline-none text-gray-800 bg-transparent"
                          rows={2}
                        />
                      </div>
                    ) : (
                      /* Keep/Problem: 表示（カード形式、クリックで編集） */
                      <div className="group/card flex items-start gap-1.5">
                        <div
                          className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow p-3 cursor-pointer transition-all"
                          onClick={() => { setEditingId(item.id); setEditContent(item.content); }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex-1 text-sm leading-relaxed text-gray-800">
                              {item.content}
                            </span>
                            {savingId === item.id ? (
                              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">保存中…</span>
                            ) : (
                              <svg
                                className="w-3.5 h-3.5 text-gray-200 group-hover/card:text-gray-400 flex-shrink-0 mt-0.5 transition-colors"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="opacity-0 group-hover/card:opacity-100 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 rounded-lg transition-all flex-shrink-0 mt-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 追加フォーム */}
            {addingType === type && (
              <div className="px-4 pb-4">
                <textarea
                  ref={inputRef}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                    if (e.key === "Escape") { setAddingType(null); setNewContent(""); }
                  }}
                  onBlur={() => window.scrollTo(0, 0)}
                  placeholder={`${cfg.label}を入力…`}
                  className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleAdd}
                    disabled={!newContent.trim()}
                    className="flex-1 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => { setAddingType(null); setNewContent(""); }}
                    className="px-4 py-1.5 text-sm bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* AI分析セクション */}
      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <p className="text-xs font-semibold text-indigo-700 mb-3 uppercase tracking-wide">
          ✨ AI コーチからのフィードバック
        </p>

        {aiAnalysis ? (
          <>
            <div className="prose prose-sm max-w-none prose-headings:text-indigo-800 prose-headings:font-bold prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-800 mb-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnalysis}</ReactMarkdown>
            </div>
            <button
              disabled
              className="w-full py-2 text-sm font-medium text-indigo-400 border border-indigo-200 rounded-xl opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
            >
              ✨ AIで分析する
            </button>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              {new Date(aiCreatedAt!).toLocaleString("ja-JP")}に生成済み
            </p>
          </>
        ) : (
          <>
            {isGenerating && (
              <p className="text-sm text-indigo-600 text-center mb-3">
                分析中...少々お待ちください
              </p>
            )}
            <button
              onClick={handleGenerateAnalysis}
              disabled={!hasKPTItems || isGenerating}
              title={!hasKPTItems ? "KPTを入力してから分析できます" : undefined}
              className="w-full py-2.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-xl hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  分析中...
                </>
              ) : (
                <>✨ AIで分析する</>
              )}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
