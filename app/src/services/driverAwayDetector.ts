import { Pedometer } from 'expo-sensors';

/**
 * driverAwayDetector — dùng cảm biến ĐIỆN THOẠI để xác nhận **tài xế đã rời xe**.
 *
 * "Tài xế rời xe" trong khi nghi còn bé trên xe chính là tình huống nguy hiểm → dùng tín
 * hiệu này để **leo thang sớm hơn** (không phải để bỏ qua cảnh báo).
 *
 * Hai nguồn (đều là cảm biến sẵn có):
 *  - **Pedometer** (Core Motion/step counter): sau khi đỗ xe, nếu số bước tăng nhanh
 *    ⇒ người dùng đang đi bộ rời khỏi xe. (expo-sensors — chạy được thật.)
 *  - **RSSI Bluetooth** giảm dần với thiết bị xe (OBD dongle / head-unit): điện thoại đang
 *    rời xa xe. Cần lớp BLE native cấp RSSI → gọi `onProximityAway()` (guarded ở nơi khác).
 *
 * Detector chỉ phát "driverAway" MỘT lần cho mỗi lần `arm()`.
 */
type Listener = () => void;

export class DriverAwayDetector {
  private listeners = new Set<Listener>();
  private sub: { remove: () => void } | null = null;
  private armed = false;
  private fired = false;
  private baseSteps: number | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    if (this.fired) return;
    this.fired = true;
    this.listeners.forEach((l) => l());
  }

  /** Bắt đầu theo dõi sau khi kết thúc chuyến. stepThreshold: số bước coi là "đã rời xe". */
  async arm(stepThreshold = 12): Promise<void> {
    if (this.armed) return;
    this.armed = true;
    this.fired = false;
    this.baseSteps = null;
    try {
      const available = await Pedometer.isAvailableAsync();
      if (available) {
        this.sub = Pedometer.watchStepCount((result) => {
          // watchStepCount trả số bước tích luỹ kể từ khi bắt đầu theo dõi.
          if (this.baseSteps === null) this.baseSteps = result.steps;
          if (result.steps - (this.baseSteps ?? 0) >= stepThreshold) this.emit();
        });
      }
    } catch (e) {
      console.warn('[driverAway] pedometer lỗi:', e);
    }
  }

  disarm(): void {
    this.sub?.remove();
    this.sub = null;
    this.armed = false;
    this.baseSteps = null;
  }

  /** Gọi từ lớp BLE khi RSSI tới thiết bị xe giảm dưới ngưỡng (điện thoại rời xa xe). */
  onProximityAway(): void {
    if (this.armed) this.emit();
  }

  /** Mô phỏng tài xế rời xe (để test không cần đi bộ/thiết bị BLE). */
  simulateDriverAway(): void {
    this.emit();
  }
}

export const driverAwayDetector = new DriverAwayDetector();
