import { HabitStat } from '@/models';

/**
 * habitModel — học thói quen để GIẢM BÁO NHẦM, tuyệt đối KHÔNG tắt báo động.
 *
 * Ý tưởng: gom các lần kết thúc chuyến theo "ngữ cảnh" = nơi đỗ + thứ trong tuần +
 * khung giờ. Với mỗi ngữ cảnh, đếm:
 *  - `acks`: số lần bạn xác nhận NGAY ở bước hỏi (nơi quen, thường không có sự cố).
 *  - `escalations`: số lần để trôi thành báo động (nơi bạn hay bỏ lỡ / quên).
 *
 * Dùng "điểm quen thuộc" để điều chỉnh THỜI GIAN XÁC NHẬN (T1) trong khoảng an toàn:
 *  - Ngữ cảnh càng quen (hay xác nhận ngay) → T1 dài hơn (nhiều thời gian bấm → ít báo nhầm).
 *  - Ngữ cảnh từng leo thang → T1 ngắn hơn → bảo vệ sớm hơn.
 * Chuông/gọi khi HẾT GIỜ luôn được giữ nguyên — model chỉ đổi độ dài, không bỏ bước nào.
 */

const MIN_CONFIRM_SECONDS = 15;
const MAX_FACTOR = 1.5; // trần: tối đa 150% thời gian gốc
const MIN_FACTOR = 0.5; // sàn: tối thiểu 50% thời gian gốc
const MIN_SAMPLES = 3; // cần đủ dữ liệu mới điều chỉnh

/** Khoá ngữ cảnh: nơi đỗ (id địa điểm an toàn hoặc 'other') + thứ + khung 3 giờ. */
export function contextKey(placeId: string | undefined, at: Date = new Date()): string {
  const weekday = at.getDay(); // 0..6
  const bucket = Math.floor(at.getHours() / 3); // 0..7
  return `${placeId || 'other'}|w${weekday}|h${bucket}`;
}

/** Điểm quen thuộc ∈ [0,1]: càng gần 1 nghĩa là hay xác nhận ngay (ít rủi ro). */
export function routineScore(stat?: HabitStat): number {
  if (!stat) return 0.5;
  const total = stat.acks + stat.escalations;
  if (total === 0) return 0.5;
  return stat.acks / total;
}

export function sampleCount(stat?: HabitStat): number {
  if (!stat) return 0;
  return stat.acks + stat.escalations;
}

/** Ngữ cảnh có được coi là "quen thuộc" để hiện gợi ý không. */
export function isRoutine(stat?: HabitStat): boolean {
  return sampleCount(stat) >= MIN_SAMPLES && routineScore(stat) >= 0.7;
}

/**
 * Điều chỉnh thời gian xác nhận (giây) theo thói quen, có kẹp min/max.
 * Chưa đủ mẫu → giữ nguyên `base`.
 */
export function adjustConfirmSeconds(base: number, stat?: HabitStat): number {
  if (sampleCount(stat) < MIN_SAMPLES) return base;
  const score = routineScore(stat); // 0..1
  // score 0 -> MIN_FACTOR, score 1 -> MAX_FACTOR (nội suy tuyến tính).
  const factor = MIN_FACTOR + (MAX_FACTOR - MIN_FACTOR) * score;
  const adjusted = Math.round(base * factor);
  return Math.max(MIN_CONFIRM_SECONDS, adjusted);
}

/** Cập nhật thống kê sau một lần kết thúc chuyến. Trả về bản ghi mới (không đột biến). */
export function recordOutcome(stat: HabitStat | undefined, outcome: 'ack' | 'escalation'): HabitStat {
  const base: HabitStat = stat ?? { acks: 0, escalations: 0, lastSeen: 0 };
  return {
    acks: base.acks + (outcome === 'ack' ? 1 : 0),
    escalations: base.escalations + (outcome === 'escalation' ? 1 : 0),
    lastSeen: Date.now(),
  };
}
