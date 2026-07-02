import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Subtle } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useStore } from '@/state/store';
import { AlertLevel } from '@/models';

const LEVEL_LABEL: Record<AlertLevel, string> = {
  confirming: 'Hỏi xác nhận',
  alarm_local: 'Báo động tại máy',
  calling_contacts: 'Gọi người thân',
  escalated: 'Leo thang tối đa',
};

export default function HistoryScreen() {
  const { data } = useStore();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.h1}>Nhật ký</Text>

        <Text style={styles.section}>Chuyến đi</Text>
        {data.trips.length === 0 && <Subtle>Chưa có chuyến nào.</Subtle>}
        {data.trips.slice(0, 20).map((t) => (
          <Card key={t.id}>
            <Text style={styles.item}>
              {new Date(t.startedAt).toLocaleString('vi-VN')}
            </Text>
            <Subtle>
              {t.endedAt
                ? `Kết thúc: ${new Date(t.endedAt).toLocaleTimeString('vi-VN')} (${t.endReason ?? '—'})`
                : 'Đang diễn ra'}
            </Subtle>
          </Card>
        ))}

        <Text style={styles.section}>Sự kiện cảnh báo</Text>
        {data.alerts.length === 0 && <Subtle>Chưa có cảnh báo nào.</Subtle>}
        {data.alerts.slice(0, 30).map((a) => (
          <Card key={a.id}>
            <Text style={styles.item}>{LEVEL_LABEL[a.level]}</Text>
            <Subtle>
              {new Date(a.firedAt).toLocaleString('vi-VN')}
              {a.location ? ` · @${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}` : ''}
            </Subtle>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  section: {
    color: colors.textDim,
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  item: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
