import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Subtle, Title } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useStore } from '@/state/store';

export default function ContactsScreen() {
  const { data, addContact, removeContact } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [byCall, setByCall] = useState(true);
  const [bySms, setBySms] = useState(true);

  const handleAdd = () => {
    if (!name.trim() || !phone.trim()) return;
    addContact({
      name: name.trim(),
      phone: phone.trim(),
      priority: data.contacts.length + 1,
      notifyByCall: byCall,
      notifyBySms: bySms,
    });
    setName('');
    setPhone('');
  };

  const sorted = [...data.contacts].sort((a, b) => a.priority - b.priority);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.h1}>Liên hệ khẩn cấp</Text>
        <Subtle>App sẽ gọi/nhắn theo thứ tự khi phát hiện nguy cơ bỏ quên trẻ.</Subtle>

        <Card style={{ marginTop: spacing.md }}>
          <Title>Thêm liên hệ</Title>
          <Field label="Tên" value={name} onChangeText={setName} placeholder="Mẹ / Bố / Ông..." />
          <Field
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            placeholder="09xxxxxxxx"
            keyboardType="phone-pad"
          />
          <ToggleRow label="Gọi điện" value={byCall} onChange={setByCall} />
          <ToggleRow label="Gửi SMS" value={bySms} onChange={setBySms} />
          <Button label="Thêm" onPress={handleAdd} disabled={!name.trim() || !phone.trim()} />
        </Card>

        {sorted.length === 0 ? (
          <Subtle>Chưa có liên hệ nào. Hãy thêm ít nhất một số điện thoại.</Subtle>
        ) : (
          sorted.map((c) => (
            <Card key={c.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    #{c.priority} {c.name}
                  </Text>
                  <Subtle>
                    {c.phone} · {c.notifyByCall ? 'Gọi' : ''}
                    {c.notifyByCall && c.notifyBySms ? ' + ' : ''}
                    {c.notifyBySms ? 'SMS' : ''}
                  </Subtle>
                </View>
                <TouchableOpacity onPress={() => removeContact(c.id)}>
                  <Text style={styles.remove}>Xoá</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
      <Text style={{ color: colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  remove: { color: colors.danger, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
