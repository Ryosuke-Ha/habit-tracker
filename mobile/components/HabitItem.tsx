import { useEffect, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API_URL from '@/constants/api';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type TodoKind = 'log' | 'persistent';

export interface HabitItemData {
  numericId: number;
  kind: TodoKind;
  title: string;
  scheduledTime: string;
  location: string;
  isChecked: boolean;
}

interface SubTask {
  id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

interface Props {
  item: HabitItemData;
  onToggle: (numericId: number, kind: TodoKind, current: boolean) => void;
  userEmail: string;
}

// ─── コンポーネント ──────────────────────────────────────────────────────────

export default function HabitItem({ item, onToggle, userEmail }: Props) {
  const { numericId, kind, title, scheduledTime, location, isChecked } = item;
  const isPersistent = kind === 'persistent';
  const hasMeta = Boolean(scheduledTime || location);
  const todoType = kind === 'log' ? 'habit_log' : 'persistent_todo';

  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  // マウント時にサブタスクを取得してバッジを表示する
  useEffect(() => {
    fetchSubtasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericId, kind]);

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const totalCount = subtasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;

  // ─── API ────────────────────────────────────────────────────────────────────

  async function fetchSubtasks() {
    try {
      const res = await fetch(
        `${API_URL}/subtasks?todo_type=${todoType}&todo_id=${numericId}`,
        { headers: { 'X-User-Email': userEmail } }
      );
      if (res.ok) {
        const data: SubTask[] = await res.json();
        setSubtasks(data);
      }
    } catch {}
  }

  async function handleToggleSubtask(sub: SubTask) {
    // オプティミスティックUI
    setSubtasks((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, is_completed: !s.is_completed } : s))
    );
    try {
      const res = await fetch(`${API_URL}/subtasks/${sub.id}/toggle`, {
        method: 'POST',
        headers: { 'X-User-Email': userEmail },
      });
      if (!res.ok) throw new Error();
    } catch {
      // ロールバック
      setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? sub : s)));
    }
  }

  async function handleDeleteSubtask(sub: SubTask) {
    // オプティミスティックUI
    setSubtasks((prev) => prev.filter((s) => s.id !== sub.id));
    try {
      const res = await fetch(`${API_URL}/subtasks/${sub.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Email': userEmail },
      });
      if (!res.ok) throw new Error();
    } catch {
      // ロールバック: 再取得で正確な状態に戻す
      fetchSubtasks();
    }
  }

  async function handleAddSubtask() {
    if (!newTitle.trim() || adding) return;
    const taskTitle = newTitle.trim();
    setAdding(true);
    setNewTitle('');

    const tempId = -Date.now();
    const tempSub: SubTask = { id: tempId, title: taskTitle, is_completed: false, order: totalCount };
    setSubtasks((prev) => [...prev, tempSub]);

    try {
      const res = await fetch(`${API_URL}/subtasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
        },
        body: JSON.stringify({ todo_type: todoType, todo_id: numericId, title: taskTitle }),
      });
      if (!res.ok) throw new Error();
      const created: SubTask = await res.json();
      setSubtasks((prev) => prev.map((s) => (s.id === tempId ? created : s)));
    } catch {
      // ロールバック
      setSubtasks((prev) => prev.filter((s) => s.id !== tempId));
    } finally {
      setAdding(false);
    }
  }

  // ─── アコーディオン開閉 ──────────────────────────────────────────────────────

  function handleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  // ─── レンダリング ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, isPersistent && styles.containerPersistent]}>

      {/* メイン行: タップでアコーディオン開閉 */}
      <TouchableOpacity
        style={[styles.row, isChecked && styles.rowDone]}
        onPress={handleExpand}
        activeOpacity={0.7}
      >
        {/* チェックボックス: タップしてもアコーディオンは開かない */}
        <TouchableOpacity
          onPress={() => onToggle(numericId, kind, isChecked)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.checkbox, isChecked && styles.checkboxDone]}
        >
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        {/* タイトル・メタ情報 */}
        <View style={styles.content}>
          {hasMeta && (
            <Text style={[styles.meta, isChecked && styles.metaDone]}>
              {scheduledTime ? `🕐 ${scheduledTime}` : ''}
              {scheduledTime && location ? '  ' : ''}
              {location ? `📍 ${location}` : ''}
            </Text>
          )}
          <Text style={[styles.title, isChecked && styles.titleDone]}>{title}</Text>
          {isPersistent && !isChecked && (
            <Text style={styles.persistentLabel}>持ち越し</Text>
          )}
        </View>

        {/* バッジ + 展開アイコン */}
        <View style={styles.rightArea}>
          {totalCount > 0 && (
            <View style={[styles.badge, allDone && styles.badgeDone]}>
              <Text style={[styles.badgeText, allDone && styles.badgeTextDone]}>
                {completedCount}/{totalCount}
              </Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color="#555555"
          />
        </View>
      </TouchableOpacity>

      {/* 進捗バー: サブタスクが1件以上ある場合のみ表示 */}
      {totalCount > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(progressPct * 100)}%` },
            ]}
          />
        </View>
      )}

      {/* アコーディオン: サブタスク一覧 */}
      {expanded && (
        <View style={styles.subtaskArea}>
          {subtasks.map((sub) => (
            <View key={sub.id} style={styles.subtaskRow}>
              {/* サブタスクチェックボックス */}
              <TouchableOpacity
                onPress={() => handleToggleSubtask(sub)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.subtaskCheckbox, sub.is_completed && styles.subtaskCheckboxDone]}
              >
                {sub.is_completed && <Text style={styles.subtaskCheckmark}>✓</Text>}
              </TouchableOpacity>

              {/* サブタスクタイトル */}
              <Text
                style={[styles.subtaskTitle, sub.is_completed && styles.subtaskTitleDone]}
                numberOfLines={2}
              >
                {sub.title}
              </Text>

              {/* 削除ボタン */}
              <TouchableOpacity
                onPress={() => handleDeleteSubtask(sub)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#555555" />
              </TouchableOpacity>
            </View>
          ))}

          {/* サブタスク追加入力欄 */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="サブタスクを追加..."
              placeholderTextColor="#555555"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleAddSubtask}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={handleAddSubtask}
              disabled={!newTitle.trim() || adding}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="add-circle"
                size={24}
                color={newTitle.trim() && !adding ? '#22C55E' : '#333333'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── スタイル ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  containerPersistent: {
    backgroundColor: '#1c1508',
    borderWidth: 1,
    borderColor: '#78350f',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowDone: {
    opacity: 0.45,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  meta: {
    fontSize: 13,
    color: '#888888',
  },
  metaDone: {
    color: '#444444',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  titleDone: {
    color: '#555555',
    textDecorationLine: 'line-through',
  },
  persistentLabel: {
    fontSize: 12,
    color: '#d97706',
    marginTop: 2,
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  badge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDone: {
    backgroundColor: '#14532d',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
  },
  badgeTextDone: {
    color: '#22C55E',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  // ─── サブタスクエリア ─────────────────────────────────────────────────────
  subtaskArea: {
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 2,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  subtaskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subtaskCheckboxDone: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  subtaskCheckmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 14,
    color: '#CCCCCC',
  },
  subtaskTitleDone: {
    color: '#555555',
    textDecorationLine: 'line-through',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
});
