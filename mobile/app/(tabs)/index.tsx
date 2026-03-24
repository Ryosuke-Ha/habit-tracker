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
import HabitItem, { type HabitItemData } from '@/components/HabitItem';
import DrawerMenu from '@/components/DrawerMenu';
import { useAuth } from '@/hooks/useAuth';
import API_URL from '@/constants/api';

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

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todos, setTodos] = useState<HabitItemData[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const templatesRes = await fetch(`${API_URL}/templates`);
      if (!templatesRes.ok) throw new Error('テンプレートの取得に失敗しました');
      const templates: Template[] = await templatesRes.json();

      const dayOfWeek = new Date().getDay();
      const fallbackName = dayOfWeek === 0 || dayOfWeek === 6 ? '休日' : '平日';
      const matched = templates.find((t) => t.name === fallbackName) ?? templates[0];
      if (!matched) {
        setTodos([]);
        return;
      }
      setTemplateName(matched.name);

      const logsRes = await fetch(`${API_URL}/logs/today?template_id=${matched.id}`);
      if (!logsRes.ok) throw new Error('TODOの取得に失敗しました');
      const logs: LogApiResponse[] = await logsRes.json();

      setTodos(
        logs.map((l) => ({
          logId: l.id,
          title: l.title,
          scheduledTime: l.scheduled_time,
          location: l.location,
          isChecked: l.is_checked,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggle(logId: number, current: boolean) {
    // オプティミスティックUI
    setTodos((prev) =>
      prev.map((t) => (t.logId === logId ? { ...t, isChecked: !current } : t))
    );
    try {
      const res = await fetch(`${API_URL}/logs/${logId}/toggle`, { method: 'POST' });
      if (!res.ok) throw new Error();
    } catch {
      // ロールバック
      setTodos((prev) =>
        prev.map((t) => (t.logId === logId ? { ...t, isChecked: current } : t))
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  const checkedCount = todos.filter((t) => t.isChecked).length;
  const progressPct = todos.length > 0 ? Math.round((checkedCount / todos.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ハンバーガーメニュー */}
      <DrawerMenu
        visible={drawerOpen}
        user={user}
        onClose={() => setDrawerOpen(false)}
        onSignOut={signOut}
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
            <Ionicons name="menu" size={24} color="#374151" />
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
        keyExtractor={(item) => String(item.logId)}
        renderItem={({ item }) => <HabitItem item={item} onToggle={handleToggle} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>今日のTODOはありません</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
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
    color: '#9CA3AF',
    textAlign: 'right',
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  list: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 60,
    fontSize: 16,
  },
});
