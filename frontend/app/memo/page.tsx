"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import { SkeletonMemoPage } from "@/components/Skeleton";

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
  notification_offset_1: string | null;
  notification_offset_2: string | null;
  notification_sent_1: boolean;
  notification_sent_2: boolean;
  // API-computed fields
  is_overdue: boolean;
  is_today: boolean;
  is_future: boolean;
  days_until: number;
  display_category: "overdue" | "today" | "future" | "past";
}

interface SubTask {
  id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

const NOTIFICATION_OPTIONS: { value: string | null; label: string; requiresTime: boolean }[] = [
  { value: null, label: "なし", requiresTime: false },
  { value: "on_time", label: "設定時刻", requiresTime: true },
  { value: "30min_before", label: "30分前", requiresTime: true },
  { value: "1hour_before", label: "1時間前", requiresTime: true },
  { value: "2hour_before", label: "2時間前", requiresTime: true },
  { value: "1day_before", label: "1日前", requiresTime: false },
  { value: "2day_before", label: "2日前", requiresTime: false },
];

function notificationLabel(offset: string | null): string {
  return NOTIFICATION_OPTIONS.find((o) => o.value === offset)?.label ?? "なし";
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

function getDefaultTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 0;
  const roundedHours = minutes < 30 ? hours : hours + 1;
  const finalHours = roundedHours >= 24 ? 23 : roundedHours;
  const finalMinutes = roundedHours >= 24 ? 30 : roundedMinutes;
  return `${String(finalHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`;
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

function sortByCategory(todos: ScheduledTodo[]): ScheduledTodo[] {
  const overdue = todos
    .filter((t) => t.display_category === "overdue")
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  const today = todos
    .filter((t) => t.display_category === "today")
    .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
  const future = todos
    .filter((t) => t.display_category === "future")
    .sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
      return (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "");
    });
  const past = todos.filter((t) => t.display_category === "past");
  return [...overdue, ...today, ...future, ...past];
}

export default function MemoPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [todos, setTodos] = useState<ScheduledTodo[]>([]);
  const [loading, setLoading] = useState(true);

  // Subtask state
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [subtasksMap, setSubtasksMap] = useState<Record<number, SubTask[]>>({});
  const [subtasksLoadedSet, setSubtasksLoadedSet] = useState<Record<number, boolean>>({});
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<number, string>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDate, setModalDate] = useState(getTodayStr());
  const [modalTime, setModalTime] = useState("");
  const [modalLocation, setModalLocation] = useState("");
  const [modalNotif1, setModalNotif1] = useState<string | null>(null);
  const [modalNotif2, setModalNotif2] = useState<string | null>(null);
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
    setModalTime(getDefaultTime());
    setModalLocation("");
    setModalNotif1(null);
    setModalNotif2(null);
    setModalOpen(true);
  }

  function openEditModal(todo: ScheduledTodo) {
    setEditingId(todo.id);
    setModalTitle(todo.title);
    setModalDate(todo.scheduled_date);
    setModalTime(todo.scheduled_time ?? getDefaultTime());
    setModalLocation(todo.location ?? "");
    setModalNotif1(todo.notification_offset_1);
    setModalNotif2(todo.notification_offset_2);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  // When time is cleared, reset time-dependent notification options
  function handleModalTimeChange(val: string) {
    setModalTime(val);
    if (!val) {
      const timeBasedValues = new Set(
        NOTIFICATION_OPTIONS.filter((o) => o.requiresTime).map((o) => o.value)
      );
      if (timeBasedValues.has(modalNotif1)) setModalNotif1(null);
      if (timeBasedValues.has(modalNotif2)) setModalNotif2(null);
    }
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
      notification_offset_1: modalNotif1,
      notification_offset_2: modalNotif2,
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
          setTodos((prev) => sortByCategory(prev.map((t) => (t.id === editingId ? updated : t))));
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
          setTodos((prev) => sortByCategory([...prev, created]));
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

  // Subtask handlers
  async function handleToggleExpand(id: number) {
    const nowOpen = !expandedIds[id];
    setExpandedIds((prev) => ({ ...prev, [id]: nowOpen }));
    if (nowOpen && !subtasksLoadedSet[id]) {
      const email = session?.user?.email;
      if (!email) return;
      try {
        const res = await fetch(`${API}/subtasks?todo_type=scheduled_todo&todo_id=${id}`, {
          headers: { "X-User-Email": email },
        });
        if (res.ok) {
          const data: SubTask[] = await res.json();
          setSubtasksMap((prev) => ({ ...prev, [id]: data }));
          setSubtasksLoadedSet((prev) => ({ ...prev, [id]: true }));
        }
      } catch {
        // ignore
      }
    }
  }

  async function handleAddSubtask(todoId: number) {
    const title = (newSubtaskTitles[todoId] ?? "").trim();
    if (!title) return;
    const email = session?.user?.email;
    if (!email) return;
    setNewSubtaskTitles((prev) => ({ ...prev, [todoId]: "" }));
    const tempId = -Date.now();
    const optimistic: SubTask = { id: tempId, title, is_completed: false, order: (subtasksMap[todoId] ?? []).length };
    setSubtasksMap((prev) => ({ ...prev, [todoId]: [...(prev[todoId] ?? []), optimistic] }));
    try {
      const res = await fetch(`${API}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Email": email },
        body: JSON.stringify({ todo_type: "scheduled_todo", todo_id: todoId, title }),
      });
      if (res.ok) {
        const created: SubTask = await res.json();
        setSubtasksMap((prev) => ({
          ...prev,
          [todoId]: (prev[todoId] ?? []).map((s) => (s.id === tempId ? created : s)),
        }));
      } else {
        setSubtasksMap((prev) => ({ ...prev, [todoId]: (prev[todoId] ?? []).filter((s) => s.id !== tempId) }));
      }
    } catch {
      setSubtasksMap((prev) => ({ ...prev, [todoId]: (prev[todoId] ?? []).filter((s) => s.id !== tempId) }));
    }
  }

  async function handleToggleSubtask(todoId: number, subtaskId: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prev = subtasksMap[todoId] ?? [];
    const updated = prev.map((s) => (s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s));
    setSubtasksMap((m) => ({ ...m, [todoId]: updated }));
    try {
      const res = await fetch(`${API}/subtasks/${subtaskId}/toggle`, {
        method: "POST",
        headers: { "X-User-Email": email },
      });
      if (res.ok) {
        const data: SubTask = await res.json();
        setSubtasksMap((m) => ({ ...m, [todoId]: (m[todoId] ?? []).map((s) => (s.id === subtaskId ? data : s)) }));
      } else {
        setSubtasksMap((m) => ({ ...m, [todoId]: prev }));
      }
    } catch {
      setSubtasksMap((m) => ({ ...m, [todoId]: prev }));
    }
  }

  async function handleDeleteSubtask(todoId: number, subtaskId: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prev = subtasksMap[todoId] ?? [];
    setSubtasksMap((m) => ({ ...m, [todoId]: prev.filter((s) => s.id !== subtaskId) }));
    try {
      const res = await fetch(`${API}/subtasks/${subtaskId}`, {
        method: "DELETE",
        headers: { "X-User-Email": email },
      });
      if (!res.ok && res.status !== 204) {
        setSubtasksMap((m) => ({ ...m, [todoId]: prev }));
      }
    } catch {
      setSubtasksMap((m) => ({ ...m, [todoId]: prev }));
    }
  }

  // Group todos by API-provided display_category (computed server-side)
  const overdue = todos.filter((t) => t.display_category === "overdue");
  const todayTodos = todos.filter((t) => t.display_category === "today");
  const future = todos.filter((t) => t.display_category === "future");
  // "past" (completed past dates) is intentionally not rendered

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  }

  function renderNotificationBadge(todo: ScheduledTodo) {
    const labels: string[] = [];
    if (todo.notification_offset_1) labels.push(notificationLabel(todo.notification_offset_1));
    if (todo.notification_offset_2) labels.push(notificationLabel(todo.notification_offset_2));
    if (labels.length === 0) return null;

    const allSent =
      (!todo.notification_offset_1 || todo.notification_sent_1) &&
      (!todo.notification_offset_2 || todo.notification_sent_2);

    return (
      <span className={`text-xs flex items-center gap-1 ${allSent ? "opacity-50" : ""}`}>
        🔔 {labels.join(" / ")}
      </span>
    );
  }

  function renderTodoItem(todo: ScheduledTodo) {
    const isExpanded = !!expandedIds[todo.id];
    const subtasks = subtasksMap[todo.id] ?? [];
    const subtaskCount = subtasksLoadedSet[todo.id] ? subtasks.length : 0;
    const newTitle = newSubtaskTitles[todo.id] ?? "";

    return (
      <div
        key={todo.id}
        className={`rounded-xl border overflow-hidden ${
          todo.is_completed
            ? "bg-gray-50 border-gray-100 opacity-50"
            : todo.is_overdue
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-200"
        }`}
      >
        {/* Card header — clickable to toggle accordion */}
        <div
          className="flex items-center gap-3 p-3 cursor-pointer select-none"
          onClick={() => handleToggleExpand(todo.id)}
        >
          <div className="flex-1 min-w-0">
            {(todo.scheduled_time || todo.location) && (
              <p className="text-xs text-gray-400 mb-0.5">
                {todo.scheduled_time ? `🕐 ${todo.scheduled_time}` : ""}
                {todo.scheduled_time && todo.location ? "  " : ""}
                {todo.location ? `📍 ${todo.location}` : ""}
              </p>
            )}
            <div className="flex items-center gap-2 min-w-0">
              {todo.is_overdue && (
                <span className="flex-shrink-0 text-xs font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">
                  ⚠️ 期限切れ
                </span>
              )}
              <p className={`text-sm font-medium truncate ${todo.is_completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                {todo.title}
              </p>
              {!isExpanded && subtasksLoadedSet[todo.id] && subtaskCount > 0 && (
                <span className="flex-shrink-0 text-xs font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                  {subtaskCount}
                </span>
              )}
            </div>
            {renderNotificationBadge(todo)}
          </div>
          {!todo.is_completed && (
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(todo); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="編集"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(todo.id); }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="削除"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Accordion body */}
        <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? "max-h-[500px]" : "max-h-0"}`}>
          <div className="px-3 pb-3 border-t border-gray-100">
            {/* Subtask list */}
            {subtasks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {subtasks.map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleToggleSubtask(todo.id, sub.id)}
                      className={`w-4 h-4 flex-shrink-0 rounded border transition-colors ${sub.is_completed ? "bg-purple-500 border-purple-500" : "border-gray-300 hover:border-purple-400"}`}
                      aria-label={sub.is_completed ? "未完了に戻す" : "完了にする"}
                    >
                      {sub.is_completed && (
                        <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-xs ${sub.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {sub.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(todo.id, sub.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-opacity"
                      aria-label="削除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Add subtask input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewSubtaskTitles((prev) => ({ ...prev, [todo.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSubtask(todo.id); } }}
                placeholder="サブタスクを追加..."
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder-gray-300"
              />
              <button
                onClick={() => handleAddSubtask(todo.id)}
                disabled={!newTitle.trim()}
                className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="追加"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hamburgerItems = [
    { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
    { label: "コーチング", onClick: () => router.push("/coaching"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
    { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
    { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  ];

  if (status === "loading" || loading) return <SkeletonMemoPage />;

  const hasTime = !!modalTime;

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
                    onChange={(e) => handleModalTimeChange(e.target.value)}
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
              {/* Notification settings */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">通知設定</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">通知1</label>
                    <select
                      value={modalNotif1 ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : e.target.value;
                        setModalNotif1(val);
                        if (val === null) setModalNotif2(null);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {NOTIFICATION_OPTIONS.map((opt) => (
                        <option
                          key={opt.value ?? "__null__"}
                          value={opt.value ?? ""}
                          disabled={!!(opt.requiresTime && !hasTime)}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">通知2</label>
                    <select
                      value={modalNotif2 ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : e.target.value;
                        setModalNotif2(val);
                      }}
                      disabled={modalNotif1 === null}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {NOTIFICATION_OPTIONS.map((opt) => (
                        <option
                          key={opt.value ?? "__null__"}
                          value={opt.value ?? ""}
                          disabled={
                            (opt.requiresTime && !hasTime) ||
                            (opt.value !== null && opt.value === modalNotif1)
                          }
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
          <HamburgerMenu user={session?.user} onSignOut={() => signOut({ callbackUrl: "/login" })} items={hamburgerItems} />
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

        {overdue.length === 0 && todayTodos.length === 0 && future.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">メモがありません</p>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">期限切れ</h2>
            <div className="space-y-2">
              {overdue.map((todo) => renderTodoItem(todo))}
            </div>
          </section>
        )}

        {/* Today */}
        {todayTodos.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">今日</h2>
            <div className="space-y-2">
              {todayTodos.map((todo) => renderTodoItem(todo))}
            </div>
          </section>
        )}

        {/* Future */}
        {future.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">今後</h2>
            <div className="space-y-4">
              {Object.entries(
                future.reduce((groups, todo) => {
                  if (!groups[todo.scheduled_date]) groups[todo.scheduled_date] = [];
                  groups[todo.scheduled_date].push(todo);
                  return groups;
                }, {} as Record<string, ScheduledTodo[]>)
              ).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs text-gray-400 mb-1.5 ml-1">{formatDate(date)}</p>
                  <div className="space-y-2">
                    {items.map((todo) => renderTodoItem(todo))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
