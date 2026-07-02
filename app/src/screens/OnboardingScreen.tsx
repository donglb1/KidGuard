import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Subtle, Title } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useStore } from '@/state/store';
import { requestLocationPermission } from '@/services/location';
import { setupNotifications } from '@/services/notifier';

export default function OnboardingScreen() {
  const { setOnboarded } = useStore();

  const handleStart = async () => {
    await setupNotifications();
    await requestLocationPermission();
    setOnboarded(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.logo}>🚗👶 KidGuard</Text>
        <Subtle>Hệ thống cảnh báo quên trẻ trên ô tô</Subtle>

        <Card style={{ marginTop: spacing.lg }}>
          <Title>Cách hoạt động</Title>
          <Subtle>
            1. Khi kết thúc chuyến đi (tự động hoặc bấm tay), app hỏi bạn đã đưa bé ra chưa.{'\n'}
            2. Nếu bạn không xác nhận, app rung chuông báo động.{'\n'}
            3. Vẫn không phản hồi → app gọi & nhắn tin cho người thân kèm vị trí xe.
          </Subtle>
        </Card>

        <Card>
          <Title>Quyền cần cấp</Title>
          <Subtle>
            • Thông báo — để báo động khi có nguy cơ.{'\n'}
            • Vị trí — để đính kèm nơi đỗ xe vào cảnh báo và tự phát hiện kết thúc chuyến.
          </Subtle>
        </Card>

        <Button label="Bắt đầu" onPress={handleStart} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  logo: { color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: spacing.xs },
});
