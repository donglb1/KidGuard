import { AlertLevel, Contact, GeoPoint, Settings } from '@/models';

/**
 * alertEngine — máy trạng thái leo thang cảnh báo.
 *
 * Luồng:
 *   IDLE ──armConfirm()──> CONFIRMING
 *   CONFIRMING ──acknowledge()──> IDLE (an toàn)
 *   CONFIRMING ──timeout(T1)──> ALARM_LOCAL   (chuông + rung)
 *   ALARM_LOCAL ──acknowledge()──> IDLE
 *   ALARM_LOCAL ──timeout(T2)──> CALLING_CONTACTS
 *   CALLING_CONTACTS: lần lượt từng người thân, mỗi người chờ T3s
 *   CALLING_CONTACTS ──hết danh sách──> ESCALATED
 *   Ở bất kỳ trạng thái nào: acknowledge() → dừng toàn bộ, về IDLE.
 *
 * Engine không tự biết cách phát chuông / gọi điện — nó gọi ra ngoài qua `hooks`,
 * nên dễ test và dễ thay thế provider.
 */

export type EngineState = 'idle' | AlertLevel;

export interface EngineHooks {
  /** Báo trạng thái thay đổi (để UI cập nhật). */
  onState: (state: EngineState) => void;
  /** Bắt đầu phát chuông/rung báo động tại máy. */
  startAlarm: () => void;
  /** Dừng chuông/rung. */
  stopAlarm: () => void;
  /** Gọi điện cho một người thân. Trả về true nếu đã khởi tạo cuộc gọi. */
  call: (contact: Contact, location?: GeoPoint) => Promise<boolean>;
  /** Gửi SMS cho một người thân. */
  sms: (contact: Contact, location?: GeoPoint) => Promise<boolean>;
  /** Lấy vị trí hiện tại (có thể undefined nếu tắt/không cấp quyền). */
  getLocation?: () => Promise<GeoPoint | undefined>;
  /** Ghi nhận một sự kiện cảnh báo (để lưu nhật ký). */
  onAlertEvent?: (level: AlertLevel, location?: GeoPoint) => void;
}

export class AlertEngine {
  private state: EngineState = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private settings: Settings;
  private contacts: Contact[] = [];
  private contactIndex = 0;
  private lastLocation?: GeoPoint;
  private confirmSeconds = 0;

  constructor(private hooks: EngineHooks, settings: Settings) {
    this.settings = settings;
  }

  getState(): EngineState {
    return this.state;
  }

  /** Thời gian xác nhận (T1) hiệu lực cho lần cảnh báo hiện tại (đã áp học thói quen). */
  getConfirmSeconds(): number {
    return this.confirmSeconds;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  /**
   * Bắt đầu chu trình xác nhận sau khi chuyến đi kết thúc.
   * @param opts.confirmSeconds ghi đè thời gian xác nhận T1 (do học thói quen tính).
   * @param opts.location vị trí đã biết (bỏ qua bước tự lấy lại).
   */
  async armConfirm(
    contacts: Contact[],
    opts?: { confirmSeconds?: number; location?: GeoPoint },
  ): Promise<void> {
    // Sắp xếp người thân theo độ ưu tiên tăng dần (1 gọi trước).
    this.contacts = [...contacts].sort((a, b) => a.priority - b.priority);
    this.contactIndex = 0;
    this.lastLocation = opts?.location ?? (await this.resolveLocation());
    this.confirmSeconds = Math.max(0, opts?.confirmSeconds ?? this.settings.t1Seconds);
    this.setState('confirming');
    this.schedule(this.confirmSeconds, () => this.toAlarmLocal());
  }

  /**
   * Rút ngắn bước xác nhận (vd khi xác nhận tài xế đã rời xe + nghi còn bé) → báo động sớm hơn.
   * Chỉ tác dụng khi đang ở bước xác nhận và giá trị mới ngắn hơn hiện tại.
   */
  hastenConfirm(seconds: number): void {
    if (this.state !== 'confirming') return;
    if (seconds >= this.confirmSeconds) return;
    this.confirmSeconds = seconds;
    this.schedule(seconds, () => this.toAlarmLocal());
  }

  /** Người dùng xác nhận đã đưa bé ra khỏi xe → dừng mọi cảnh báo. */
  acknowledge(): void {
    this.clearTimer();
    this.hooks.stopAlarm();
    this.setState('idle');
  }

  /** Dừng khẩn (huỷ chuyến) — giống acknowledge nhưng ngữ nghĩa nội bộ. */
  reset(): void {
    this.acknowledge();
  }

  private async resolveLocation(): Promise<GeoPoint | undefined> {
    if (!this.settings.attachLocation || !this.hooks.getLocation) return undefined;
    try {
      return await this.hooks.getLocation();
    } catch {
      return undefined;
    }
  }

  private toAlarmLocal(): void {
    this.setState('alarm_local');
    this.hooks.onAlertEvent?.('alarm_local', this.lastLocation);
    this.hooks.startAlarm();
    this.schedule(this.settings.t2Seconds, () => this.toCallingContacts());
  }

  private async toCallingContacts(): Promise<void> {
    this.setState('calling_contacts');
    this.hooks.onAlertEvent?.('calling_contacts', this.lastLocation);
    // Chuông vẫn kêu trong khi gọi.
    await this.callNextContact();
  }

  private async callNextContact(): Promise<void> {
    if (this.state !== 'calling_contacts') return; // đã bị acknowledge
    if (this.contactIndex >= this.contacts.length) {
      this.toEscalated();
      return;
    }
    const contact = this.contacts[this.contactIndex];
    this.contactIndex += 1;

    if (contact.notifyBySms) {
      await this.safe(() => this.hooks.sms(contact, this.lastLocation));
      // Nếu người dùng đã xác nhận (đưa bé ra) trong lúc gửi SMS → dừng ngay, không gọi tiếp.
      if (this.state !== 'calling_contacts') return;
    }
    if (contact.notifyByCall) {
      await this.safe(() => this.hooks.call(contact, this.lastLocation));
      if (this.state !== 'calling_contacts') return;
    }

    // Chờ T3 giây rồi chuyển người kế tiếp nếu vẫn chưa được xác nhận.
    this.schedule(this.settings.t3Seconds, () => this.callNextContact());
  }

  private toEscalated(): void {
    this.setState('escalated');
    this.hooks.onAlertEvent?.('escalated', this.lastLocation);
    // Giữ chuông kêu; UI sẽ gợi ý gọi cứu hộ khẩn cấp.
  }

  // ---- tiện ích nội bộ ----

  private setState(s: EngineState): void {
    this.state = s;
    this.hooks.onState(s);
  }

  private schedule(seconds: number, fn: () => void): void {
    this.clearTimer();
    this.timer = setTimeout(fn, Math.max(0, seconds) * 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async safe(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      console.warn('[alertEngine] hook lỗi:', e);
    }
  }
}
