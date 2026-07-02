import React, { useEffect, useState } from 'react';
import { Modal, Text, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { useStore } from '@/state/store';
import { EngineState } from '@/services/alertEngine';

const LEVEL_TEXT: Record<Exclude<EngineState, 'idle'>, { title: string; sub: string }> = {
  confirming: {
    title: 'Bạn đã đưa bé ra khỏi xe chưa?',
    sub: 'Nhấn xác nhận để tắt. Nếu không, app sẽ báo động.',
  },
  alarm_local: {
    title: '🚨 BÁO ĐỘNG!',
    sub: 'Chưa xác nhận. Sắp gọi người thân. Kiểm tra xe NGAY!',
  },
  calling_contacts: {
    title: '📞 ĐANG GỌI NGƯỜI THÂN',
    sub: 'App đang liên hệ các số khẩn cấp kèm vị trí xe.',
  },
  escalated: {
    title: '⛑️ KHẨN CẤP',
    sub: 'Đã báo hết người thân. Cân nhắc gọi cứu hộ 114/115 ngay.',
  },
};

export default function AlertOverlay() {
  const {
    engineState,
    acknowledge,
    data,
    confirmSeconds,
    isRoutineContext,
    suspectRearSeat,
    presenceReasons,
    driverAway,
  } = useStore();
  const visible = engineState !== 'idle';
  const [remaining, setRemaining] = useState<number | null>(null);

  // Số giây chờ tương ứng mỗi trạng thái (bước xác nhận dùng thời gian đã áp học thói quen).
  const secondsFor = (state: EngineState): number | null => {
    if (state === 'confirming') return confirmSeconds;
    if (state === 'alarm_local') return data.settings.t2Seconds;
    return null;
  };

  // Reset đếm ngược mỗi khi đổi trạng thái.
  useEffect(() => {
    setRemaining(secondsFor(engineState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState, confirmSeconds, data.settings.t2Seconds]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r === null ? null : Math.max(0, r - 1))), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  if (!visible) return null;
  const info = LEVEL_TEXT[engineState as Exclude<EngineState, 'idle'>];
  const danger = engineState !== 'confirming';

  return (
    <Modal visible transparent animationType="fade">
      <View style={[styles.backdrop, { backgroundColor: danger ? colors.dangerDark : colors.primaryDark }]}>
        <Text style={styles.emoji}>🚗👶</Text>
        <Text style={styles.title}>{info.title}</Text>
        <Text style={styles.sub}>{info.sub}</Text>

        {suspectRearSeat && (
          <Text style={styles.hint}>
            ⚠️ NGHI CÒN BÉ TRÊN XE — KIỂM TRA GHẾ SAU!
            {presenceReasons.length > 0 ? `\n(${presenceReasons.join('; ')})` : ''}
          </Text>
        )}
        {driverAway && (
          <Text style={styles.hint}>🚶 Phát hiện tài xế đã rời xe — leo thang sớm.</Text>
        )}
        {engineState === 'confirming' && isRoutineContext && (
          <Text style={styles.hint}>💡 Bạn thường xuống xe ở đây — đã nới thời gian xác nhận.</Text>
        )}

        {remaining !== null && (
          <Text style={styles.countdown}>{remaining}s</Text>
        )}

        <TouchableOpacity style={styles.ackBtn} onPress={acknowledge} activeOpacity={0.8}>
          <Text style={styles.ackLabel}>✅ TÔI ĐÃ ĐƯA BÉ RA</Text>
        </TouchableOpacity>

        {engineState === 'escalated' && (
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => Linking.openURL('tel:115')}
          >
            <Text style={styles.emergencyLabel}>Gọi cấp cứu 115</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  title: { color: colors.white, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: {
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.9,
  },
  hint: { color: colors.white, fontSize: 14, textAlign: 'center', marginTop: spacing.sm, opacity: 0.85 },
  countdown: { color: colors.white, fontSize: 72, fontWeight: '900', marginVertical: spacing.lg },
  ackBtn: {
    backgroundColor: colors.white,
    paddingVertical: 20,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  ackLabel: { color: colors.primaryDark, fontSize: 18, fontWeight: '800' },
  emergencyBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.white,
  },
  emergencyLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
