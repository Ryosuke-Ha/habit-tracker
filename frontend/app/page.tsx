"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import LoadingOverlay from "@/components/LoadingOverlay";
import HabitList from "@/components/HabitList";
import HamburgerMenu from "@/components/HamburgerMenu";

interface Template { id: number; name: string; }

interface Habit {
  id: number;
  template_id: number;
  title: string;
  scheduled_time: string;
  location: string;
  order: number;
}

interface LogEntry { id: number; habit_id: number; is_checked: boolean; }
interface TryItem { id: number; content: string; is_completed: boolean; }
type MonthlyGoalStatus = "no_goal" | "has_goal";

interface PersistentTodo {
  id: number;
  title: string;
  scheduled_time: string | null;
  location: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WEEKDAY_LABELS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

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

type Phase = "initial" | "loading" | "content";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<Phase>("initial");
  const [animationDone, setAnimationDone] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState<string>("");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<number, { logId: number; isChecked: boolean }>>({});
  const [persistentTodos, setPersistentTodos] = useState<PersistentTodo[]>([]);
  const [tryItems, setTryItems] = useState<TryItem[]>([]);
  const [tryStatus, setTryStatus] = useState<"no_review" | "no_items" | "has_items">("no_review");
  const [monthlyGoal, setMonthlyGoal] = useState("");
  const [monthlyGoalStatus, setMonthlyGoalStatus] = useState<MonthlyGoalStatus>("no_goal");

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalTime, setModalTime] = useState("07:00");
  const [modalLocation, setModalLocation] = useState("");
  const [isPersistentModal, setIsPersistentModal] = useState(false);

  const weekdayLabel = WEEKDAY_LABELS[new Date().getDay()];

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/login"); return; }
    const alreadyLaunched = localStorage.getItem("habit_app_launched");
    if (alreadyLaunched) {
      setAnimationDone(true);
      setShowAnimation(false);
    } else {
      setShowAnimation(true);
    }
    setPhase("loading");
    fetchData();
  }, [status, router]);

  useEffect(() => {
    if (animationDone && dataReady) setPhase("content");
  }, [animationDone, dataReady]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Escape") closeModal(); }
    if (addModalOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addModalOpen]);

  async function fetchData() {
    const email = session?.user?.email;
    const authHeaders: Record<string, string> = email ? { "X-User-Email": email } : {};

    try {
      const templatesRes = await fetch(`${API}/templates`);
      const templates: Template[] = await templatesRes.json();

      let matched: Template | undefined;
      const storedMap = localStorage.getItem("habit_day_template_map");
      if (storedMap) {
        try {
          const map: Record<string, string> = JSON.parse(storedMap);
          const dayKey = String(new Date().getDay());
          const idStr = map[dayKey];
          if (idStr) matched = templates.find((t) => t.id === parseInt(idStr));
        } catch { /* ignore */ }
      }
      if (!matched) {
        const fallback = new Date().getDay() === 0 || new Date().getDay() === 6 ? "休日" : "平日";
        matched = templates.find((t) => t.name === fallback) ?? templates[0];
      }
      if (!matched) { setDataReady(true); return; }

      setTemplateId(matched.id);
      setTemplateName(matched.name);

      const [habitsRes, logsRes, tryRes, goalRes, persistentRes] = await Promise.all([
        fetch(`${API}/templates/${matched.id}/habits`),
        fetch(`${API}/logs/today?template_id=${matched.id}`),
        email ? fetch(`${API}/reviews/weekly/current/try-items`, { headers: authHeaders }) : Promise.resolve(null),
        email ? fetch(`${API}/reviews/monthly/current/goal`, { headers: authHeaders }) : Promise.resolve(null),
        email ? fetch(`${API}/persistent-todos`, { headers: authHeaders }) : Promise.resolve(null),
      ]);

      const habitsData: Habit[] = await habitsRes.json();
      const logsData: LogEntry[] = await logsRes.json();
      setHabits(habitsData);
      const logMap: Record<number, { logId: number; isChecked: boolean }> = {};
      logsData.forEach((l) => { logMap[l.habit_id] = { logId: l.id, isChecked: l.is_checked }; });
      setHabitLogs(logMap);

      if (tryRes) {
        if (tryRes.status === 404) {
          setTryStatus("no_review");
        } else if (tryRes.ok) {
          const tryData: TryItem[] = await tryRes.json();
          setTryItems(tryData);
          setTryStatus(tryData.length > 0 ? "has_items" : "no_items");
        }
      }

      if (goalRes?.ok) {
        const goalData: { goal: string } = await goalRes.json();
        setMonthlyGoal(goalData.goal);
        setMonthlyGoalStatus("has_goal");
      } else {
        setMonthlyGoalStatus("no_goal");
      }

      if (persistentRes?.ok) {
        const pData: PersistentTodo[] = await persistentRes.json();
        setPersistentTodos(pData);
      }
    } finally {
      setDataReady(true);
    }
  }

  function openModal() {
    setModalTitle(""); setModalTime("07:00"); setModalLocation("");
    setIsPersistentModal(false); setAddModalOpen(true);
  }
  function closeModal() { setAddModalOpen(false); }

  async function handleModalAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTitle.trim()) return;
    const email = session?.user?.email;
    const title = modalTitle.trim();
    const time = modalTime;
    const location = modalLocation.trim();

    if (isPersistentModal) {
      if (!email) return;
      const tempId = -Date.now();
      const tempTodo: PersistentTodo = { id: tempId, title, scheduled_time: time || null, location: location || null, is_completed: false, completed_at: null };
      setPersistentTodos((prev) => [...prev, tempTodo]);
      closeModal();
      try {
        const res = await fetch(`${API}/persistent-todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Email": email },
          body: JSON.stringify({ title, scheduled_time: time || null, location }),
        });
        const newTodo: PersistentTodo = await res.json();
        setPersistentTodos((prev) => prev.map((t) => (t.id === tempId ? newTodo : t)));
      } catch {
        setPersistentTodos((prev) => prev.filter((t) => t.id !== tempId));
      }
    } else {
      if (!templateId) return;
      const tempId = -Date.now();
      const tempHabit: Habit = { id: tempId, template_id: templateId, title, scheduled_time: time, location, order: 0 };
      setHabits((prev) => [...prev, tempHabit].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
      closeModal();
      try {
        const res = await fetch(`${API}/habits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, scheduled_time: time, location, template_id: templateId }),
        });
        const newHabit: Habit = await res.json();
        const logRes = await fetch(`${API}/logs/today?template_id=${templateId}`);
        const logsData: LogEntry[] = await logRes.json();
        setHabits((prev) => prev.map((h) => (h.id === tempId ? newHabit : h)).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
        const logMap: Record<number, { logId: number; isChecked: boolean }> = {};
        logsData.forEach((l) => { logMap[l.habit_id] = { logId: l.id, isChecked: l.is_checked }; });
        setHabitLogs(logMap);
      } catch {
        setHabits((prev) => prev.filter((h) => h.id !== tempId));
      }
    }
  }

  async function handleTryToggle(itemId: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prevItem = tryItems.find((i) => i.id === itemId);
    if (!prevItem) return;
    setTryItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, is_completed: !i.is_completed } : i)));
    try {
      await fetch(`${API}/reviews/kpt/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Email": email },
        body: JSON.stringify({ is_completed: !prevItem.is_completed }),
      });
    } catch {
      setTryItems((prev) => prev.map((i) => (i.id === itemId ? prevItem : i)));
    }
  }

  async function handleToggleHabit(habitId: number) {
    const prevLog = habitLogs[habitId];
    setHabitLogs((prev) => ({
      ...prev,
      [habitId]: { logId: prevLog?.logId ?? 0, isChecked: !(prevLog?.isChecked ?? false) },
    }));
    try {
      const res = await fetch(`${API}/logs/${habitId}/toggle`, { method: "POST" });
      const updated: LogEntry = await res.json();
      // logId のみサーバー値で更新（isChecked はオプティミスティック値を維持）
      setHabitLogs((prev) => ({
        ...prev,
        [updated.habit_id]: { logId: updated.id, isChecked: prev[updated.habit_id]?.isChecked ?? updated.is_checked },
      }));
    } catch {
      setHabitLogs((prev) => {
        if (prevLog !== undefined) return { ...prev, [habitId]: prevLog };
        const next = { ...prev };
        delete next[habitId];
        return next;
      });
    }
  }

  async function handleDeleteHabit(habitId: number) {
    const prevHabits = habits;
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    try {
      await fetch(`${API}/habits/${habitId}`, { method: "DELETE" });
    } catch {
      setHabits(prevHabits);
    }
  }

  function handleEditHabit(habitId: number, data: { title: string; scheduled_time: string; location: string }): Promise<void> {
    const prevHabit = habits.find((h) => h.id === habitId);
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? { ...h, ...data } : h)).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
    );
    fetch(`${API}/habits/${habitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then((updated: Habit) => {
        setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
      })
      .catch(() => {
        if (prevHabit) setHabits((prev) => prev.map((h) => (h.id === habitId ? prevHabit : h)).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
      });
    return Promise.resolve();
  }

  async function handleTogglePersistent(id: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prevTodo = persistentTodos.find((t) => t.id === id);
    setPersistentTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t)));
    try {
      await fetch(`${API}/persistent-todos/${id}/complete`, {
        method: "POST",
        headers: { "X-User-Email": email },
      });
    } catch {
      if (prevTodo) setPersistentTodos((prev) => prev.map((t) => (t.id === id ? prevTodo : t)));
    }
  }

  async function handleDeletePersistent(id: number) {
    const email = session?.user?.email;
    if (!email) return;
    const prevTodos = persistentTodos;
    setPersistentTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`${API}/persistent-todos/${id}`, { method: "DELETE", headers: { "X-User-Email": email } });
    } catch {
      setPersistentTodos(prevTodos);
    }
  }

  function handleEditPersistent(id: number, data: { title: string; scheduled_time: string; location: string }): Promise<void> {
    const email = session?.user?.email;
    if (!email) return Promise.resolve();
    const prevTodo = persistentTodos.find((t) => t.id === id);
    setPersistentTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: data.title, scheduled_time: data.scheduled_time || null, location: data.location || null } : t))
    );
    fetch(`${API}/persistent-todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-User-Email": email },
      body: JSON.stringify({ title: data.title, scheduled_time: data.scheduled_time || null, location: data.location }),
    })
      .then((r) => r.json())
      .then((updated: PersistentTodo) => {
        setPersistentTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      })
      .catch(() => {
        if (prevTodo) setPersistentTodos((prev) => prev.map((t) => (t.id === id ? prevTodo : t)));
      });
    return Promise.resolve();
  }

  return (
    <>
      {phase === "loading" && showAnimation && (
        <LoadingOverlay onComplete={() => {
          localStorage.setItem("habit_app_launched", "true");
          setAnimationDone(true);
        }} />
      )}

      {/* Add TODO modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">TODOを追加</h2>

            {/* Persistent toggle */}
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-700">持ち越しTODO</p>
                <p className="text-xs text-gray-400">完了まで毎日表示されます</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPersistentModal((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isPersistentModal ? "bg-red-500" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPersistentModal ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <form onSubmit={handleModalAdd} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">何をする？</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="例: 英語学習"
                  required
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">いつ？</label>
                  <select
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">どこで？</label>
                  <input
                    type="text"
                    value={modalLocation}
                    onChange={(e) => setModalLocation(e.target.value)}
                    placeholder="例: カフェ"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={!modalTitle.trim()}
                  className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isPersistentModal ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}
                >
                  {isPersistentModal ? "持ち越しとして追加" : "追加する"}
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

      <main className={`transition-opacity duration-500 ${phase === "content" ? "opacity-100" : "opacity-0"}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {weekdayLabel}
                <span className="text-gray-300 mx-2 font-light">｜</span>
                <button
                  onClick={() => router.push("/templates")}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  {templateName}
                </button>
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <HamburgerMenu
              user={session?.user}
              onSignOut={() => signOut({ callbackUrl: "/login" })}
              items={[
                { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
                { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
                { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
              ]}
            />
          </div>
        </div>

        {/* 今月の目標 */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">🎯 今月の目標</p>
            <button onClick={() => router.push("/review/monthly")} className="text-xs text-blue-600 hover:text-blue-800 underline">振り返りへ</button>
          </div>
          {monthlyGoalStatus === "has_goal" ? (
            <p className="text-sm text-gray-800 leading-relaxed">{monthlyGoal}</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-gray-400 italic">今月の目標が未設定です</p>
              <button onClick={() => router.push("/review/monthly")} className="text-sm text-blue-600 hover:text-blue-800">目標を設定する →</button>
            </div>
          )}
        </div>

        {/* 先週のTry */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">🚀 先週のTry</p>
            <button onClick={() => router.push("/review/weekly")} className="text-xs text-amber-600 hover:text-amber-800 underline">振り返りへ</button>
          </div>
          {tryStatus === "has_items" && (
            <ul className="space-y-2">
              {tryItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <button
                    onClick={() => handleTryToggle(item.id)}
                    className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${item.is_completed ? "bg-amber-400 border-amber-400 text-white" : "border-amber-300 hover:border-amber-400"}`}
                  >
                    {item.is_completed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`text-sm leading-relaxed ${item.is_completed ? "line-through text-gray-400" : "text-gray-800"}`}>{item.content}</span>
                </li>
              ))}
            </ul>
          )}
          {tryStatus === "no_items" && <p className="text-sm text-gray-400 italic">今週のTryはありません</p>}
          {tryStatus === "no_review" && (
            <div className="space-y-1">
              <p className="text-sm text-gray-400 italic">先週の振り返りが未実施です</p>
              <button onClick={() => router.push("/review/weekly")} className="text-sm text-amber-600 hover:text-amber-800">振り返りを記入する →</button>
            </div>
          )}
        </div>

        {/* Add button */}
        <button
          onClick={openModal}
          className="mb-4 w-full py-2.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          TODOを追加
        </button>

        <HabitList
          habits={habits}
          habitLogs={habitLogs}
          persistentTodos={persistentTodos}
          onToggleHabit={handleToggleHabit}
          onDeleteHabit={handleDeleteHabit}
          onEditHabit={handleEditHabit}
          onTogglePersistent={handleTogglePersistent}
          onDeletePersistent={handleDeletePersistent}
          onEditPersistent={handleEditPersistent}
        />
      </main>
    </>
  );
}
