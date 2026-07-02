import * as Location from 'expo-location';
import { TripEndReason } from '@/models';

/**
 * tripDetector — phát hiện bắt đầu / kết thúc chuyến đi.
 *
 * Nhiều nguồn tín hiệu:
 *  - Thủ công: người dùng bấm nút.
 *  - Activity/tốc độ: dùng expo-location theo dõi tốc độ; khi đang "đang lái"
 *    (tốc độ > ngưỡng) chuyển sang "dừng hẳn" (tốc độ ~0 trong N giây) ⇒ kết thúc chuyến.
 *  - Bluetooth: (khung sẵn) khi ngắt kết nối BT của xe ⇒ kết thúc chuyến.
 *    Cần thư viện BLE native (ngoài Expo Go), nên Phase 1 để giao diện gọi `onBluetoothDisconnected()`.
 *  - Mô phỏng: `simulateTripEnd()` để test trên simulator/Expo Go không có thiết bị.
 *
 * Detector chỉ phát sự kiện; việc bắt đầu chu trình cảnh báo do store xử lý.
 */

export type TripEvent =
  | { type: 'start' }
  | { type: 'end'; reason: TripEndReason };

type Listener = (e: TripEvent) => void;

// Ngưỡng phát hiện lái xe/dừng (m/s). ~2.8 m/s ≈ 10 km/h.
const DRIVING_SPEED = 2.8;
// Số lần đọc liên tiếp ở trạng thái đứng yên để coi là "đã dừng hẳn".
const STOPPED_READINGS = 3;

export class TripDetector {
  private listeners = new Set<Listener>();
  private watcher: Location.LocationSubscription | null = null;
  private wasDriving = false;
  private stoppedCount = 0;
  private autoEnabled = false;
  private tripActive = false;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: TripEvent): void {
    if (e.type === 'start') this.tripActive = true;
    if (e.type === 'end') this.tripActive = false;
    this.listeners.forEach((l) => l(e));
  }

  isTripActive(): boolean {
    return this.tripActive;
  }

  // ---- Thủ công ----
  startManual(): void {
    if (this.tripActive) return;
    this.emit({ type: 'start' });
  }

  endManual(): void {
    if (!this.tripActive) return;
    this.emit({ type: 'end', reason: 'manual' });
  }

  // ---- Mô phỏng (dùng để test) ----
  simulateTripEnd(): void {
    if (!this.tripActive) this.emit({ type: 'start' });
    this.emit({ type: 'end', reason: 'simulated' });
  }

  // ---- Bluetooth (khung tích hợp) ----
  /** Gọi khi phát hiện Bluetooth xe ngắt kết nối (từ lớp native/BLE). */
  onBluetoothDisconnected(): void {
    if (this.tripActive) this.emit({ type: 'end', reason: 'bluetooth' });
  }

  /** Gọi khi kết nối Bluetooth xe (bắt đầu chuyến). */
  onBluetoothConnected(): void {
    if (!this.tripActive) this.emit({ type: 'start' });
  }

  // ---- iOS Core Motion / Visits (khung tích hợp, xem iosMotionDetector) ----
  /** Core Motion báo bắt đầu trạng thái "đi ô tô" → bắt đầu chuyến. */
  onMotionAutomotiveStart(): void {
    if (!this.tripActive) this.emit({ type: 'start' });
  }

  /** Core Motion báo chuyển từ "đi ô tô" sang đứng yên/đi bộ → kết thúc chuyến. */
  onMotionStopped(): void {
    if (this.tripActive) this.emit({ type: 'end', reason: 'activity' });
  }

  /** Visits API báo vừa "đến/đỗ" tại một nơi → xác nhận kết thúc chuyến. */
  onVisitArrival(): void {
    if (this.tripActive) this.emit({ type: 'end', reason: 'activity' });
  }

  // ---- Dữ liệu xe qua OBD / API hãng (xem obdReader) ----
  /** Xe nổ máy → bắt đầu chuyến. */
  onVehicleEngineStart(): void {
    if (!this.tripActive) this.emit({ type: 'start' });
  }

  /** Xe tắt máy → kết thúc chuyến. */
  onVehicleEngineStop(): void {
    if (this.tripActive) this.emit({ type: 'end', reason: 'obd' });
  }

  // ---- Tự động theo activity/tốc độ ----
  async enableAutoDetect(): Promise<boolean> {
    if (this.autoEnabled) return true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      this.watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (pos) => this.handleReading(pos.coords.speed ?? 0),
      );
      this.autoEnabled = true;
      return true;
    } catch (e) {
      console.warn('[tripDetector] enableAutoDetect lỗi:', e);
      return false;
    }
  }

  disableAutoDetect(): void {
    this.watcher?.remove();
    this.watcher = null;
    this.autoEnabled = false;
    this.wasDriving = false;
    this.stoppedCount = 0;
  }

  private handleReading(speed: number): void {
    if (speed >= DRIVING_SPEED) {
      // Đang lái xe.
      if (!this.tripActive) this.emit({ type: 'start' });
      this.wasDriving = true;
      this.stoppedCount = 0;
      return;
    }
    // Tốc độ thấp.
    if (this.wasDriving) {
      this.stoppedCount += 1;
      if (this.stoppedCount >= STOPPED_READINGS) {
        this.wasDriving = false;
        this.stoppedCount = 0;
        this.emit({ type: 'end', reason: 'activity' });
      }
    }
  }
}

// Singleton dùng chung toàn app.
export const tripDetector = new TripDetector();
