import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

/**
 * notifier — chuông báo động, rung, và thông báo đẩy.
 * Chuông dùng expo-av phát lặp từ asset cục bộ (chạy được cả khi mất mạng).
 */

// Mẫu rung: kêu 0.8s, nghỉ 0.4s, lặp lại.
const VIBRATION_PATTERN = [0, 800, 400];

// Âm báo động cục bộ (bundle trong app) — beep + khoảng lặng, lặp thành chuỗi beep.
const ALARM_ASSET = require('../../assets/alarm.wav');

let sound: Audio.Sound | null = null;
let playing = false;

/**
 * Cấu hình handler thông báo + chế độ âm thanh. KHÔNG xin quyền (không hiện hộp thoại),
 * nên an toàn để gọi mỗi lần khởi động app (kể cả người dùng đã onboard).
 */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  } catch (e) {
    console.warn('[notifier] cấu hình âm thanh lỗi:', e);
  }
}

/** Cấu hình + xin quyền thông báo (dùng trong onboarding, có thể hiện hộp thoại). */
export async function setupNotifications(): Promise<void> {
  await configureNotifications();
  try {
    await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.warn('[notifier] xin quyền thông báo lỗi:', e);
  }
}

export async function startAlarm(withSound: boolean): Promise<void> {
  if (playing) return;
  playing = true;
  Vibration.vibrate(VIBRATION_PATTERN, true);
  if (!withSound) return;
  try {
    const { sound: s } = await Audio.Sound.createAsync(
      ALARM_ASSET,
      { shouldPlay: true, isLooping: true, volume: 1.0 },
    );
    sound = s;
  } catch (e) {
    console.warn('[notifier] không phát được âm báo:', e);
  }
}

export async function stopAlarm(): Promise<void> {
  playing = false;
  Vibration.cancel();
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      /* bỏ qua */
    }
    sound = null;
  }
}

/** Lấy Expo push token của thiết bị (để đăng ký nhận cảnh báo đa thiết bị). */
export async function getExpoPushToken(): Promise<string | undefined> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return undefined;
    }
    // Expo SDK 49+ yêu cầu projectId (từ EAS) khi lấy push token.
    // Điền `extra.eas.projectId` trong app.json sau khi chạy `eas init`.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.warn('[notifier] chưa cấu hình EAS projectId → bỏ qua push token đa thiết bị.');
      return undefined;
    }
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.warn('[notifier] getExpoPushToken lỗi:', e);
    return undefined;
  }
}

/** Bắn thông báo cục bộ (hiện ngay). */
export async function pushLocalNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: Platform.OS === 'android',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[notifier] pushLocalNotification lỗi:', e);
  }
}
