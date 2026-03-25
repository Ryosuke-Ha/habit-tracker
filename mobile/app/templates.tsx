import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import API_URL from '@/constants/api';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── 型定義 ────────────────────────────────────────────────────────────────────

interface Template {
  id: number;
  name: string;
}

interface Habit {
  id: number;
  template_id: number;
  title: string;
  scheduled_time: string;
  location: string;
  order: number;
}

// 0=日, 1=月, ..., 6=土
type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_LABELS: Record<DayIndex, string> = {
  0: '日',
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
};

const PROTECTED_NAMES = new Set(['平日', '休日']);

// ─── コンポーネント ────────────────────────────────────────────────────────────

export default function TemplatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userEmail = user?.email ?? '';

  // ─── テンプレート一覧 ──────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [habits, setHabits] = useState<Record<number, Habit[]>>({});
  const [habitsLoaded, setHabitsLoaded] = useState<Record<number, boolean>>({});

  // ─── 曜日マッピング ────────────────────────────────────────────────────────
  const [dayMap, setDayMap] = useState<Record<DayIndex, number | null>>({
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  });
  const [savingDay, setSavingDay] = useState<DayIndex | null>(null);
  // fetchDayMap がレースコンディションで保存中の値を上書きしないための ref
  const savingDayRef = useRef<DayIndex | null>(null);

  // ─── 曜日ピッカーモーダル ──────────────────────────────────────────────────
  const [dayPickerDay, setDayPickerDay] = useState<DayIndex | null>(null);

  // ─── テンプレート名モーダル ────────────────────────────────────────────────
  const [templateModal, setTemplateModal] = useState<{
    visible: boolean;
    editId: number | null;
    name: string;
    saving: boolean;
  }>({ visible: false, editId: null, name: '', saving: false });

  // ─── 習慣モーダル ──────────────────────────────────────────────────────────
  const [habitModal, setHabitModal] = useState<{
    visible: boolean;
    editId: number | null;
    templateId: number | null;
    title: string;
    scheduledTime: string;
    location: string;
    saving: boolean;
  }>({
    visible: false,
    editId: null,
    templateId: null,
    title: '',
    scheduledTime: '',
    location: '',
    saving: false,
  });

  // ─── 初期データ取得 ────────────────────────────────────────────────────────

  // userEmailが確定したタイミングで1回だけ実行する
  useEffect(() => {
    if (!userEmail) return;
    fetchTemplates();
    fetchDayMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  async function fetchTemplates() {
    try {
      const res = await fetch(`${API_URL}/templates`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (res.ok) {
        const data: Template[] = await res.json();
        setTemplates(data);
      }
    } catch {}
  }

  async function fetchDayMap() {
    try {
      const res = await fetch(`${API_URL}/settings`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (res.ok) {
        const data: Record<string, string> = await res.json();
        const raw = data['habit_day_template_map'];
        if (raw) {
          // バックエンドが数値・文字列どちらで返しても Number() で正規化する
          const parsed: Record<string, unknown> = JSON.parse(raw);
          setDayMap((current) => {
            // 保存処理中（savingDay !== null）はGET結果で上書きしない
            if (savingDayRef.current !== null) return current;
            return {
              0: parsed['0'] != null ? Number(parsed['0']) : null,
              1: parsed['1'] != null ? Number(parsed['1']) : null,
              2: parsed['2'] != null ? Number(parsed['2']) : null,
              3: parsed['3'] != null ? Number(parsed['3']) : null,
              4: parsed['4'] != null ? Number(parsed['4']) : null,
              5: parsed['5'] != null ? Number(parsed['5']) : null,
              6: parsed['6'] != null ? Number(parsed['6']) : null,
            };
          });
        }
      }
    } catch {}
  }

  async function fetchHabits(templateId: number) {
    try {
      const res = await fetch(`${API_URL}/templates/${templateId}/habits`, {
        headers: { 'X-User-Email': userEmail },
      });
      if (res.ok) {
        const data: Habit[] = await res.json();
        setHabits((prev) => ({ ...prev, [templateId]: data }));
      }
    } catch {}
    setHabitsLoaded((prev) => ({ ...prev, [templateId]: true }));
  }

  // ─── テンプレートアコーディオン ────────────────────────────────────────────

  function handleToggleExpand(templateId: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = !expanded[templateId];
    setExpanded((prev) => ({ ...prev, [templateId]: willExpand }));
    if (willExpand && !habitsLoaded[templateId]) {
      fetchHabits(templateId);
    }
  }

  // ─── 曜日マッピング保存 ────────────────────────────────────────────────────

  async function handleSelectTemplate(day: DayIndex, templateId: number | null) {
    const prevMap = { ...dayMap };
    const newMap: Record<DayIndex, number | null> = { ...dayMap, [day]: templateId };
    setDayMap(newMap);
    setDayPickerDay(null);
    setSavingDay(day);
    savingDayRef.current = day;

    // null値を除いた純粋な {dayIndex: templateId} オブジェクトをシリアライズ
    const mapToSave: Record<string, number> = {};
    ([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).forEach((d) => {
      if (newMap[d] !== null) {
        mapToSave[String(d)] = newMap[d] as number;
      }
    });

    try {
      const res = await fetch(`${API_URL}/settings/habit_day_template_map`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
        },
        body: JSON.stringify({ value: JSON.stringify(mapToSave) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setDayMap(prevMap);
    } finally {
      setSavingDay(null);
      savingDayRef.current = null;
    }
  }

  // ─── テンプレートCRUD ──────────────────────────────────────────────────────

  function openAddTemplate() {
    setTemplateModal({ visible: true, editId: null, name: '', saving: false });
  }

  function openEditTemplate(t: Template) {
    setTemplateModal({ visible: true, editId: t.id, name: t.name, saving: false });
  }

  async function handleSaveTemplate() {
    const name = templateModal.name.trim();
    if (!name || templateModal.saving) return;
    setTemplateModal((prev) => ({ ...prev, saving: true }));

    if (templateModal.editId === null) {
      // 追加
      const tempId = -Date.now();
      const tempTemplate: Template = { id: tempId, name };
      setTemplates((prev) => [...prev, tempTemplate]);
      setTemplateModal({ visible: false, editId: null, name: '', saving: false });

      try {
        const res = await fetch(`${API_URL}/templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail,
          },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error();
        const created: Template = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      } catch {
        setTemplates((prev) => prev.filter((t) => t.id !== tempId));
      }
    } else {
      // 編集
      const editId = templateModal.editId;
      const prevTemplates = [...templates];
      setTemplates((prev) => prev.map((t) => (t.id === editId ? { ...t, name } : t)));
      setTemplateModal({ visible: false, editId: null, name: '', saving: false });

      try {
        const res = await fetch(`${API_URL}/templates/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail,
          },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setTemplates(prevTemplates);
      }
    }
  }

  function handleDeleteTemplate(t: Template) {
    Alert.alert(
      'テンプレートを削除',
      `「${t.name}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const prevTemplates = [...templates];
            setTemplates((prev) => prev.filter((x) => x.id !== t.id));

            try {
              const res = await fetch(`${API_URL}/templates/${t.id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': userEmail },
              });
              if (!res.ok) throw new Error();
            } catch {
              setTemplates(prevTemplates);
            }
          },
        },
      ]
    );
  }

  // ─── 習慣CRUD ──────────────────────────────────────────────────────────────

  function openAddHabit(templateId: number) {
    setHabitModal({
      visible: true,
      editId: null,
      templateId,
      title: '',
      scheduledTime: '',
      location: '',
      saving: false,
    });
  }

  function openEditHabit(habit: Habit) {
    setHabitModal({
      visible: true,
      editId: habit.id,
      templateId: habit.template_id,
      title: habit.title,
      scheduledTime: habit.scheduled_time,
      location: habit.location,
      saving: false,
    });
  }

  async function handleSaveHabit() {
    const title = habitModal.title.trim();
    if (!title || habitModal.saving || habitModal.templateId === null) return;
    setHabitModal((prev) => ({ ...prev, saving: true }));

    const templateId = habitModal.templateId;
    const scheduledTime = habitModal.scheduledTime.trim();
    const location = habitModal.location.trim();

    if (habitModal.editId === null) {
      // 追加
      const tempId = -Date.now();
      const currentList = habits[templateId] ?? [];
      const tempHabit: Habit = {
        id: tempId,
        template_id: templateId,
        title,
        scheduled_time: scheduledTime,
        location,
        order: currentList.length,
      };
      setHabits((prev) => ({ ...prev, [templateId]: [...(prev[templateId] ?? []), tempHabit] }));
      setHabitModal({ visible: false, editId: null, templateId: null, title: '', scheduledTime: '', location: '', saving: false });

      try {
        const res = await fetch(`${API_URL}/habits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail,
          },
          body: JSON.stringify({ template_id: templateId, title, scheduled_time: scheduledTime, location }),
        });
        if (!res.ok) throw new Error();
        const created: Habit = await res.json();
        setHabits((prev) => ({
          ...prev,
          [templateId]: (prev[templateId] ?? []).map((h) => (h.id === tempId ? created : h)),
        }));
      } catch {
        setHabits((prev) => ({
          ...prev,
          [templateId]: (prev[templateId] ?? []).filter((h) => h.id !== tempId),
        }));
      }
    } else {
      // 編集
      const editId = habitModal.editId;
      const prevHabits = { ...habits };
      setHabits((prev) => ({
        ...prev,
        [templateId]: (prev[templateId] ?? []).map((h) =>
          h.id === editId ? { ...h, title, scheduled_time: scheduledTime, location } : h
        ),
      }));
      setHabitModal({ visible: false, editId: null, templateId: null, title: '', scheduledTime: '', location: '', saving: false });

      try {
        const res = await fetch(`${API_URL}/habits/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail,
          },
          body: JSON.stringify({ title, scheduled_time: scheduledTime, location }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setHabits(prevHabits);
      }
    }
  }

  async function handleDeleteHabit(habit: Habit) {
    const templateId = habit.template_id;
    const prevHabits = { ...habits };
    setHabits((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] ?? []).filter((h) => h.id !== habit.id),
    }));

    try {
      const res = await fetch(`${API_URL}/habits/${habit.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Email': userEmail },
      });
      if (!res.ok) throw new Error();
    } catch {
      setHabits(prevHabits);
    }
  }

  // ─── テンプレート名ヘルパー ────────────────────────────────────────────────

  function templateName(templateId: number | null): string {
    if (templateId === null) return '未設定';
    const t = templates.find((x) => x.id === templateId);
    return t ? t.name : '未設定';
  }

  // ─── レンダリング ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>テンプレートを管理</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ─── 曜日テンプレートマッピング ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>曜日のテンプレート設定</Text>
          <View style={styles.dayGrid}>
            {([0, 1, 2, 3, 4, 5, 6] as DayIndex[]).map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayCell, savingDay === day && styles.dayCellSaving]}
                onPress={() => setDayPickerDay(day)}
              >
                <Text style={[styles.dayLabel, (day === 0 || day === 6) && styles.dayLabelWeekend]}>
                  {DAY_LABELS[day]}
                </Text>
                <Text style={styles.dayTemplate} numberOfLines={1}>
                  {savingDay === day ? '…' : templateName(dayMap[day])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── テンプレート一覧 ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>テンプレート一覧</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddTemplate}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>追加</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.templateList}>
            {templates.map((t) => {
              const isProtected = PROTECTED_NAMES.has(t.name);
              const isOpen = !!expanded[t.id];
              const habitList = habits[t.id] ?? [];
              const loaded = !!habitsLoaded[t.id];

              return (
                <View key={t.id} style={styles.templateCard}>
                  {/* テンプレートヘッダー行 */}
                  <TouchableOpacity
                    style={styles.templateRow}
                    onPress={() => handleToggleExpand(t.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#6B7280"
                    />
                    <Text style={styles.templateName}>{t.name}</Text>
                    {isProtected && (
                      <View style={styles.protectedBadge}>
                        <Text style={styles.protectedBadgeText}>固定</Text>
                      </View>
                    )}
                    <View style={styles.templateActions}>
                      {!isProtected && (
                        <>
                          <TouchableOpacity
                            onPress={() => openEditTemplate(t)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="pencil-outline" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteTemplate(t)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* 展開エリア: 習慣リスト */}
                  {isOpen && (
                    <View style={styles.habitArea}>
                      {!loaded ? (
                        <Text style={styles.loadingText}>読み込み中…</Text>
                      ) : habitList.length === 0 ? (
                        <Text style={styles.emptyText}>習慣がありません</Text>
                      ) : (
                        habitList.map((h) => (
                          <View key={h.id} style={styles.habitRow}>
                            <View style={styles.habitInfo}>
                              <Text style={styles.habitTitle}>{h.title}</Text>
                              {(h.scheduled_time || h.location) && (
                                <Text style={styles.habitMeta}>
                                  {h.scheduled_time ? `🕐 ${h.scheduled_time}` : ''}
                                  {h.scheduled_time && h.location ? '  ' : ''}
                                  {h.location ? `📍 ${h.location}` : ''}
                                </Text>
                              )}
                            </View>
                            <View style={styles.habitActions}>
                              <TouchableOpacity
                                onPress={() => openEditHabit(h)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDeleteHabit(h)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}

                      {/* 習慣追加ボタン */}
                      <TouchableOpacity
                        style={styles.addHabitButton}
                        onPress={() => openAddHabit(t.id)}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#60A5FA" />
                        <Text style={styles.addHabitText}>習慣を追加</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ─── 曜日ピッカーモーダル ──────────────────────────────────────── */}
      <Modal
        visible={dayPickerDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerDay(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDayPickerDay(null)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>
              {dayPickerDay !== null ? `${DAY_LABELS[dayPickerDay]}曜日のテンプレート` : ''}
            </Text>
            <TouchableOpacity
              style={[styles.pickerItem, dayPickerDay !== null && dayMap[dayPickerDay] === null && styles.pickerItemSelected]}
              onPress={() => dayPickerDay !== null && handleSelectTemplate(dayPickerDay, null)}
            >
              <Text style={styles.pickerItemText}>未設定</Text>
            </TouchableOpacity>
            {templates.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.pickerItem,
                  dayPickerDay !== null && dayMap[dayPickerDay] === t.id && styles.pickerItemSelected,
                ]}
                onPress={() => dayPickerDay !== null && handleSelectTemplate(dayPickerDay, t.id)}
              >
                <Text style={styles.pickerItemText}>{t.name}</Text>
                {dayPickerDay !== null && dayMap[dayPickerDay] === t.id && (
                  <Ionicons name="checkmark" size={16} color="#22C55E" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── テンプレート名モーダル ────────────────────────────────────── */}
      <Modal
        visible={templateModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTemplateModal((prev) => ({ ...prev, visible: false }))}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTemplateModal((prev) => ({ ...prev, visible: false }))}
        >
          <View style={styles.formModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.formModalTitle}>
              {templateModal.editId === null ? 'テンプレートを追加' : 'テンプレート名を編集'}
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder="テンプレート名"
              placeholderTextColor="#555555"
              value={templateModal.name}
              onChangeText={(v) => setTemplateModal((prev) => ({ ...prev, name: v }))}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveTemplate}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.formCancelButton}
                onPress={() => setTemplateModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.formCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formSaveButton, (!templateModal.name.trim() || templateModal.saving) && styles.formSaveDisabled]}
                onPress={handleSaveTemplate}
                disabled={!templateModal.name.trim() || templateModal.saving}
              >
                <Text style={styles.formSaveText}>
                  {templateModal.saving ? '保存中…' : '保存'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── 習慣フォームモーダル ──────────────────────────────────────── */}
      <Modal
        visible={habitModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setHabitModal((prev) => ({ ...prev, visible: false }))}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHabitModal((prev) => ({ ...prev, visible: false }))}
        >
          <View style={styles.formModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.formModalTitle}>
              {habitModal.editId === null ? '習慣を追加' : '習慣を編集'}
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder="習慣名 *"
              placeholderTextColor="#555555"
              value={habitModal.title}
              onChangeText={(v) => setHabitModal((prev) => ({ ...prev, title: v }))}
              autoFocus
              returnKeyType="next"
            />
            <TextInput
              style={styles.formInput}
              placeholder="時刻 (例: 07:00)"
              placeholderTextColor="#555555"
              value={habitModal.scheduledTime}
              onChangeText={(v) => setHabitModal((prev) => ({ ...prev, scheduledTime: v }))}
              returnKeyType="next"
            />
            <TextInput
              style={styles.formInput}
              placeholder="場所"
              placeholderTextColor="#555555"
              value={habitModal.location}
              onChangeText={(v) => setHabitModal((prev) => ({ ...prev, location: v }))}
              returnKeyType="done"
              onSubmitEditing={handleSaveHabit}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.formCancelButton}
                onPress={() => setHabitModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.formCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formSaveButton, (!habitModal.title.trim() || habitModal.saving) && styles.formSaveDisabled]}
                onPress={handleSaveHabit}
                disabled={!habitModal.title.trim() || habitModal.saving}
              >
                <Text style={styles.formSaveText}>
                  {habitModal.saving ? '保存中…' : '保存'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── スタイル ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F2937',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ─── セクション ─────────────────────────────────────────────────────
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ─── 曜日グリッド ────────────────────────────────────────────────────
  dayGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  dayCellSaving: {
    opacity: 0.5,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayLabelWeekend: {
    color: '#60A5FA',
  },
  dayTemplate: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // ─── 追加ボタン ──────────────────────────────────────────────────────
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ─── テンプレートカード ──────────────────────────────────────────────
  templateList: {
    gap: 8,
  },
  templateCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  templateName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  protectedBadge: {
    backgroundColor: '#292524',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  protectedBadgeText: {
    fontSize: 10,
    color: '#d97706',
    fontWeight: '600',
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // ─── 習慣エリア ──────────────────────────────────────────────────────
  habitArea: {
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#555555',
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#555555',
    paddingVertical: 8,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
    gap: 10,
  },
  habitInfo: {
    flex: 1,
    gap: 2,
  },
  habitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  habitMeta: {
    fontSize: 12,
    color: '#888888',
  },
  habitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
  },
  addHabitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
  },
  addHabitText: {
    fontSize: 14,
    color: '#60A5FA',
  },

  // ─── モーダル ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '100%',
    paddingVertical: 8,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  pickerItemSelected: {
    backgroundColor: '#1e2a1e',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  formModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '100%',
    padding: 20,
    gap: 12,
  },
  formModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  formCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formCancelText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  formSaveButton: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formSaveDisabled: {
    backgroundColor: '#1e2a4a',
  },
  formSaveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
