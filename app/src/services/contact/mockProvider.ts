import { Contact, GeoPoint } from '@/models';
import { AlertProvider, CallResult } from './types';

/** Provider giả lập — không gọi/nhắn thật, chỉ log. Dùng để chạy thử luồng cảnh báo. */
export class MockProvider implements AlertProvider {
  readonly name = 'mock';

  private log: string[] = [];

  async call(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    const line = `[MOCK CALL] → ${contact.name} (${contact.phone}) | ${message}` +
      (location ? ` | @${location.latitude},${location.longitude}` : '');
    this.log.push(line);
    console.log(line);
    return { ok: true, via: 'mock', detail: line };
  }

  async sms(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    const line = `[MOCK SMS] → ${contact.name} (${contact.phone}) | ${message}` +
      (location ? ` | @${location.latitude},${location.longitude}` : '');
    this.log.push(line);
    console.log(line);
    return { ok: true, via: 'mock', detail: line };
  }

  getLog(): string[] {
    return [...this.log];
  }
}
