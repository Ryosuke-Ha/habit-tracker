import { useCallback, useEffect, useRef, useState } from 'react';
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

interface KPTItem {
  id: number;
  review_id: number;
  type: 'keep' | 'problem' | 'try';
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface WeeklyReview {
  id: number;
  user_id: string;
  week_start_date: string;
  created_at: string;
  updated_at: string;
  kpt_items: KPTItem[];
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

function getThisWeekStart(): Date {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - today.getDay()); // 日曜日に戻す
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const w = WEEKDAY[date.getDay()];
  return `${y}/${m}/${d}（${w}）`;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// ─── KPTセクション設定 ────────────────────────────────────────────────────────

const SECTIONS = [
  {
    type: 'keep' as const,
    label: 'Keep',
    description: '良かったこと・続けたいこと',
    color: '#22c55e',
    bgColor: '#052e16',
    borderColor: '#166534',
  },
  {
    type: 'problem' as const,
    label: 'Problem',
    description: '課題・改善したいこと',
    color: '#ef4444',
    bgColor: '#2d0a0a',
    borderColor: '#7f1d1d',
  },
  {
    type: 'try' as const,
    label: 'Try',
    description: '次に試すこと',
    color: '#3b82f6',
    bgColor: '#0c1a3a',
    borderColor: '#1e3a8a',
  },
];

// ─── メインコンポーネント ────────────────────────────────────────────────────

export default function WeeklyScreen() {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';

  const thisWeekStart = getThisWeekStart();
  const [weekStart, setWeekStart] = useState<Date>(thisWeekStart);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [prevTryItems, setPrevTryItems] = useState<KPTItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 各セクションの入力値
  const [inputs, setInputs] = useState({ keep: '', problem: '', try: '' });
  const [adding, setAdding] = useState({ keep: false, problem: false, try: false });

  const isCurrentWeek = isSameDay(weekStart, thisWeekStart);
  const weekEnd = addDays(weekStart, 6);

  // ─── データ取得 ─────────────────────────────────────────────────────────────

  const fetchReview = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const isoDate = toIsoDate(date);
      const isCurrent = isSameDay(date, getThisWeekStart());
      const url = isCurrent
        ? `${API_URL}/reviews/weekly/current`
        : `${API_URL}/reviews/weekly/${isoDate}`;
      const res = await fetch(url, { headers: { 'X-User-Email': userEmail } });
      if (res.ok) {
        const data: WeeklyReview = await res.json();
        setReview(data);
      }
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  const fetchPrevTryItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/reviews/weekly/current/try-items`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (res.ok) {
        const data: KPTItem[] = await res.json();
        setPrevTryItems(data);
      } else if (res.status === 404) {
        setPrevTryItems([]);
      }
    } catch {
      setPrevTryItems([]);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchReview(weekStart);
  }, [weekStart, fetchReview]);

  useEffect(() => {
    if (isCurrentWeek) {
      fetchPrevTryItems();
    } else {
      setPrevTryItems([]);
    }
  }, [isCurrentWeek, fetchPrevTryItems]);

  // ─── ナビゲーション ─────────────────────────────────────────────────────────

  function goToPrevWeek() {
    setWeekStart((d) => addDays(d, -7));
  }

  function goToNextWeek() {
    setWeekStart((d) => addDays(d, 7));
  }

  function goToThisWeek() {
    setWeekStart(getThisWeekStart());
  }

  // ─── KPT追加 ───────────────────────────────────────────────────────────────

  async function handleAdd(type: 'keep' | 'problem' | 'try') {
    const content = inputs[type].trim();
    if (!content || adding[type] || !review) return;

    setAdding((prev) => ({ ...prev, [type]: true }));
    setInputs((prev) => ({ ...prev, [type]: '' }));

    const tempId = -Date.now();
    const tempItem: KPTItem = {
      id: tempId,
      review_id: review.id,
      type,
      content,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    setReview((prev) =>
      prev ? { ...prev, kpt_items: [...prev.kpt_items, tempItem] } : prev
    );

    try {
      const res = await fetch(`${API_URL}/reviews/weekly/${review.id}/kpt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
        },
        body: JSON.stringify({ type, content }),
      });
      if (!res.ok) throw new Error();
      const created: KPTItem = await res.json();
      setReview((prev) =>
        prev
          ? {
              ...prev,
              kpt_items: prev.kpt_items.map((it) =>
                it.id === tempId ? created : it
              ),
            }
          : prev
      );
    } catch {
      setReview((prev) =>
        prev
          ? { ...prev, kpt_items: prev.kpt_items.filter((it) => it.id !== tempId) }
          : prev
      );
      setInputs((prev) => ({ ...prev, [type]: content }));
    } finally {
      setAdding((prev) => ({ ...prev, [type]: false }));
    }
  }

  // ─── KPT削除 ───────────────────────────────────────────────────────────────

  async function handleDelete(item: KPTItem) {
    setReview((prev) =>
      prev
        ? { ...prev, kpt_items: prev.kpt_items.filter((it) => it.id !== item.id) }
        : prev
    );
    try {
      const res = await fetch(`${API_URL}/reviews/kpt/${item.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Email': userEmail },
      });
      if (!res.ok) throw new Error();
    } catch {
      setReview((prev) =>
        prev
          ? { ...prev, kpt_items: [...prev.kpt_items, item] }
          : prev
      );
    }
  }

  // ─── 前週Tryを今週Tryに追加 ─────────────────────────────────────────────────

  async function handleAddPrevTryToThisWeek(item: KPTItem) {
    if (!review) return;
    const content = item.content;
    const tempId = -Date.now();
    const tempItem: KPTItem = {
      id: tempId,
      review_id: review.id,
      type: 'try',
      content,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    setReview((prev) =>
      prev ? { ...prev, kpt_items: [...prev.kpt_items, tempItem] } : prev
    );
    try {
      const res = await fetch(`${API_URL}/reviews/weekly/${review.id}/kpt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
        },
        body: JSON.stringify({ type: 'try', content }),
      });
      if (!res.ok) throw new Error();
      const created: KPTItem = await res.json();
      setReview((prev) =>
        prev
          ? {
              ...prev,
              kpt_items: prev.kpt_items.map((it) =>
                it.id === tempId ? created : it
              ),
            }
          : prev
      );
    } catch {
      setReview((prev) =>
        prev
          ? { ...prev, kpt_items: prev.kpt_items.filter((it) => it.id !== tempId) }
          : prev
      );
    }
  }

  // ─── レンダリング ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>週の振り返り</Text>
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            <Text style={styles.navBtnText}>前の週</Text>
          </TouchableOpacity>

          {!isCurrentWeek && (
            <TouchableOpacity onPress={goToThisWeek} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>今週</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={goToNextWeek} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navBtnText}>次の週</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.weekRange}>
          {formatDate(weekStart)} 〜 {formatDate(weekEnd)}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* 前週のTryセクション（今週のみ表示） */}
          {isCurrentWeek && prevTryItems.length > 0 && (
            <View style={styles.prevTrySection}>
              <Text style={styles.prevTryTitle}>前週のTry</Text>
              {prevTryItems.map((item) => (
                <View key={item.id} style={styles.prevTryRow}>
                  <Text style={styles.prevTryContent}>・{item.content}</Text>
                  <TouchableOpacity
                    onPress={() => handleAddPrevTryToThisWeek(item)}
                    style={styles.addToTryBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.addToTryBtnText}>今週のTryに追加</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* KPTセクション */}
          {SECTIONS.map((section) => {
            const items = (review?.kpt_items ?? []).filter((it) => it.type === section.type);
            return (
              <View
                key={section.type}
                style={[styles.sectionCard, { backgroundColor: section.bgColor, borderColor: section.borderColor }]}
              >
                {/* セクションヘッダー */}
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionBadge, { backgroundColor: section.color }]}>
                    <Text style={styles.sectionBadgeText}>{section.label}</Text>
                  </View>
                  <Text style={styles.sectionDescription}>{section.description}</Text>
                </View>

                {/* アイテム一覧 */}
                {items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={styles.itemContent}>・{item.content}</Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={18} color="#555555" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* 追加入力欄 */}
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    placeholder="+ 追加"
                    placeholderTextColor={section.color + '80'}
                    value={inputs[section.type]}
                    onChangeText={(v) =>
                      setInputs((prev) => ({ ...prev, [section.type]: v }))
                    }
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    onPress={() => handleAdd(section.type)}
                    disabled={!inputs[section.type].trim() || adding[section.type]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.addIconBtn}
                  >
                    <Ionicons
                      name="add-circle"
                      size={26}
                      color={
                        inputs[section.type].trim() && !adding[section.type]
                          ? section.color
                          : '#333333'
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  weekNav: {
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
  todayBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  weekRange: {
    fontSize: 13,
    color: '#888888',
  },
  // スクロールコンテンツ
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  // 前週のTryセクション
  prevTrySection: {
    backgroundColor: '#1c1508',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#78350f',
    padding: 16,
    gap: 10,
  },
  prevTryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 2,
  },
  prevTryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prevTryContent: {
    flex: 1,
    fontSize: 15,
    color: '#fcd34d',
  },
  addToTryBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addToTryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // KPTセクションカード
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#888888',
    flex: 1,
  },
  // アイテム行
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  itemContent: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  // 追加入力
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  addInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#00000040',
    borderRadius: 8,
  },
  addIconBtn: {
    flexShrink: 0,
  },
});
