import { Linking, Platform } from 'react-native';
import * as SMS from 'expo-sms';
import { Contact, GeoPoint } from '@/models';
import { AlertProvider, CallResult } from './types';

/**
 * Provider dùng chính điện thoại: mở màn hình gọi (tel:) và soạn SMS.
 * Đây là fallback an toàn khi chưa cấu hình backend tự động.
 * Lưu ý: iOS/Android không cho gọi/nhắn HOÀN TOÀN tự động không có tương tác —
 * provider này mở sẵn giao diện để người dùng bấm; SMS có thể gửi qua expo-sms.
 */
export class DeviceProvider implements AlertProvider {
  readonly name = 'device';

  async call(contact: Contact): Promise<CallResult> {
    const url = `tel:${contact.phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) return { ok: false, via: 'device', detail: 'Không mở được tel:' };
      await Linking.openURL(url);
      return { ok: true, via: 'device' };
    } catch (e) {
      return { ok: false, via: 'device', detail: String(e) };
    }
  }

  async sms(contact: Contact, message: string): Promise<CallResult> {
    try {
      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync([contact.phone], message);
        return { ok: true, via: 'device' };
      }
      // Fallback: mở app SMS mặc định qua sms: URL.
      const sep = Platform.OS === 'ios' ? '&' : '?';
      const url = `sms:${contact.phone}${sep}body=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
      return { ok: true, via: 'device' };
    } catch (e) {
      return { ok: false, via: 'device', detail: String(e) };
    }
  }
}
