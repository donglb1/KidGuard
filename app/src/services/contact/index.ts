import { Child, Contact, GeoPoint } from '@/models';
import { mapsLink } from '@/services/location';
import { AlertProvider, CallResult } from './types';
import { MockProvider } from './mockProvider';
import { DeviceProvider } from './deviceProvider';
import { BackendProvider, BackendConfig } from './backendProvider';

export type ProviderKind = 'mock' | 'device' | 'backend';

/**
 * contactService — chọn provider và điều phối gọi/SMS.
 *
 * Ưu tiên: nếu đã cấu hình backend hợp lệ → dùng backend (gọi/SMS tự động).
 * Nếu không → dùng thiết bị (mở màn hình gọi / soạn SMS).
 * `mock` dùng khi chạy thử luồng cảnh báo mà không muốn gọi/nhắn thật.
 */
class ContactService {
  private mock = new MockProvider();
  private device = new DeviceProvider();
  private backend: BackendProvider | null = null;
  private backendConfig: BackendConfig | null = null;
  private active: ProviderKind = 'mock';

  /** Đặt cấu hình backend. Truyền baseUrl rỗng để tắt backend. */
  configureBackend(config?: BackendConfig): void {
    if (config?.baseUrl) {
      this.backend = new BackendProvider(config);
      this.backendConfig = config;
    } else {
      this.backend = null;
      this.backendConfig = null;
    }
  }

  hasBackend(): boolean {
    return !!this.backendConfig;
  }

  private async postBackend(path: string, body: unknown): Promise<boolean> {
    const cfg = this.backendConfig;
    if (!cfg?.baseUrl) return false;
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (e) {
      console.warn('[contactService] postBackend lỗi:', e);
      return false;
    }
  }

  /** Đăng ký thiết bị vào một gia đình để cùng nhận cảnh báo (bố + mẹ). */
  async registerFamilyDevice(familyId: string, pushToken: string, deviceName: string): Promise<boolean> {
    if (!familyId || !pushToken) return false;
    return this.postBackend('/register', { familyId, pushToken, deviceName });
  }

  /** Báo cho các thiết bị khác trong gia đình khi có cảnh báo. */
  async notifyFamily(
    familyId: string,
    title: string,
    body: string,
    excludeToken?: string,
  ): Promise<boolean> {
    if (!familyId) return false;
    return this.postBackend('/notify-family', { familyId, title, body, excludeToken });
  }

  private async getBackend(path: string, timeoutMs = 2500): Promise<any | null> {
    const cfg = this.backendConfig;
    if (!cfg?.baseUrl) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[contactService] getBackend lỗi:', e);
      return null;
    }
  }

  // ---- Dữ liệu xe kết nối (Smartcar qua server) ----
  async getVehicleAuthUrl(): Promise<string | null> {
    const j = await this.getBackend('/vehicle/auth-url');
    return j?.url ?? null;
  }

  async exchangeVehicleCode(familyId: string, code: string): Promise<boolean> {
    if (!familyId || !code) return false;
    return this.postBackend('/vehicle/exchange', { familyId, code });
  }

  /** Trả về trạng thái xe: { location?, cabinTempC?, odometerKm?, locked? } hoặc null. */
  async getVehicleState(
    familyId: string,
  ): Promise<{ location?: GeoPoint; cabinTempC?: number; odometerKm?: number; locked?: boolean } | null> {
    if (!familyId) return null;
    return this.getBackend(`/vehicle/state?familyId=${encodeURIComponent(familyId)}`);
  }

  setProvider(kind: ProviderKind): void {
    this.active = kind;
  }

  getProviderName(): string {
    return this.resolve().name;
  }

  private resolve(): AlertProvider {
    if (this.active === 'backend' && this.backend) return this.backend;
    if (this.active === 'device') return this.device;
    if (this.active === 'backend' && !this.backend) return this.device; // backend chưa sẵn → fallback
    return this.mock;
  }

  getMockLog(): string[] {
    return this.mock.getLog();
  }

  buildMessage(child: Child | undefined, location?: GeoPoint, placeLabel?: string): string {
    const who = child?.name ? `bé ${child.name}` : 'trẻ nhỏ';
    const link = mapsLink(location);
    const base = `⚠️ CẢNH BÁO AnToànBé: Có thể ${who} đang bị bỏ quên trong xe! Vui lòng kiểm tra NGAY.`;
    const parts = [base];
    if (placeLabel) parts.push(`Nơi đỗ: ${placeLabel}`);
    if (link) parts.push(`Vị trí xe: ${link}`);
    return parts.join('\n');
  }

  async call(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.resolve().call(contact, message, location);
  }

  async sms(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult> {
    return this.resolve().sms(contact, message, location);
  }
}

export const contactService = new ContactService();
export type { CallResult };
