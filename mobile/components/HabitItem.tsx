import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface HabitItemData {
  logId: number;
  title: string;
  scheduledTime: string;
  location: string;
  isChecked: boolean;
}

interface Props {
  item: HabitItemData;
  onToggle: (logId: number, current: boolean) => void;
}

export default function HabitItem({ item, onToggle }: Props) {
  const { logId, title, scheduledTime, location, isChecked } = item;
  const hasMeta = scheduledTime || location;

  return (
    <View style={[styles.row, isChecked && styles.rowDone]}>
      {/* チェックボックス */}
      <TouchableOpacity
        onPress={() => onToggle(logId, isChecked)}
        style={[styles.checkbox, isChecked && styles.checkboxDone]}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isChecked && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      {/* コンテンツ */}
      <View style={styles.content}>
        {hasMeta && (
          <Text style={[styles.meta, isChecked && styles.metaDone]}>
            {scheduledTime ? `🕐 ${scheduledTime}` : ''}
            {scheduledTime && location ? '  ' : ''}
            {location ? `📍 ${location}` : ''}
          </Text>
        )}
        <Text style={[styles.title, isChecked && styles.titleDone]}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowDone: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D1D5DB',
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
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaDone: {
    color: '#D1D5DB',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  titleDone: {
    color: '#D1D5DB',
    textDecorationLine: 'line-through',
  },
});
