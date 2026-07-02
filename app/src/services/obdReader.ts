/**
 * obdReader — đọc dữ liệu SẴN CÓ của xe (trạng thái máy, cửa) để phát hiện kết thúc chuyến
 * và nuôi logic nhắc ghế sau. KHÔNG thêm cảm biến mới.
 *
 * Kênh: dongle **OBD-II Bluetooth (ELM327)** cắm cổng OBD của xe. Đọc:
 *  - Trạng thái máy qua RPM (RPM > 0 = đang nổ máy; về 0 = tắt máy).
 *  - Cửa/đai an toàn qua PID theo hãng (khác nhau tuỳ hãng — cần map riêng).
 *
 * Đây là native BLE → cần **dev build** + thư viện BLE (vd `react-native-ble-plx`).
 * Trong Expo Go (không có module) sẽ **no-op an toàn**; dùng các hàm `simulate*` để test
 * toàn bộ luồng mà không cần dongle/xe thật.
 *
 * Lưu ý: cổng OBD nhiều xe vẫn cấp điện khi tắt máy → dongle có thể hao ắc-quy; bản thật
 * nên dùng dongle có chế độ ngủ/ngắt.
 */
import { tripDetector } from './tripDetector';
import { driverAwayDetector } from './driverAwayDetector';

// Ngưỡng RSSI (dBm) coi là "điện thoại đã rời xa xe".
const RSSI_AWAY_THRESHOLD = -85;

export type VehicleEvent =
  | { type: 'engine'; on: boolean }
  | { type: 'door'; rear: boolean; open: boolean }
  | { type: 'seatbelt'; rear: boolean; buckled: boolean }
  | { type: 'occupancy'; rear: boolean; occupied: boolean }
  | { type: 'temp'; celsius: number };

type Listener = (e: VehicleEvent) => void;

class ObdReader {
  private listeners = new Set<Listener>();
  private started = false;
  private nativeStop: (() => void) | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: VehicleEvent): void {
    // Vừa phát cho lớp trên (store → rearSeatReminder), vừa nối thẳng vào tripDetector.
    this.listeners.forEach((l) => l(e));
    if (e.type === 'engine') {
      if (e.on) tripDetector.onVehicleEngineStart();
      else tripDetector.onVehicleEngineStop();
    }
  }

  private loadBleModule(): any | null {
    try {
      const mod = require('react-native-ble-plx');
      return mod?.BleManager ? mod : null;
    } catch {
      return null;
    }
  }

  /** Bắt đầu đọc OBD qua BLE (cần dev build + dongle). No-op nếu không có module. */
  async startObd(): Promise<boolean> {
    if (this.started) return true;
    const Ble = this.loadBleModule();
    if (!Ble) {
      console.log('[obd] Không có BLE module (Expo Go?) → bỏ qua, dùng mô phỏng/tín hiệu khác.');
      return false;
    }
    try {
      // TODO(dev build): kết nối ELM327, gửi lệnh AT, poll PID 010C (RPM) + PID cửa theo hãng,
      // rồi gọi this.emit({type:'engine',on}) / this.emit({type:'door',rear,open}).
      // Phần parse CAN cụ thể phụ thuộc hãng xe nên để lại khi có dongle thật để hiệu chỉnh.
      this.started = true;
      return true;
    } catch (e) {
      console.warn('[obd] startObd lỗi:', e);
      return false;
    }
  }

  stopObd(): void {
    this.nativeStop?.();
    this.nativeStop = null;
    this.started = false;
  }

  // ---- Mô phỏng để test không cần dongle/xe ----
  simulateEngine(on: boolean): void {
    this.emit({ type: 'engine', on });
  }

  simulateRearDoor(open: boolean): void {
    this.emit({ type: 'door', rear: true, open });
  }

  simulateRearSeatbelt(buckled: boolean): void {
    this.emit({ type: 'seatbelt', rear: true, buckled });
  }

  simulateRearOccupancy(occupied: boolean): void {
    this.emit({ type: 'occupancy', rear: true, occupied });
  }

  simulateCabinTemp(celsius: number): void {
    this.emit({ type: 'temp', celsius });
  }

  /**
   * Cập nhật RSSI đo được tới thiết bị xe (từ lớp BLE). Nếu yếu hơn ngưỡng ⇒ điện thoại
   * đang rời xa xe ⇒ báo cho driverAwayDetector (leo thang sớm nếu nghi còn bé).
   */
  onCarRssi(rssi: number): void {
    if (rssi <= RSSI_AWAY_THRESHOLD) driverAwayDetector.onProximityAway();
  }

  /** Mô phỏng điện thoại rời xa xe theo RSSI (để test không cần đo BLE thật). */
  simulateMovingAway(): void {
    this.onCarRssi(-95);
  }
}

export const obdReader = new ObdReader();
