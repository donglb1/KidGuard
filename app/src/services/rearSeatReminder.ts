/**
 * rearSeatReminder — logic "nhắc kiểm tra ghế sau" thuần tuý, dựa trên sự kiện CỬA + MÁY
 * lấy từ dữ liệu sẵn có của xe (OBD / API hãng). KHÔNG cần cảm biến chiếm chỗ ghế sau.
 *
 * Mẫu giống "Rear Seat Reminder" của các hãng:
 *  - Nếu **cửa sau được mở** trong lúc lên xe (trước/đang chuyến) ⇒ "có thể đã đặt bé phía sau".
 *  - Khi **tắt máy** (kết thúc chuyến) mà cửa sau **chưa được mở lại** để lấy bé ra
 *    ⇒ **nghi ngờ còn bé ở ghế sau** ⇒ nhắc/cảnh báo.
 *
 * Đây chỉ là NHẮC dựa trên suy luận (đa số xe không biết ghế sau có ai), nên hệ thống luôn
 * thiên về cảnh báo. Lớp này thuần logic để dễ kiểm chứng.
 */
export class RearSeatReminder {
  private active = false;
  private ignitionOff = false;
  private rearOpenedDuringTrip = false;
  private rearOpenedAfterOff = false;

  /** Bắt đầu chuyến mới: xoá trạng thái. */
  onTripStart(): void {
    this.active = true;
    this.ignitionOff = false;
    this.rearOpenedDuringTrip = false;
    this.rearOpenedAfterOff = false;
  }

  /** Sự kiện cửa: rear=true nếu là cửa sau; open=true nếu mở. */
  onDoorEvent(rear: boolean, open: boolean): void {
    if (!this.active || !rear || !open) return;
    if (this.ignitionOff) {
      // Mở cửa sau SAU khi tắt máy = đang lấy bé ra → hết nghi ngờ.
      this.rearOpenedAfterOff = true;
    } else {
      // Mở cửa sau trong lúc lên xe/di chuyển = có thể đã đặt bé.
      this.rearOpenedDuringTrip = true;
    }
  }

  /** Xe tắt máy (chuẩn bị kết thúc chuyến). */
  onIgnitionOff(): void {
    this.ignitionOff = true;
  }

  /** Đánh giá: có nghi ngờ còn bé ở ghế sau không. */
  evaluate(): boolean {
    return this.rearOpenedDuringTrip && !this.rearOpenedAfterOff;
  }

  /** Kết thúc chuyến: trả về kết quả nghi ngờ rồi ngừng theo dõi. */
  finish(): boolean {
    const suspect = this.evaluate();
    this.active = false;
    return suspect;
  }
}

// Singleton dùng chung toàn app.
export const rearSeatReminder = new RearSeatReminder();
