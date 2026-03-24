import { useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 00:00 〜 23:30 を 30 分刻みで生成（48スロット）
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
const ITEM_HEIGHT = 44;
const DEFAULT_TIME = '07:00';

export interface AddTodoFormData {
  title: string;
  scheduledTime: string;
  location: string;
  isPersistent: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AddTodoFormData) => void;
}

export default function AddTodoModal({ visible, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [scheduledTime, setScheduledTime] = useState(DEFAULT_TIME);
  const [location, setLocation] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [isPersistent, setIsPersistent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setTitle('');
    setScheduledTime(DEFAULT_TIME);
    setLocation('');
    setTimePickerOpen(false);
    setIsPersistent(false);
    setSubmitted(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!title.trim() || submitted) return;
    setSubmitted(true);
    onSubmit({ title: title.trim(), scheduledTime, location: location.trim(), isPersistent });
    reset();
  }

  const canSubmit = title.trim().length > 0 && !submitted;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.avoidingView}
          >
            {/* inner TouchableWithoutFeedback prevents overlay tap from closing when tapping sheet */}
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>

                {/* ヘッダー */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>TODOを追加</Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={24} color="#888888" />
                  </TouchableOpacity>
                </View>

                {/* タイトル */}
                <Text style={styles.label}>タイトル</Text>
                <TextInput
                  style={styles.input}
                  placeholder="TODOのタイトル"
                  placeholderTextColor="#555555"
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => setTimePickerOpen(true)}
                />

                {/* 時間 */}
                <Text style={styles.label}>時間</Text>
                <TouchableOpacity
                  style={styles.timeTrigger}
                  onPress={() => setTimePickerOpen((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeTriggerText}>🕐 {scheduledTime}</Text>
                  <Ionicons
                    name={timePickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#888888"
                  />
                </TouchableOpacity>

                {timePickerOpen && (
                  <View style={styles.timeListWrapper}>
                    <FlatList
                      data={TIME_SLOTS}
                      keyExtractor={(t) => t}
                      style={styles.timeList}
                      showsVerticalScrollIndicator={false}
                      getItemLayout={(_, index) => ({
                        length: ITEM_HEIGHT,
                        offset: ITEM_HEIGHT * index,
                        index,
                      })}
                      initialScrollIndex={Math.max(0, TIME_SLOTS.indexOf(scheduledTime))}
                      renderItem={({ item: slot }) => (
                        <TouchableOpacity
                          style={[
                            styles.timeOption,
                            slot === scheduledTime && styles.timeOptionSelected,
                          ]}
                          onPress={() => {
                            setScheduledTime(slot);
                            setTimePickerOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.timeOptionText,
                              slot === scheduledTime && styles.timeOptionTextSelected,
                            ]}
                          >
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}

                {/* 場所 */}
                <Text style={styles.label}>場所</Text>
                <TextInput
                  style={styles.input}
                  placeholder="場所（任意）"
                  placeholderTextColor="#555555"
                  value={location}
                  onChangeText={setLocation}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />

                {/* 持ち越しTODOスイッチ */}
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrapper}>
                    <Text style={styles.switchLabel}>持ち越しTODOとして追加</Text>
                    <Text style={styles.switchSub}>翌日以降も残り続けるTODO</Text>
                  </View>
                  <Switch
                    value={isPersistent}
                    onValueChange={setIsPersistent}
                    trackColor={{ false: '#2a2a2a', true: '#d97706' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 追加ボタン */}
                <TouchableOpacity
                  style={[styles.addButton, !canSubmit && styles.addButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.addButtonText, !canSubmit && styles.addButtonTextDisabled]}>
                    追加
                  </Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  avoidingView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  label: {
    fontSize: 13,
    color: '#888888',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#FFFFFF',
  },
  timeTrigger: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeTriggerText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  timeListWrapper: {
    marginTop: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    overflow: 'hidden',
    height: ITEM_HEIGHT * 4,
  },
  timeList: {
    flex: 1,
  },
  timeOption: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  timeOptionSelected: {
    backgroundColor: '#2a2a2a',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#999999',
  },
  timeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  addButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  addButtonTextDisabled: {
    color: '#555555',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  switchLabelWrapper: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  switchSub: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
});
