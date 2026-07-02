/**
 * presenceModel — HỢP NHẤT nhiều tín hiệu (sensor fusion) từ các cảm biến SẴN CÓ để ước
 * lượng khả năng "còn bé trên xe", nhằm tăng độ chính xác so với chỉ dùng một tín hiệu.
 *
 * Nguyên tắc an toàn:
 *  - Thiên về cảnh báo: nghi ngờ thì báo.
 *  - Chỉ **hạ mức** khi có cảm biến ĐÁNG TIN nói ghế trống (vd cảm biến chiếm chỗ = trống).
 *  - Không tín hiệu đơn lẻ nào là tuyệt đối; cộng dồn có trọng số.
 */

export interface SignalInputs {
  /** Cảm biến chiếm chỗ ghế sau (nếu xe có): true=có người, false=trống, undefined=không rõ. */
  rearOccupancy?: boolean;
  /** Đai an toàn ghế sau đang cài (chưa tháo) khi tắt máy. */
  rearSeatbeltBuckled?: boolean;
  /** Logic cửa: cửa sau mở lúc lên xe và chưa mở lại. */
  rearDoorSuspect?: boolean;
  /** App: có hồ sơ bé gắn vào chuyến này. */
  childRegisteredAboard?: boolean;
}

export type PresenceLevel = 'low' | 'medium' | 'high';

export interface PresenceAssessment {
  likelihood: number; // 0..1
  level: PresenceLevel;
  reasons: string[];
}

// Trọng số cộng dồn cho từng tín hiệu (khi không có cảm biến chiếm chỗ quyết định).
const W = {
  seatbelt: 0.5,
  door: 0.35,
  registered: 0.4,
};

export function assessChildPresence(s: SignalInputs): PresenceAssessment {
  const reasons: string[] = [];

  // Cảm biến chiếm chỗ là tín hiệu đáng tin nhất nếu xe có.
  if (s.rearOccupancy === true) {
    return { likelihood: 0.95, level: 'high', reasons: ['Cảm biến ghế sau: CÓ người'] };
  }
  if (s.rearOccupancy === false) {
    // Được phép hạ mức vì cảm biến trực tiếp báo ghế trống.
    return { likelihood: 0.1, level: 'low', reasons: ['Cảm biến ghế sau: trống'] };
  }

  let score = 0;
  if (s.rearSeatbeltBuckled) {
    score += W.seatbelt;
    reasons.push('Đai ghế sau đang cài');
  }
  if (s.rearDoorSuspect) {
    score += W.door;
    reasons.push('Cửa sau mở lúc lên xe, chưa mở lại');
  }
  if (s.childRegisteredAboard) {
    score += W.registered;
    reasons.push('Có hồ sơ bé trên chuyến');
  }

  const likelihood = Math.min(1, score);
  const level: PresenceLevel = likelihood >= 0.6 ? 'high' : likelihood >= 0.3 ? 'medium' : 'low';
  return { likelihood, level, reasons };
}

/**
 * Trần thời gian xác nhận theo nhiệt độ cabin: càng nóng càng báo sớm.
 * Trả về số giây tối đa cho bước xác nhận (không làm dài hơn base).
 */
export function confirmCapForTemp(base: number, cabinTempC?: number): number {
  if (cabinTempC == null) return base;
  if (cabinTempC >= 38) return Math.min(base, 15); // rất nóng: báo gần như ngay
  if (cabinTempC >= 32) return Math.min(base, 30); // nóng: rút ngắn
  return base;
}
