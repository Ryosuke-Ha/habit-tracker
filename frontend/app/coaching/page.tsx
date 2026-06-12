"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import { PageLoading } from "@/components/PageLoading";
import { apiFetch } from "@/lib/api";

interface CoachingSession {
  id: number;
  session_date: string;
  status: "in_progress" | "completed";
  created_at: string;
}

interface CoachingGoal {
  id: number;
  title: string;
  due_date: string | null;
  status: string;
  created_at: string;
}

function getThisWeekSaturday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return saturday;
}

function isTodaySaturday(): boolean {
  return new Date().getDay() === 6;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

const MENU_ITEMS_FN = (router: ReturnType<typeof useRouter>) => [
  { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { label: "TODOメモ", onClick: () => router.push("/memo"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
  { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { label: "月の振り返り", onClick: () => router.push("/review/monthly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
];

export default function CoachingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [currentSession, setCurrentSession] = useState<CoachingSession | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);

  const menuItems = MENU_ITEMS_FN(router);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/login"); return; }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  async function fetchData() {
    const email = session?.user?.email;
    if (!email) return;
    setLoading(true);
    try {
      const [currentRes, sessionsRes, goalsRes] = await Promise.all([
        apiFetch(`/coaching/sessions/current`, { headers: { "X-User-Email": email } }),
        apiFetch(`/coaching/sessions`, { headers: { "X-User-Email": email } }),
        apiFetch(`/coaching/goals`, { headers: { "X-User-Email": email } }),
      ]);
      setCurrentSession(currentRes.ok ? await currentRes.json() : null);
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleStartSession() {
    const email = session?.user?.email;
    if (!email || startingSession) return;
    setStartingSession(true);
    try {
      const res = await apiFetch(`/coaching/sessions`, {
        method: "POST",
        headers: { "X-User-Email": email },
      });
      if (res.ok) {
        const newSession = await res.json();
        router.push(`/coaching/${newSession.id}`);
      } else {
        setStartingSession(false);
      }
    } catch {
      setStartingSession(false);
    }
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    const email = session?.user?.email;
    if (!email || !newGoalTitle.trim() || addingGoal) return;
    setAddingGoal(true);
    try {
      const res = await apiFetch(`/coaching/goals`, {
        method: "POST",
        headers: { "X-User-Email": email },
        body: JSON.stringify({ title: newGoalTitle.trim() }),
      });
      if (res.ok) {
        const newGoal = await res.json();
        setGoals((prev) => [newGoal, ...prev]);
        setNewGoalTitle("");
        setAddGoalOpen(false);
      }
    } finally {
      setAddingGoal(false);
    }
  }

  async function handleCompleteGoal(goalId: number) {
    const email = session?.user?.email;
    if (!email) return;
    const res = await apiFetch(`/coaching/goals/${goalId}`, {
      method: "PUT",
      headers: { "X-User-Email": email },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    }
  }

  const saturday = getThisWeekSaturday();
  const isSaturday = isTodaySaturday();

  if (status === "loading" || loading) return <PageLoading />;

  return (
    <main>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">コーチング</h1>
          <p className="text-xs text-gray-500 mt-0.5">認知科学コーチング・毎週土曜日</p>
        </div>
        <HamburgerMenu
          user={session?.user}
          onSignOut={() => signOut({ callbackUrl: "/login" })}
          items={menuItems}
        />
      </div>

      {/* Current week session card */}
      <div className="mb-8 rounded-2xl border border-indigo-800 bg-indigo-950/50 p-5">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3">今週のセッション</p>
        {currentSession ? (
          currentSession.status === "in_progress" ? (
            <div>
              <p className="text-white text-sm mb-4">セッションが進行中です</p>
              <button
                onClick={() => router.push(`/coaching/${currentSession.id}`)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                セッションを続ける
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm">今週のセッションは完了しています</p>
              <button
                onClick={() => router.push(`/coaching/${currentSession.id}`)}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                セッション内容を見る
              </button>
            </div>
          )
        ) : (
          <div>
            {!isSaturday && (
              <p className="text-gray-400 text-sm mb-4">
                次のセッションは{saturday.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}です
              </p>
            )}
            <button
              onClick={handleStartSession}
              disabled={startingSession}
              className={`w-full py-3 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isSaturday
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              }`}
            >
              {startingSession ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  セッション準備中...
                </span>
              ) : isSaturday ? (
                "今週のセッションを開始する"
              ) : (
                "早めに始める"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Active Goals */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">アクティブなゴール</h2>
          <button
            onClick={() => setAddGoalOpen(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            目標を追加
          </button>
        </div>

        {addGoalOpen && (
          <form onSubmit={handleAddGoal} className="mb-3 flex gap-2">
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="新しい目標を入力..."
              autoFocus
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!newGoalTitle.trim() || addingGoal}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-500 disabled:opacity-50"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => { setAddGoalOpen(false); setNewGoalTitle(""); }}
              className="px-3 py-2 text-gray-500 text-sm hover:text-gray-300"
            >
              取消
            </button>
          </form>
        )}

        {goals.length === 0 && !addGoalOpen ? (
          <p className="text-sm text-gray-600 italic">ゴールがありません</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((goal) => (
              <li key={goal.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{goal.title}</p>
                  {goal.due_date && (
                    <p className="text-xs text-gray-500 mt-0.5">期限: {formatDate(goal.due_date)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleCompleteGoal(goal.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-full border border-gray-600 hover:bg-indigo-600 hover:border-indigo-600 transition-colors flex items-center justify-center"
                  title="完了にする"
                >
                  <svg className="w-3 h-3 text-gray-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Past sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">過去のセッション</h2>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => router.push(`/coaching/${s.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors text-left"
                >
                  <span className="text-sm text-gray-300">{formatDate(s.session_date)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "completed" ? "bg-green-900/50 text-green-400" : "bg-amber-900/50 text-amber-400"}`}>
                    {s.status === "completed" ? "完了" : "進行中"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
