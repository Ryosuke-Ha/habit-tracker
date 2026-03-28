"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HamburgerMenu from "@/components/HamburgerMenu";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScheduledTodo {
  id: number;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  location: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}
const TIME_OPTIONS = generateTimeOptions();

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

export default function MemoPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [todos, setTodos] = useState<ScheduledTodo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDate, setModalDate] = useState(getTodayStr());
  const [modalTime, setModalTime] = useState("");
  const [modalLocation, setModalLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/login"); return; }
    fetchTodos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Escape") closeModal(); }
    if (modalOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  async function fetchTodos() {
    const email = session?.user?.email;
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/scheduled-todos`, {
        headers: { "X-User-Email": email },
      });
      if (res.ok) {
        const data: ScheduledTodo[] = await res.json();
        setTodos(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingId(null);
    setModalTitle("");
    setModalDate(getTodayStr());
    setModalTime("");
    setModalLocation("");
    setModalOpen(true);
  }

  function openEditModal(todo: ScheduledTodo) {
    setEditingId(todo.id);
    setModalTitle(todo.title);
    setModalDate(todo.scheduled_date);
    setModalTime(todo.scheduled_time ?? "");
    setModalLocation(todo.location ?? "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTitle.trim() || isSubmitting) return;
    const email = session?.user?.email;
    if (!email) return;

    const body = {
      title: modalTitle.trim(),
      scheduled_date: modalDate,
      scheduled_time: modalTime || null,
      location: modalLocation.trim() || "",
    };

    setIsSubmitting(true);
    try {
      if (editingId !== null) {
        const res = await fetch(`${API}/scheduled-todos/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-User-Email": email },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated: ScheduledTodo = await res.json();
          setTodos((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
          closeModal();
        }
      } else {
        const res = await fetch(`${API}/scheduled-todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Email": email },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created: ScheduledTodo = await res.json();
          setTodos((prev) => [...prev, created].sort((a, b) => {
            if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
            return (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "");
          }));
          closeModal();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prev = todos;
    setTodos((t) => t.filter((item) => item.id !== id));
    try {
      const res = await fetch(`${API}/scheduled-todos/${id}`, {
        method: "DELETE",
        headers: { "X-User-Email": email },
      });
      if (!res.ok && res.status !== 204) setTodos(prev);
    } catch {
      setTodos(prev);
    }
  }

  // Group todos by past / today / future
  const todayStr = getTodayStr();
  const past = todos.filter((t) => t.scheduled_date < todayStr);
  const today = todos.filter((t) => t.scheduled_date === todayStr);
  const future = todos.filter((t) => t.scheduled_date > todayStr);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  }

  function renderTodoItem(todo: ScheduledTodo) {
    return (
      <div
        key={todo.id}
        className={`flex items-center gap-3 p-3 rounded-xl border ${todo.is_completed ? "bg-gray-50 border-gray-100 opacity-50" : "bg-white border-gray-200"}`}
      >
        <div className="flex-1 min-w-0">
          {(todo.scheduled_time || todo.location) && (
            <p className="text-xs text-gray-400 mb-0.5">
              {todo.scheduled_time ? `🕐 ${todo.scheduled_time}` : ""}
              {todo.scheduled_time && todo.location ? "  " : ""}
              {todo.location ? `📍 ${todo.location}` : ""}
            </p>
          )}
          <p className={`text-sm font-medium truncate ${todo.is_completed ? "line-through text-gray-400" : "text-gray-800"}`}>
            {todo.title}
          </p>
        </div>
        {!todo.is_completed && (
          <button
            onClick={() => openEditModal(todo)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="編集"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => handleDelete(todo.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="削除"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    );
  }

  if (status === "loading" || loading) {
    return (
      <main>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" aria-label="戻る">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">TODOメモ</h1>
          </div>
          <HamburgerMenu
            user={session?.user}
            onSignOut={() => signOut({ callbackUrl: "/login" })}
            items={[
              { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
              { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
              { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
              { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
            ]}
          />
        </div>
        <div className="flex justify-center py-16 text-gray-400 text-sm">読み込み中…</div>
      </main>
    );
  }

  return (
    <>
      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              {editingId !== null ? "メモを編集" : "新しいメモを追加"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="例: 資料を印刷する"
                  required
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
                <input
                  type="date"
                  value={modalDate}
                  min={getTodayStr()}
                  onChange={(e) => setModalDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">時間（任意）</label>
                  <select
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option value="">未設定</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">場所（任意）</label>
                  <input
                    type="text"
                    value={modalLocation}
                    onChange={(e) => setModalLocation(e.target.value)}
                    placeholder="例: オフィス"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={!modalTitle.trim() || isSubmitting}
                  className="flex-1 py-2 text-white text-sm font-semibold rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingId !== null ? "保存する" : "追加する"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main>
        {/* Header */}
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
            <h1 className="text-xl font-bold text-gray-900">TODOメモ</h1>
          </div>
          <HamburgerMenu
            user={session?.user}
            onSignOut={() => signOut({ callbackUrl: "/login" })}
            items={[
              { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
              { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
              { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
              { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
            ]}
          />
        </div>

        {/* Add button */}
        <button
          onClick={openAddModal}
          className="mb-6 w-full py-2.5 text-sm font-medium text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 hover:border-purple-300 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新しいメモを追加
        </button>

        {todos.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">メモがありません</p>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">過去</h2>
            <div className="space-y-2">
              {past.map((todo) => (
                <div key={todo.id}>
                  <p className="text-xs text-gray-400 mb-1 ml-1">{formatDate(todo.scheduled_date)}</p>
                  {renderTodoItem(todo)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today */}
        {today.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">今日</h2>
            <div className="space-y-2">
              {today.map((todo) => renderTodoItem(todo))}
            </div>
          </section>
        )}

        {/* Future */}
        {future.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">今後</h2>
            <div className="space-y-2">
              {future.map((todo) => (
                <div key={todo.id}>
                  <p className="text-xs text-gray-400 mb-1 ml-1">{formatDate(todo.scheduled_date)}</p>
                  {renderTodoItem(todo)}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
