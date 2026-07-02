// Mô hình dữ liệu cốt lõi của AnToànBé.

export interface Child {
  id: string;
  name: string;
  ageMonths?: number;
  note?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  /** Tên/định danh thiết bị Bluetooth của xe (dùng để phát hiện ngắt kết nối). */
  bluetoothId?: string;
  plate?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  /** Thứ tự ưu tiên gọi: 1 = gọi trước tiên. */
  priority: number;
  notifyBySms: boolean;
  notifyByCall: boolean;
}

export type TripEndReason = 'manual' | 'bluetooth' | 'activity' | 'simulated' | 'obd';

export interface Trip {
  id: string;
  childId?: string;
  vehicleId?: string;
  startedAt: number;
  endedAt?: number;
  endReason?: TripEndReason;
}

export type AlertLevel =
  | 'confirming' // Đang hỏi xác nhận
  | 'alarm_local' // Chuông/rung tại máy
  | 'calling_contacts' // Đang gọi/SMS người thân
  | 'escalated'; // Đã leo thang tối đa

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface AlertEvent {
  id: string;
  tripId: string;
  level: AlertLevel;
  firedAt: number;
  acknowledgedAt?: number;
  location?: GeoPoint;
}

export interface Settings {
  /** Giây chờ ở trạng thái hỏi xác nhận trước khi báo động tại máy. */
  t1Seconds: number;
  /** Giây báo động tại máy trước khi gọi người thân. */
  t2Seconds: number;
  /** Giây chờ mỗi người thân trước khi chuyển sang người kế tiếp. */
  t3Seconds: number;
  /** Bật tự động phát hiện kết thúc chuyến (Bluetooth / activity). */
  autoDetect: boolean;
  /** Bật âm báo động. */
  alarmSound: boolean;
  /** Đính kèm vị trí GPS khi gửi cảnh báo. */
  attachLocation: boolean;
  /** Mã gia đình (bố + mẹ nhập cùng mã để cùng nhận cảnh báo trên nhiều máy). */
  familyId?: string;
  /** Bật học thói quen: điều chỉnh thời gian xác nhận theo ngữ cảnh (không tắt báo động). */
  adaptiveConfirm: boolean;
}

/** Thống kê thói quen cho một ngữ cảnh (nơi + giờ + thứ trong tuần). */
export interface HabitStat {
  /** Số lần xác nhận ngay ở bước hỏi (ngữ cảnh "quen thuộc", ít rủi ro). */
  acks: number;
  /** Số lần để leo thang thành báo động (ngữ cảnh "rủi ro"). */
  escalations: number;
  lastSeen: number;
}

/** Địa điểm an toàn (nhà/trường...) để gắn nhãn nơi đỗ xe. */
export interface SafePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface AppData {
  children: Child[];
  vehicles: Vehicle[];
  contacts: Contact[];
  trips: Trip[];
  alerts: AlertEvent[];
  places: SafePlace[];
  habits: Record<string, HabitStat>;
  settings: Settings;
  onboarded: boolean;
}

export const defaultSettings: Settings = {
  t1Seconds: 60,
  t2Seconds: 60,
  t3Seconds: 30,
  autoDetect: true,
  alarmSound: true,
  attachLocation: true,
  adaptiveConfirm: true,
};

export const emptyData: AppData = {
  children: [],
  vehicles: [],
  contacts: [],
  trips: [],
  alerts: [],
  places: [],
  habits: {},
  settings: defaultSettings,
  onboarded: false,
};
