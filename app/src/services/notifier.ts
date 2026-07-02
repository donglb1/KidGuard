import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

/**
 * notifier — chuông báo động, rung, và thông báo đẩy.
 * Chuông dùng expo-av phát lặp. Vì prototype không kèm file âm thanh nhị phân,
 * ta phát âm từ URL công khai; thay bằng asset cục bộ khi đóng gói thật.
 */

// Mẫu rung: kêu 0.8s, nghỉ 0.4s, lặp lại.
const VIBRATION_PATTERN = [0, 800, 400];

// Nguồn âm báo động tạm cho prototype (thay bằng require('../../assets/alarm.mp3') khi có asset).
const ALARM_URI =
  'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

let sound: Audio.Sound | null = null;
let playing = false;

export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  try {
    await Notifications.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  } catch (e) {
    console.warn('[notifier] setup lỗi:', e);
  }
}

export async function startAlarm(withSound: boolean): Promise<void> {
  if (playing) return;
  playing = true;
  Vibration.vibrate(VIBRATION_PATTERN, true);
  if (!withSound) return;
  try {
    const { sound: s } = await Audio.Sound.createAsync(
      { uri: ALARM_URI },
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
    const token = await Notifications.getExpoPushTokenAsync();
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
