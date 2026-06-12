"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import { PageLoading } from "@/components/PageLoading";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/api";

interface MonthlyReview {
  id: number;
  year_month: string;
  next_month_goal: string | null;
}

interface DailyRate {
  date: string;
  rate: number;
  checked: number;
  total: number;
}

interface WeeklyRate {
  week_start: string;
  rate: number;
}

interface MonthlyStats {
  overall_rate: number;
  streak: number;
  daily_rates: DailyRate[];
  weekly_rates: WeeklyRate[];
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function getPrevYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function getNextYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}週`;
}

function rateToColor(rate: number): string {
  if (rate === 0) return "#e5e7eb";       // gray-200
  if (rate < 0.4) return "#fde68a";      // amber-200
  if (rate < 0.7) return "#6ee7b7";      // emerald-300
  return "#34d399";                       // emerald-400
}

export default function MonthlyReviewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentYM, setCurrentYM] = useState(getCurrentYearMonth());
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiCreatedAt, setAiCreatedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const todayYM = getCurrentYearMonth();
  const isPast = currentYM < todayYM;
  const isFuture = currentYM > todayYM;
  const isCurrent = currentYM === todayYM;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    loadData();
  }, [currentYM, status, session]);

  async function loadData() {
    setLoading(true);
    setSaved(false);
    setAiAnalysis(null);
    setAiCreatedAt(null);
    const email = session!.user!.email!;
    const h = { "X-User-Email": email };
    try {
      const [reviewRes, statsRes, analysisRes] = await Promise.all([
        apiFetch(`/reviews/monthly/${currentYM}`, { headers: h }),
        apiFetch(`/reviews/monthly/${currentYM}/stats`, { headers: h }),
        apiFetch(`/reviews/monthly/${currentYM}/analysis`, { headers: h }),
      ]);
      const reviewData: MonthlyReview = await reviewRes.json();
      setReview(reviewData);
      setGoal(reviewData.next_month_goal ?? "");

      if (statsRes.ok) {
        const statsData: MonthlyStats = await statsRes.json();
        setStats(statsData);
      }

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
      const res = await apiFetch(
        `/reviews/monthly/${currentYM}/analysis/generate`,
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

  async function handleSave() {
    if (!review) return;
    setSaving(true);
    const email = session!.user!.email!;
    const res = await apiFetch(`/reviews/monthly/${review.id}`, {
      method: "PUT",
      headers: { "X-User-Email": email },
      body: JSON.stringify({ next_month_goal: goal }),
    });
    const updated: MonthlyReview = await res.json();
    setReview(updated);
    setSaving(false);
    setSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  const overallPct = stats ? Math.round(stats.overall_rate * 100) : null;
  const hasStats = stats !== null && stats.daily_rates.length > 0;

  if (status === "loading" || loading) return <PageLoading />;

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
          <h1 className="text-xl font-bold text-gray-900">月の振り返り</h1>
        </div>
        <HamburgerMenu
          user={session?.user}
          onSignOut={() => signOut({ callbackUrl: "/login" })}
          items={[
            { label: "TODO", onClick: () => router.push("/"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
            { label: "コーチング", onClick: () => router.push("/coaching"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
            { label: "テンプレートを管理", onClick: () => router.push("/templates"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg> },
            { label: "週の振り返り", onClick: () => router.push("/review/weekly"), icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
          ]}
        />
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentYM(getPrevYearMonth(currentYM))}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">{formatYearMonth(currentYM)}</p>
          {isCurrent && <span className="text-xs text-indigo-500 font-medium">今月</span>}
          {isPast && <span className="text-xs text-gray-400">過去</span>}
          {isFuture && <span className="text-xs text-orange-400">未来</span>}
        </div>
        <button
          onClick={() => setCurrentYM(getNextYearMonth(currentYM))}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ---- セクション1: 達成度サマリー ---- */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">📊 達成度サマリー</h2>

        {/* 全体達成率 & streak */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600">
              {overallPct !== null ? `${overallPct}%` : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">月間達成率</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-orange-500">
              {stats ? stats.streak : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">連続達成日数</p>
          </div>
        </div>

        {/* 日ごとの達成率グラフ */}
        {stats && stats.daily_rates.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">日別達成率</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stats.daily_rates} barSize={8} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00");
                    return d.getDate() % 5 === 0 ? String(d.getDate()) : "";
                  }}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} ticks={[0, 0.5, 1]} />
                <Tooltip
                  formatter={(value: unknown) => [`${Math.round((value as number) * 100)}%`, "達成率"]}
                  labelFormatter={(label: unknown) => formatMonthDay(String(label))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                  {stats.daily_rates.map((entry, i) => (
                    <Cell key={i} fill={rateToColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 週ごとの達成率 */}
        {stats && stats.weekly_rates.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">週別達成率</p>
            <div className="space-y-2">
              {stats.weekly_rates.map((wr) => {
                const pct = Math.round(wr.rate * 100);
                return (
                  <div key={wr.week_start} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">{formatWeekLabel(wr.week_start)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!stats || stats.daily_rates.length === 0) && (
          <p className="text-sm text-gray-400 italic text-center py-4">この月のログデータがありません</p>
        )}
      </div>

      {/* ---- AI分析セクション ---- */}
      <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
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
              disabled={!hasStats || isGenerating}
              title={!hasStats ? "達成率データがありません" : undefined}
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

      {/* ---- セクション2: 来月の目標 ---- */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">🎯 来月の目標</h2>
        </div>
        <textarea
          value={goal}
          onChange={(e) => { setGoal(e.target.value); setSaved(false); }}
          placeholder="来月取り組みたいことを書いてください…"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-800 placeholder-gray-300"
          rows={4}
        />
        <div className="flex items-center justify-end gap-3 mt-2">
          {saved && (
            <span className="text-xs text-emerald-500">保存しました ✓</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    </main>
  );
}
