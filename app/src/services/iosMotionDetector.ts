import { Platform } from 'react-native';
import { tripDetector } from './tripDetector';

/**
 * iosMotionDetector — phát hiện kết thúc chuyến trên iOS mà KHÔNG cần CarPlay entitlement.
 *
 * Dùng các API iOS gốc (không thuộc danh mục hạn chế của CarPlay):
 *  - **Core Motion** (`CMMotionActivityManager`): phân loại đi ô tô/đi bộ/đứng yên.
 *    Chuyển `automotive → stationary/walking` = "vừa xuống xe" → kết thúc chuyến.
 *  - **Visits** (`startMonitoringVisits`): báo vừa "đến/đỗ" một nơi (xác nhận + gắn nhãn).
 *  - (Companion) **Significant Location Change** để đánh thức app trong nền, tiết kiệm pin.
 *
 * YÊU CẦU: đây là API native → cần **dev build** (expo prebuild / EAS dev client) và một
 * native module cầu nối Core Motion/Visits sang JS. Trong Expo Go (không có module) hàm
 * init sẽ **no-op an toàn**, app vẫn chạy bằng GPS/thủ công/mô phỏng.
 *
 * Native module kỳ vọng (tên tuỳ bạn đặt khi hiện thực), interface tối thiểu:
 *   startActivityUpdates(cb: (a: { automotive:boolean; walking:boolean; stationary:boolean }) => void): { remove(): void }
 *   startVisitMonitoring(cb: (v: { arriving:boolean }) => void): { remove(): void }
 */

type Subscription = { remove: () => void };

let subs: Subscription[] = [];
let started = false;
let prevAutomotive = false;

function loadModule(): any | null {
  try {
    // require động: chưa cài/khng có module (vd Expo Go) → bỏ qua.
    const mod = require('react-native-ios-motion-activity');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

export async function startIosMotionDetection(): Promise<boolean> {
  if (started) return true;
  if (Platform.OS !== 'ios') return false; // Android dùng Bluetooth/GPS.
  const M = loadModule();
  if (!M) {
    console.log('[iosMotion] Module không có (Expo Go?) → bỏ qua, dùng GPS/thủ công.');
    return false;
  }
  try {
    const actSub = M.startActivityUpdates?.((a: any) => {
      const automotive = !!a?.automotive;
      if (automotive && !prevAutomotive) {
        // Bắt đầu đi ô tô → bắt đầu chuyến.
        tripDetector.onMotionAutomotiveStart();
      } else if (!automotive && prevAutomotive && (a?.stationary || a?.walking)) {
        // Vừa dừng đi ô tô và đang đứng yên/đi bộ → kết thúc chuyến.
        tripDetector.onMotionStopped();
      }
      prevAutomotive = automotive;
    });
    const visitSub = M.startVisitMonitoring?.((v: any) => {
      if (v?.arriving) tripDetector.onVisitArrival();
    });
    if (actSub) subs.push(actSub);
    if (visitSub) subs.push(visitSub);
    started = true;
    return true;
  } catch (e) {
    console.warn('[iosMotion] start lỗi:', e);
    return false;
  }
}

export function stopIosMotionDetection(): void {
  subs.forEach((s) => {
    try {
      s.remove();
    } catch {
      /* bỏ qua */
    }
  });
  subs = [];
  started = false;
  prevAutomotive = false;
}
