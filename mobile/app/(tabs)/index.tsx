import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import HabitItem, { type HabitItemData, type TodoKind } from '@/components/HabitItem';
import DrawerMenu from '@/components/DrawerMenu';
import AddTodoModal, { type AddTodoFormData } from '@/components/AddTodoModal';
import { useAuth } from '@/hooks/useAuth';
import API_URL from '@/constants/api';

// ─── 型定義 ────────────────────────────────────────────────────────────────────

interface KPTItem {
  id: number;
  review_id: number;
  type: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

interface Template {
  id: number;
  name: string;
}

interface LogApiResponse {
  id: number;
  habit_id: number | null;
  title: string;
  scheduled_time: string;
  location: string;
  is_checked: boolean;
  order: number;
}

interface PersistentTodoApiResponse {
  id: number;
  title: string;
  scheduled_time: string;
  location: string;
  is_completed: boolean;
}

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

function getTodayLabel(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `${dateStr} ${WEEKDAY_LABELS[today.getDay()]}`;
}

/** scheduledTime 昇順ソート（空文字は末尾） */
function sortByTime(items: HabitItemData[]): HabitItemData[] {
  return [...items].sort((a, b) => {
    if (!a.scheduledTime && !b.scheduledTime) return 0;
    if (!a.scheduledTime) return 1;
    if (!b.scheduledTime) return -1;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });
}

// ─── メインコンポーネント ────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user, signOut } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [todos, setTodos] = useState<HabitItemData[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [prevTryItems, setPrevTryItems] = useState<KPTItem[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState<string | null>(null);
  const [monthlyGoalFetched, setMonthlyGoalFetched] = useState(false);

  // ─── データ取得 ───────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const userEmail = user?.email ?? '';
      const dow = new Date().getDay();

      // 1. habit_day_template_map を取得して今日のテンプレートIDを決定
      let mappedTemplateId: number | null = null;
      try {
        const settingsRes = await fetch(`${API_URL}/settings`, {
          headers: { 'X-User-Email': userEmail },
        });
        if (settingsRes.ok) {
          const settingsData: Record<string, string> = await settingsRes.json();
          const raw = settingsData['habit_day_template_map'];
          if (raw) {
            const parsed: Record<string, unknown> = JSON.parse(raw);
            const val = parsed[String(dow)];
            if (val != null) {
              mappedTemplateId = Number(val);
            }
          }
        }
      } catch {}

      // 2. テンプレート一覧取得
      const templatesRes = await fetch(`${API_URL}/templates`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (!templatesRes.ok) throw new Error('テンプレートの取得に失敗しました');
      const templates: Template[] = await templatesRes.json();

      // 3. テンプレート決定: 設定 → デフォルト名 → 先頭
      let matched: Template | undefined;
      if (mappedTemplateId !== null) {
        matched = templates.find((t) => t.id === mappedTemplateId);
      }
      if (!matched) {
        const fallback = dow === 0 || dow === 6 ? '休日' : '平日';
        matched = templates.find((t) => t.name === fallback) ?? templates[0];
      }
      if (!matched) {
        setTodos([]);
        return;
      }
      setTemplateName(matched.name);
      setTemplateId(matched.id);

      // 4. 今日のログ取得
      const logsRes = await fetch(`${API_URL}/logs/today?template_id=${matched.id}`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (!logsRes.ok) throw new Error('TODOの取得に失敗しました');
      const logs: LogApiResponse[] = await logsRes.json();

      const logItems: HabitItemData[] = logs.map((l) => ({
        numericId: l.id,
        kind: 'log',
        title: l.title,
        scheduledTime: l.scheduled_time,
        location: l.location,
        isChecked: l.is_checked,
      }));

      // 3. 持ち越しTODO取得（失敗してもログのみで続行）
      const persistentUrl = `${API_URL}/persistent-todos`;
      console.log('[persistent-todos] fetching from:', persistentUrl, 'user:', userEmail);
      let persistentItems: HabitItemData[] = [];
      try {
        const persRes = await fetch(persistentUrl, {
          headers: { 'X-User-Email': userEmail },
        });
        console.log('[persistent-todos] status:', persRes.status);
        if (persRes.ok) {
          const persData: PersistentTodoApiResponse[] = await persRes.json();
          console.log('[persistent-todos] raw response:', JSON.stringify(persData));
          persistentItems = persData
            .filter((p) => !p.is_completed)
            .map((p) => ({
              numericId: p.id,
              kind: 'persistent' as TodoKind,
              title: p.title,
              scheduledTime: p.scheduled_time ?? '',
              location: p.location ?? '',
              isChecked: false,
            }));
        } else {
          console.log('[persistent-todos] error body:', await persRes.text());
        }
      } catch (e) {
        console.log('[persistent-todos] fetch error:', e);
      }

      const allTodos = sortByTime([...logItems, ...persistentItems]);
      console.log('[todos] total:', allTodos.length, 'log:', logItems.length, 'persistent:', persistentItems.length);
      setTodos(allTodos);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // 画面フォーカス時に毎回再取得（テンプレート管理画面から戻った時も反映）
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // 今月の目標取得（前月のnext_month_goal）
  useEffect(() => {
    if (!user?.email) return;
    fetch(`${API_URL}/reviews/monthly/current/goal`, {
      headers: { 'X-User-Email': user.email },
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        setMonthlyGoal(data?.goal ?? null);
        setMonthlyGoalFetched(true);
      })
      .catch(() => {
        setMonthlyGoal(null);
        setMonthlyGoalFetched(true);
      });
  }, [user?.email]);

  // 前週のTryアイテム取得
  useEffect(() => {
    if (!user?.email) return;
    fetch(`${API_URL}/reviews/weekly/current/try-items`, {
      headers: { 'X-User-Email': user.email },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: KPTItem[]) => setPrevTryItems(data))
      .catch(() => setPrevTryItems([]));
  }, [user?.email]);

  // 前週のTry完了トグル
  async function handleToggleTryItem(item: KPTItem) {
    setPrevTryItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, is_completed: !it.is_completed } : it))
    );
    try {
      const res = await fetch(`${API_URL}/reviews/kpt/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': user?.email ?? '',
        },
        body: JSON.stringify({ is_completed: !item.is_completed }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPrevTryItems((prev) =>
        prev.map((it) => (it.id === item.id ? item : it))
      );
    }
  }

  // ─── チェック切り替え（オプティミスティックUI）──────────────────────────────────

  async function handleToggle(numericId: number, kind: TodoKind, current: boolean) {
    setTodos((prev) =>
      prev.map((t) =>
        t.numericId === numericId && t.kind === kind ? { ...t, isChecked: !current } : t
      )
    );
    try {
      const url =
        kind === 'log'
          ? `${API_URL}/logs/${numericId}/toggle`
          : `${API_URL}/persistent-todos/${numericId}/complete`;
      const headers: Record<string, string> =
        kind === 'persistent' ? { 'X-User-Email': user?.email ?? '' } : {};
      const res = await fetch(url, { method: 'POST', headers });
      if (!res.ok) throw new Error();
    } catch {
      // ロールバック
      setTodos((prev) =>
        prev.map((t) =>
          t.numericId === numericId && t.kind === kind ? { ...t, isChecked: current } : t
        )
      );
    }
  }

  // ─── TODO追加（オプティミスティックUI）─────────────────────────────────────────

  async function handleAdd(data: AddTodoFormData) {
    if (!templateId && !data.isPersistent) return;

    const tempId = -Date.now();
    const tempItem: HabitItemData = {
      numericId: tempId,
      kind: data.isPersistent ? 'persistent' : 'log',
      title: data.title,
      scheduledTime: data.scheduledTime,
      location: data.location,
      isChecked: false,
    };
    setTodos((prev) => sortByTime([...prev, tempItem]));

    try {
      if (data.isPersistent) {
        // 持ち越しTODO → POST /persistent-todos
        const url = `${API_URL}/persistent-todos`;
        const body = { title: data.title, scheduled_time: data.scheduledTime, location: data.location };
        console.log('[handleAdd] posting persistent-todo to:', url, body);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': user?.email ?? '',
          },
          body: JSON.stringify(body),
        });
        console.log('[handleAdd] persistent-todo response status:', res.status);
        if (!res.ok) {
          const errText = await res.text();
          console.log('[handleAdd] persistent-todo error:', errText);
          throw new Error();
        }
        const created: PersistentTodoApiResponse = await res.json();
        console.log('[handleAdd] persistent-todo created id:', created.id);
        setTodos((prev) =>
          sortByTime(
            prev.map((t) =>
              t.numericId === tempId ? { ...t, numericId: created.id } : t
            )
          )
        );
      } else {
        // 通常TODO → POST /logs/standalone（テンプレートには追加しない当日限りのログ）
        const url = `${API_URL}/logs/standalone`;
        const body = { title: data.title, scheduled_time: data.scheduledTime, location: data.location, template_id: templateId };
        console.log('[handleAdd] posting standalone log to:', url, body);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        console.log('[handleAdd] standalone log response status:', res.status);
        if (!res.ok) {
          const errText = await res.text();
          console.log('[handleAdd] standalone log error:', errText);
          throw new Error();
        }
        const created: LogApiResponse = await res.json();
        console.log('[handleAdd] standalone log created id:', created.id);
        setTodos((prev) =>
          sortByTime(
            prev.map((t) =>
              t.numericId === tempId ? { ...t, numericId: created.id } : t
            )
          )
        );
      }
    } catch {
      // ロールバック
      setTodos((prev) => prev.filter((t) => t.numericId !== tempId));
    }
  }

  // ─── ローディング画面 ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── 進捗計算 ─────────────────────────────────────────────────────────────────

  const checkedCount = todos.filter((t) => t.isChecked).length;
  const progressPct = todos.length > 0 ? Math.round((checkedCount / todos.length) * 100) : 0;

  // ─── レンダリング ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ハンバーガーメニュー */}
      <DrawerMenu
        visible={drawerOpen}
        user={user}
        onClose={() => setDrawerOpen(false)}
        onSignOut={signOut}
      />

      {/* TODO追加モーダル */}
      <AddTodoModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSubmit={handleAdd}
      />

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{getTodayLabel()}</Text>
        <View style={styles.headerRight}>
          {templateName !== '' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{templateName}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* プログレスバー */}
      {todos.length > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {checkedCount} / {todos.length} 完了
          </Text>
        </View>
      )}

      {/* エラー */}
      {error !== null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* TODO一覧 */}
      <FlatList
        data={todos}
        keyExtractor={(item) => `${item.kind}-${item.numericId}`}
        renderItem={({ item }) => (
            <HabitItem item={item} onToggle={handleToggle} userEmail={user?.email ?? ''} />
          )}
        ListHeaderComponent={
          <View>
            {/* 今月の目標カード */}
            {monthlyGoalFetched && (
              <View style={styles.monthlyGoalCard}>
                <Text style={styles.monthlyGoalLabel}>今月の目標</Text>
                <Text style={styles.monthlyGoalText}>
                  {monthlyGoal || '今月の目標が未設定です'}
                </Text>
              </View>
            )}
            {/* 前週のTryセクション */}
            {prevTryItems.length > 0 && (
              <View style={styles.prevTrySection}>
                <Text style={styles.prevTrySectionTitle}>前週のTry</Text>
                {prevTryItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.prevTryRow}
                    onPress={() => handleToggleTryItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.prevTryCheckbox, item.is_completed && styles.prevTryCheckboxDone]}>
                      {item.is_completed && <Text style={styles.prevTryCheckmark}>✓</Text>}
                    </View>
                    <Text style={[styles.prevTryContent, item.is_completed && styles.prevTryContentDone]}>
                      {item.content}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor="#FFFFFF"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>今日のTODOはありません</Text>
        }
      />

      {/* フローティング追加ボタン */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#000000" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

// ─── スタイル ──────────────────────────────────────────────────────────────────

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  // プログレスバー
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
  },
  // エラー
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#2a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
  },
  // リスト
  list: {
    padding: 16,
    paddingBottom: 96,
  },
  separator: {
    height: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#555555',
    marginTop: 60,
    fontSize: 16,
  },
  // 今月の目標カード
  monthlyGoalCard: {
    backgroundColor: '#0c1a3a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  monthlyGoalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.5,
  },
  monthlyGoalText: {
    fontSize: 15,
    color: '#bfdbfe',
    lineHeight: 22,
  },
  // 前週のTryセクション
  prevTrySection: {
    backgroundColor: '#1c1508',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#78350f',
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  prevTrySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 2,
  },
  prevTryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 3,
  },
  prevTryCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  prevTryCheckboxDone: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  prevTryCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  prevTryContent: {
    flex: 1,
    fontSize: 15,
    color: '#fcd34d',
  },
  prevTryContentDone: {
    color: '#78350f',
    textDecorationLine: 'line-through',
  },
  // フローティングボタン
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
