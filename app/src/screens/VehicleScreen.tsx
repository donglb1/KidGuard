import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Subtle, Title } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useStore } from '@/state/store';
import { contactService } from '@/services/contact';

export default function VehicleScreen() {
  const { data } = useStore();
  const familyId = data.settings.familyId;
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const hasBackend = contactService.hasBackend();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const openAuth = () =>
    run(async () => {
      const url = await contactService.getVehicleAuthUrl();
      if (!url) return setStatus('Không lấy được link (kiểm tra backend).');
      setStatus('Đang mở trang liên kết xe...');
      Linking.openURL(url);
    });

  const exchange = () =>
    run(async () => {
      if (!familyId) return setStatus('Hãy đặt Mã gia đình trong Cài đặt trước.');
      const ok = await contactService.exchangeVehicleCode(familyId, code.trim());
      setStatus(ok ? '✅ Đã liên kết xe.' : '❌ Liên kết thất bại.');
      if (ok) setCode('');
    });

  const readState = () =>
    run(async () => {
      if (!familyId) return setStatus('Hãy đặt Mã gia đình trong Cài đặt trước.');
      const s = await contactService.getVehicleState(familyId);
      if (!s) return setStatus('Chưa có dữ liệu xe (chưa liên kết?).');
      const parts: string[] = [];
      if (s.location) parts.push(`Vị trí: ${s.location.latitude.toFixed(4)}, ${s.location.longitude.toFixed(4)}`);
      if (s.cabinTempC != null) parts.push(`Nhiệt độ cabin: ${s.cabinTempC}°C`);
      if (s.odometerKm != null) parts.push(`Odometer: ${s.odometerKm} km`);
      if (s.locked != null) parts.push(`Khoá: ${s.locked ? 'đã khoá' : 'chưa khoá'}`);
      setStatus(parts.join('\n') || 'Không có trường dữ liệu nào.');
    });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.h1}>Kết nối xe</Text>
        <Subtle>
          Đọc dữ liệu SẴN CÓ của xe để tăng độ chính xác cảnh báo (vị trí, nhiệt độ cabin...).
          Hai cách: dongle OBD Bluetooth, hoặc tài khoản xe kết nối (Smartcar).
        </Subtle>

        {!hasBackend && (
          <Card style={{ borderColor: colors.warning }}>
            <Subtle>
              ⚠️ Chưa cấu hình backend. Cần dựng & cấu hình server (xem README) thì phần kết nối
              tài khoản xe mới hoạt động.
            </Subtle>
          </Card>
        )}

        <Card>
          <Title>1) Dongle OBD-II Bluetooth</Title>
          <Subtle>
            Cắm dongle ELM327 vào cổng OBD, ghép đôi ở phần Bluetooth của điện thoại. App sẽ
            đọc trạng thái máy/cửa để phát hiện kết thúc chuyến (cần dev build).
          </Subtle>
        </Card>

        <Card>
          <Title>2) Tài khoản xe kết nối (Smartcar)</Title>
          <Subtle>Mã gia đình: {familyId ? familyId : '(chưa đặt — vào Cài đặt)'}</Subtle>
          <Button label="Lấy link liên kết xe" onPress={openAuth} disabled={busy} />
          <Field
            label="Mã uỷ quyền (code sau khi liên kết)"
            value={code}
            onChangeText={setCode}
            placeholder="Dán code trả về"
            autoCapitalize="none"
          />
          <Button label="Liên kết" onPress={exchange} disabled={busy || !code.trim()} />
          <Button label="Đọc trạng thái xe" onPress={readState} disabled={busy} variant="ghost" />
        </Card>

        {!!status && (
          <Card>
            <Text style={styles.status}>{status}</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  status: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
