import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function MonthlyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>月次振り返り</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>準備中</Text>
        <Text style={styles.sub}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholder: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
  },
  sub: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
