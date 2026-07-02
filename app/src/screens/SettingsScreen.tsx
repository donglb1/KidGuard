import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Subtle, Title } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useStore } from '@/state/store';

export default function SettingsScreen() {
  const {
    data,
    addChild,
    removeChild,
    addVehicle,
    removeVehicle,
    updateSettings,
    addPlace,
    removePlace,
  } = useStore();
  const s = data.settings;

  const [childName, setChildName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleBt, setVehicleBt] = useState('');
  const [familyId, setFamilyId] = useState(s.familyId ?? '');
  const [placeName, setPlaceName] = useState('');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.h1}>Cài đặt</Text>

        <Card>
          <Title>Bé</Title>
          {data.children.map((c) => (
            <RowItem key={c.id} label={c.name} onRemove={() => removeChild(c.id)} />
          ))}
          <Field label="Tên bé" value={childName} onChangeText={setChildName} placeholder="Tên bé" />
          <Button
            label="Thêm bé"
            onPress={() => {
              if (!childName.trim()) return;
              addChild({ name: childName.trim() });
              setChildName('');
            }}
            disabled={!childName.trim()}
          />
        </Card>

        <Card>
          <Title>Xe</Title>
          {data.vehicles.map((v) => (
            <RowItem
              key={v.id}
              label={v.bluetoothId ? `${v.name} · BT: ${v.bluetoothId}` : v.name}
              onRemove={() => removeVehicle(v.id)}
            />
          ))}
          <Field
            label="Tên xe"
            value={vehicleName}
            onChangeText={setVehicleName}
            placeholder="VD: Xe nhà"
          />
          <Field
            label="Tên/địa chỉ Bluetooth của xe (tuỳ chọn)"
            value={vehicleBt}
            onChangeText={setVehicleBt}
            placeholder="VD: Car Multimedia hoặc 00:11:22:33:44:55"
          />
          <Button
            label="Thêm xe"
            onPress={() => {
              if (!vehicleName.trim()) return;
              addVehicle({
                name: vehicleName.trim(),
                bluetoothId: vehicleBt.trim() || undefined,
              });
              setVehicleName('');
              setVehicleBt('');
            }}
            disabled={!vehicleName.trim()}
          />
          <Subtle>
            Định danh Bluetooth giúp tự phát hiện khi bạn xuống xe (chỉ Android + bản dev
            build; xem README).
          </Subtle>
        </Card>

        <Card>
          <Title>Gia đình (bố + mẹ cùng nhận cảnh báo)</Title>
          <Subtle>
            Nhập cùng một mã trên điện thoại của bố và mẹ để cả hai cùng nhận cảnh báo. Cần đã
            cấu hình backend.
          </Subtle>
          <Field
            label="Mã gia đình"
            value={familyId}
            onChangeText={setFamilyId}
            placeholder="VD: gia-dinh-nguyen"
            autoCapitalize="none"
          />
          <Button
            label="Lưu mã gia đình"
            onPress={() => updateSettings({ familyId: familyId.trim() || undefined })}
          />
        </Card>

        <Card>
          <Title>Địa điểm an toàn</Title>
          <Subtle>
            Lưu nơi hay đỗ (nhà, trường) để cảnh báo hiển thị tên nơi đỗ thay vì chỉ toạ độ.
          </Subtle>
          {data.places.map((p) => (
            <RowItem key={p.id} label={`${p.name} (${p.radiusMeters}m)`} onRemove={() => removePlace(p.id)} />
          ))}
          <Field
            label="Tên địa điểm"
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="VD: Nhà / Trường"
          />
          <Button
            label="＋ Lưu vị trí hiện tại"
            onPress={async () => {
              if (!placeName.trim()) return;
              const ok = await addPlace(placeName.trim());
              if (ok) setPlaceName('');
            }}
            disabled={!placeName.trim()}
          />
        </Card>

        <Card>
          <Title>Cảnh báo</Title>
          <ToggleRow
            label="Tự động phát hiện kết thúc chuyến"
            value={s.autoDetect}
            onChange={(v) => updateSettings({ autoDetect: v })}
          />
          <ToggleRow
            label="Âm báo động"
            value={s.alarmSound}
            onChange={(v) => updateSettings({ alarmSound: v })}
          />
          <ToggleRow
            label="Học thói quen (giảm báo nhầm)"
            value={s.adaptiveConfirm}
            onChange={(v) => updateSettings({ adaptiveConfirm: v })}
          />
          <ToggleRow
            label="Đính kèm vị trí GPS"
            value={s.attachLocation}
            onChange={(v) => updateSettings({ attachLocation: v })}
          />
          <Subtle>
            Thời gian chờ (giây): hỏi xác nhận {s.t1Seconds}s → báo động {s.t2Seconds}s → mỗi liên
            hệ {s.t3Seconds}s.
          </Subtle>
          <View style={styles.stepRow}>
            <Stepper
              label="T1"
              value={s.t1Seconds}
              onChange={(v) => updateSettings({ t1Seconds: v })}
            />
            <Stepper
              label="T2"
              value={s.t2Seconds}
              onChange={(v) => updateSettings({ t2Seconds: v })}
            />
            <Stepper
              label="T3"
              value={s.t3Seconds}
              onChange={(v) => updateSettings({ t3Seconds: v })}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.rowItem}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Text style={styles.remove} onPress={onRemove}>
        Xoá
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepBtns}>
        <Text style={styles.stepBtn} onPress={() => onChange(Math.max(5, value - 15))}>
          −
        </Text>
        <Text style={styles.stepValue}>{value}s</Text>
        <Text style={styles.stepBtn} onPress={() => onChange(value + 15)}>
          ＋
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  remove: { color: colors.danger, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  stepper: { alignItems: 'center', flex: 1 },
  stepLabel: { color: colors.textDim, marginBottom: 4 },
  stepBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { color: colors.primary, fontSize: 24, fontWeight: '800', paddingHorizontal: 8 },
  stepValue: { color: colors.text, fontSize: 16, minWidth: 40, textAlign: 'center' },
});
