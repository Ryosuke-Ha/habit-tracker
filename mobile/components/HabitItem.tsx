import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type TodoKind = 'log' | 'persistent';

export interface HabitItemData {
  numericId: number;
  kind: TodoKind;
  title: string;
  scheduledTime: string;
  location: string;
  isChecked: boolean;
}

interface Props {
  item: HabitItemData;
  onToggle: (numericId: number, kind: TodoKind, current: boolean) => void;
}

export default function HabitItem({ item, onToggle }: Props) {
  const { numericId, kind, title, scheduledTime, location, isChecked } = item;
  const isPersistent = kind === 'persistent';
  const hasMeta = Boolean(scheduledTime || location);

  return (
    <TouchableOpacity
      style={[styles.row, isPersistent && styles.rowPersistent, isChecked && styles.rowDone]}
      onPress={() => onToggle(numericId, kind, isChecked)}
      activeOpacity={0.7}
    >
      {/* チェックボックス */}
      <View style={[styles.checkbox, isChecked && styles.checkboxDone]}>
        {isChecked && <Text style={styles.checkmark}>✓</Text>}
      </View>

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
        {isPersistent && !isChecked && (
          <Text style={styles.persistentLabel}>持ち越し</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowPersistent: {
    backgroundColor: '#1c1508',
    borderWidth: 1,
    borderColor: '#78350f',
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
});
