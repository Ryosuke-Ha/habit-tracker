import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import API_URL from '@/constants/api';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface MonthlyReview {
  id: number;
  user_id: string;
  year_month: string;
  next_month_goal: string | null;
  created_at: string;
  updated_at: string;
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

// ─── ヘルパー ────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ['日', '月', '火', '水', '木', '金', '土'];

function todayIsoDate(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function currentYearMonth(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

function prevYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

// ─── カラーユーティリティ ──────────────────────────────────────────────────────

function rateColor(rate: number, total: number, isFuture: boolean): string {
  if (isFuture || total === 0 || rate === 0) return '#1a1a1a';
  if (rate < 0.50) return '#854d0e';
  if (rate < 0.80) return '#ca8a04';
  return '#22c55e';
}

function barColor(rate: number): string {
  if (rate === 0) return '#2a2a2a';
  if (rate < 0.50) return '#854d0e';
  if (rate < 0.80) return '#ca8a04';
  return '#22c55e';
}

// ─── カレンダーグリッド構築 ────────────────────────────────────────────────────

type CalendarCell = {
  day: number;
  rate: number;
  total: number;
  isFuture: boolean;
} | null;

function buildCalendarRows(
  year: number,
  month: number,
  rateMap: Map<string, DailyRate>,
  todayStr: string,
): CalendarCell[][] {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);

  for (let d = 1; d <= totalDays; d++) {
    const dd = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    const dr = rateMap.get(dateStr);
    cells.push({
      day: d,
      rate: dr?.rate ?? 0,
      total: dr?.total ?? 0,
      isFuture: dateStr > todayStr,
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

export default function MonthlyScreen() {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';

  const currentYM = currentYearMonth();
  const [yearMonth, setYearMonth] = useState(currentYM);
  const [review, setReview] = useState<MonthlyReview | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [goalText, setGoalText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const isCurrent = yearMonth === currentYM;
  const isPast = yearMonth < currentYM;
  const isFuture = yearMonth > currentYM;

  const [year, month] = yearMonth.split('-').map(Number);

  // ─── データ取得 ─────────────────────────────────────────────────────────────

  const fetchReview = useCallback(async (ym: string) => {
    setLoadingReview(true);
    try {
      const url = ym === currentYM
        ? `${API_URL}/reviews/monthly/current`
        : `${API_URL}/reviews/monthly/${ym}`;
      const res = await fetch(url, { headers: { 'X-User-Email': userEmail } });
      if (res.ok) {
        const data: MonthlyReview = await res.json();
        setReview(data);
        setGoalText(data.next_month_goal ?? '');
      }
    } finally {
      setLoadingReview(false);
    }
  }, [userEmail, currentYM]);

  const fetchStats = useCallback(async (ym: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_URL}/reviews/monthly/${ym}/stats`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (res.ok) {
        const data: MonthlyStats = await res.json();
        setStats(data);
      } else {
        setStats(null);
      }
    } finally {
      setLoadingStats(false);
    }
  }, [userEmail]);

  useEffect(() => {
    setSaveError('');
    fetchReview(yearMonth);
    fetchStats(yearMonth);
  }, [yearMonth, fetchReview, fetchStats]);

  // ─── 月ナビゲーション ────────────────────────────────────────────────────────

  function goToPrev() { setYearMonth((ym) => prevYM(ym)); }
  function goToNext() { setYearMonth((ym) => nextYM(ym)); }
  function goToCurrent() { setYearMonth(currentYM); }

  // ─── 目標保存 ───────────────────────────────────────────────────────────────

  async function handleSaveGoal() {
    if (!review || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_URL}/reviews/monthly/${review.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
        },
        body: JSON.stringify({ next_month_goal: goalText }),
      });
      if (!res.ok) throw new Error();
      const updated: MonthlyReview = await res.json();
      setReview(updated);
    } catch {
      setSaveError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // ─── カレンダーデータ ────────────────────────────────────────────────────────

  const todayStr = todayIsoDate();
  const rateMap = new Map<string, DailyRate>();
  if (stats) {
    for (const dr of stats.daily_rates) rateMap.set(dr.date, dr);
  }
  const calendarRows = buildCalendarRows(year, month, rateMap, todayStr);

  // ─── レンダリング ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>月の振り返り</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrev} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            <Text style={styles.navBtnText}>前の月</Text>
          </TouchableOpacity>
          {!isCurrent && (
            <TouchableOpacity onPress={goToCurrent} style={styles.currentBtn}>
              <Text style={styles.currentBtnText}>今月</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={goToNext} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navBtnText}>次の月</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.monthLabel}>{formatYearMonth(yearMonth)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── 達成度サマリーカード ── */}
        <View style={styles.card}>
          {loadingStats ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {/* 達成率 + ストリーク */}
              <View style={styles.summaryRow}>
                <View style={styles.overallBlock}>
                  <Text style={styles.overallRate}>
                    {stats ? Math.round(stats.overall_rate * 100) : 0}%
                  </Text>
                  <Text style={styles.overallLabel}>月全体の達成率</Text>
                </View>
                <View style={styles.streakBlock}>
                  <Text style={styles.streakNum}>
                    {stats?.streak ?? 0}
                  </Text>
                  <Text style={styles.streakLabel}>🔥 連続達成日数</Text>
                </View>
              </View>

              {/* ヒートマップカレンダー */}
              <Text style={styles.sectionLabel}>日ごとの達成率</Text>
              <View style={styles.calendarHeader}>
                {WEEKDAY_SHORT.map((w) => (
                  <Text key={w} style={styles.calendarHeaderCell}>{w}</Text>
                ))}
              </View>
              {calendarRows.map((row, ri) => (
                <View key={ri} style={styles.calendarRow}>
                  {row.map((cell, ci) => (
                    <View
                      key={ci}
                      style={[
                        styles.calendarCell,
                        {
                          backgroundColor: cell
                            ? rateColor(cell.rate, cell.total, cell.isFuture)
                            : 'transparent',
                        },
                      ]}
                    >
                      {cell && (
                        <Text style={styles.calendarCellText}>{cell.day}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}

              {/* 週ごとの達成率バー */}
              {stats && stats.weekly_rates.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>週ごとの達成率</Text>
                  {stats.weekly_rates.map((wr, i) => {
                    const pct = Math.round(wr.rate * 100);
                    return (
                      <View key={wr.week_start} style={styles.weekBarRow}>
                        <Text style={styles.weekBarLabel}>W{i + 1}</Text>
                        <View style={styles.weekBarTrack}>
                          <View
                            style={[
                              styles.weekBarFill,
                              {
                                width: `${pct}%` as `${number}%`,
                                backgroundColor: barColor(wr.rate),
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.weekBarPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </View>

        {/* ── 来月の目標カード (未来月は非表示) ── */}
        {!isFuture && (
          <View style={styles.card}>
            {loadingReview ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.goalTitle}>来月の目標</Text>
                <Text style={styles.goalSub}>
                  {isCurrent ? '来月に向けて目標を設定しましょう' : '記録（読み取り専用）'}
                </Text>

                {isCurrent ? (
                  <>
                    <TextInput
                      style={styles.goalInput}
                      value={goalText}
                      onChangeText={setGoalText}
                      placeholder="来月の目標を入力..."
                      placeholderTextColor="#555555"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    {saveError !== '' && (
                      <Text style={styles.saveError}>{saveError}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                      onPress={handleSaveGoal}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.saveBtnText}>
                        {saving ? '保存中...' : '保存する'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.goalReadOnly}>
                    {review?.next_month_goal || '（未設定）'}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // ヘッダー
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#000000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  currentBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  currentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // スクロール
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  // カード
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  // 達成度サマリー
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  overallBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingVertical: 16,
  },
  overallRate: {
    fontSize: 42,
    fontWeight: '800',
    color: '#22c55e',
    lineHeight: 50,
  },
  overallLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  streakBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingVertical: 16,
  },
  streakNum: {
    fontSize: 42,
    fontWeight: '800',
    color: '#f97316',
    lineHeight: 50,
  },
  streakLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  // セクションラベル
  sectionLabel: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
  },
  // カレンダー
  calendarHeader: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3,
  },
  calendarHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // 週バー
  weekBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  weekBarLabel: {
    width: 26,
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
  },
  weekBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  weekBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  weekBarPct: {
    width: 36,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'right',
  },
  // 来月の目標
  goalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goalSub: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 4,
  },
  goalInput: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 100,
    marginTop: 4,
  },
  saveError: {
    fontSize: 13,
    color: '#ef4444',
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#2a2a2a',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  goalReadOnly: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginTop: 4,
  },
});
