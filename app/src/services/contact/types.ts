import { Contact, GeoPoint } from '@/models';

export interface CallResult {
  ok: boolean;
  /** Cách thực hiện: backend tự động hay mở màn hình gọi trên máy. */
  via: 'backend' | 'device' | 'mock';
  detail?: string;
}

/**
 * Interface chung cho mọi cách gọi/gửi SMS.
 * - MockProvider: dùng để chạy thử (không gọi thật).
 * - DeviceProvider: mở màn hình gọi (tel:) / soạn SMS trên máy (fallback).
 * - TwilioProvider / StringeeProvider: gọi/SMS tự động qua backend (Phase 2, cần khoá API).
 */
export interface AlertProvider {
  readonly name: string;
  call(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult>;
  sms(contact: Contact, message: string, location?: GeoPoint): Promise<CallResult>;
}
