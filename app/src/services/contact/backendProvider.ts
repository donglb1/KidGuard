import { Contact, GeoPoint } from '@/models';
import { AlertProvider, CallResult } from './types';

/**
 * Cấu hình backend gọi/SMS tự động.
 *
 * ⚠️ QUAN TRỌNG: KHÔNG gọi trực tiếp Twilio/Stringee từ app di động bằng khoá bí mật —
 * khoá sẽ bị lộ. Đúng cách là dựng một backend nhỏ (Cloud Function / server) giữ khoá,
 * app chỉ gọi tới endpoint đó. Điền URL endpoint của bạn vào `baseUrl` bên dưới.
 *
 * Backend cần cung cấp 2 route:
 *   POST {baseUrl}/call  body: { to, message }
 *   POST {baseUrl}/sms   body: { to, message }
 * và tự dùng Twilio (quốc tế) hoặc Stringee (Việt Nam) để thực hiện.
 */
export interface BackendConfig {
  baseUrl: string; // ví dụ: https://your-server.example.com/api/alert
  apiKey?: string; // token do backend của bạn cấp (KHÔNG phải khoá Twilio/Stringee)
}

export class BackendProvider implements AlertProvider {
  readonly name: string;

  constructor(private config: BackendConfig, name = 'backend') {
    this.name = name;
  }

  private async post(path: string, body: unknown): Promise<CallResult> {
    if (!this.config.baseUrl) {
      return { ok: false, via: 'backend', detail: 'Chưa cấu hình baseUrl' };
    }
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return { ok: false, via: 'backend', detail: `HTTP ${res.status}` };
      }
      return { ok: true, via: 'backend' };
    } catch (e) {
      return { ok: false, via: 'backend', detail: String(e) };
    }
  }

  async call(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.post('/call', { to: contact.phone, name: contact.name, message, location });
  }

  async sms(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.post('/sms', { to: contact.phone, name: contact.name, message, location });
  }
}
