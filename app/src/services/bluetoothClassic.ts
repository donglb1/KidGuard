import { Platform } from 'react-native';
import { tripDetector } from './tripDetector';

/**
 * Tích hợp Bluetooth Classic để phát hiện kết nối/ngắt kết nối với head-unit của xe.
 *
 * THỰC TẾ:
 *  - Ô tô dùng Bluetooth Classic (rảnh tay/A2DP), KHÔNG phải BLE.
 *  - Android: nghe được sự kiện ACL connect/disconnect qua `react-native-bluetooth-classic`.
 *  - iOS: hệ điều hành KHÔNG cho app thấy kết nối/ngắt của loa xe thông thường
 *    (giới hạn MFi/External Accessory) → iOS dựa vào GPS/activity thay thế.
 *
 * YÊU CẦU: đây là native module → phải dùng DEV BUILD (expo prebuild / EAS dev client),
 * KHÔNG chạy trong Expo Go. Nếu module không có, hàm init sẽ no-op an toàn.
 *
 * @param getVehicleBtIds Hàm trả về danh sách định danh Bluetooth (name/address) của
 *   các xe đã đăng ký. Nếu rỗng, coi mọi thiết bị kết nối/ngắt là tín hiệu xe.
 */

type Subscription = { remove: () => void };

let subs: Subscription[] = [];
let started = false;

function loadModule(): any | null {
  try {
    // require động: nếu chưa cài lib (vd Expo Go) sẽ ném lỗi và ta bỏ qua.
    const mod = require('react-native-bluetooth-classic');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

function matches(device: any, ids: string[]): boolean {
  if (ids.length === 0) return true;
  const name = String(device?.name ?? '').toLowerCase();
  const address = String(device?.address ?? '').toLowerCase();
  return ids.some((id) => {
    const v = id.toLowerCase().trim();
    return v.length > 0 && (name.includes(v) || address === v);
  });
}

export async function startBluetoothDetection(getVehicleBtIds: () => string[]): Promise<boolean> {
  if (started) return true;
  if (Platform.OS !== 'android') {
    // iOS: không hỗ trợ phát hiện Classic của loa xe → bỏ qua, dùng GPS/activity.
    return false;
  }
  const BT = loadModule();
  if (!BT) {
    console.log('[bluetoothClassic] Module không có (Expo Go?) → bỏ qua, dùng GPS/activity.');
    return false;
  }
  try {
    const onConnect = BT.onDeviceConnected?.((device: any) => {
      if (matches(device, getVehicleBtIds())) tripDetector.onBluetoothConnected();
    });
    const onDisconnect = BT.onDeviceDisconnected?.((device: any) => {
      if (matches(device, getVehicleBtIds())) tripDetector.onBluetoothDisconnected();
    });
    if (onConnect) subs.push(onConnect);
    if (onDisconnect) subs.push(onDisconnect);
    started = true;
    return true;
  } catch (e) {
    console.warn('[bluetoothClassic] start lỗi:', e);
    return false;
  }
}

export function stopBluetoothDetection(): void {
  subs.forEach((s) => {
    try {
      s.remove();
    } catch {
      /* bỏ qua */
    }
  });
  subs = [];
  started = false;
}

/** Liệt kê thiết bị Bluetooth đã ghép đôi (Android) để người dùng chọn xe. */
export async function listPairedDevices(): Promise<{ name: string; address: string }[]> {
  if (Platform.OS !== 'android') return [];
  const BT = loadModule();
  if (!BT) return [];
  try {
    const devices = await BT.getBondedDevices?.();
    return (devices ?? []).map((d: any) => ({ name: d.name, address: d.address }));
  } catch {
    return [];
  }
}
