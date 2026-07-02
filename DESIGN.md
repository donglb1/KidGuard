# AnToànBé — Hệ thống cảnh báo quên trẻ trên ô tô

> Tài liệu thiết kế / kế hoạch (bản v0.1). Đây là bản kế hoạch để thống nhất phạm vi
> trước khi viết code. Chưa có code sản phẩm trong tài liệu này.

---

## 1. Bối cảnh & vấn đề

Mỗi năm trên thế giới có nhiều trường hợp trẻ nhỏ bị bỏ quên trên ô tô dẫn đến tử vong,
chủ yếu do **sốc nhiệt (hyperthermia)**. Nhiệt độ trong xe đóng kín có thể tăng thêm
~10 °C chỉ trong 10 phút và vượt 50 °C sau khoảng 30 phút dưới trời nắng. Trẻ nhỏ có
thân nhiệt tăng nhanh gấp 3–5 lần người lớn, nên nguy hiểm đến rất nhanh.

Nguyên nhân phổ biến **không phải do bất cẩn cố ý**, mà do trí nhớ theo thói quen
(habit memory) đè lên trí nhớ chủ đích: người lớn thay đổi lịch trình, mệt, căng thẳng
→ "quên" là bé đang ở ghế sau.

**Mục tiêu sản phẩm:** giảm rủi ro bỏ quên trẻ bằng một hệ thống cảnh báo nhiều lớp,
tập trung vào **lớp phần mềm (app điện thoại)** trước, có đường mở rộng sang **phần cứng**
gắn trên xe sau này.

---

## 2. Nguyên tắc thiết kế

1. **An toàn là trên hết — thà báo nhầm còn hơn bỏ sót** (fail-safe / err on alerting).
   Nếu hệ thống không chắc bé đã ra khỏi xe, nó phải cảnh báo.
2. **Không phụ thuộc vào việc người dùng nhớ bật.** Cảnh báo phải tự kích hoạt theo
   ngữ cảnh (kết thúc chuyến đi), không cần thao tác thủ công mỗi lần.
3. **Nhiều lớp bảo vệ (defense in depth).** Không có tín hiệu đơn lẻ nào đáng tin 100%,
   nên kết hợp nhiều nguồn: phát hiện lái xe, Bluetooth xe, vị trí, giờ giấc.
4. **Leo thang cảnh báo (escalation).** Nhắc nhẹ → chuông to → gọi/SMS người thân →
   (tương lai) gọi dịch vụ khẩn cấp.
5. **Riêng tư & tiết kiệm pin.** Xử lý tại thiết bị, chỉ gửi dữ liệu tối thiểu ra ngoài.

---

## 3. Phạm vi

### 3.1. Trong phạm vi (Phase 1 — bản prototype phần mềm)
- App di động (Expo / React Native) cho bố/mẹ.
- Đăng ký hồ sơ bé + xe.
- Danh bạ liên hệ khẩn cấp (nhiều số, có thứ tự ưu tiên).
- Phát hiện "kết thúc chuyến đi" (giai đoạn đầu: mô phỏng + thủ công; sau đó: cảm biến
  chuyển động / Bluetooth).
- Đếm ngược xác nhận "Bạn đã đưa bé ra khỏi xe chưa?".
- Kịch bản leo thang: chuông báo động → thông báo → gọi/SMS người thân.
- Nhật ký chuyến đi & cảnh báo.

### 3.2. Ngoài phạm vi (giai đoạn sau / cần phần cứng)
- Cảm biến trọng lượng ghế, cảm biến chuyển động/CO₂/nhiệt độ gắn trên xe.
- Tích hợp trực tiếp với hệ thống xe (CAN bus, Android Auto / CarPlay).
- Gọi tự động tới 113/115 (cần tuân thủ quy định pháp lý từng nước).

---

## 4. Các phương án phát hiện "còn bé trên xe"

Vì app điện thoại **không trực tiếp nhìn thấy bé**, ta suy luận gián tiếp qua tín hiệu.
Bảng dưới đánh giá theo độ tin cậy / độ phức tạp / mức tốn pin.

| # | Tín hiệu | Cách hoạt động | Tin cậy | Phụ thuộc |
|---|----------|----------------|---------|-----------|
| 1 | **Thủ công** | Người dùng bấm "Bắt đầu chở bé" khi lên xe | Thấp | Người nhớ bật |
| 2 | **Phát hiện lái xe** (Activity Recognition) | Điện thoại nhận diện trạng thái `in_vehicle` → khi chuyển sang `still/walking` coi là kết thúc chuyến | Trung bình | OS API, GPS |
| 3 | **Bluetooth xe** | Khi điện thoại **ngắt kết nối** khỏi Bluetooth/head-unit của xe ⇒ vừa xuống xe | Cao (nếu xe có BT) | Xe có Bluetooth |
| 4 | **Địa lý (geofence) + tốc độ** | Xe dừng hẳn tại điểm không phải nhà/trường ⇒ nhắc | Trung bình | GPS, tốn pin |
| 5 | **Beacon/Tag trong ghế** (BLE) | Gắn thẻ BLE ở ghế trẻ; điện thoại rời khỏi vùng thẻ ⇒ cảnh báo | Cao | Cần mua tag |
| 6 | **Phần cứng cảm biến** (tương lai) | Cảm biến trọng lượng/chuyển động báo trực tiếp | Rất cao | Phần cứng |

**Chiến lược đề xuất:** kết hợp **#3 (Bluetooth) làm tín hiệu chính** + **#2 (phát hiện
lái xe) làm dự phòng** + **#1 (thủ công) làm nền tảng cho prototype**. Về sau bổ sung #5/#6.

---

## 5. Luồng hoạt động chính (happy path & alert path)

```
[Lên xe] 
   │  (BT kết nối / phát hiện in_vehicle / bấm thủ công)
   ▼
[Bắt đầu chuyến — hệ thống ghi nhận "có bé trên xe"]
   │
   │  ... đang di chuyển ...
   ▼
[Kết thúc chuyến]  ← BT ngắt kết nối / chuyển sang "still" / bấm "Kết thúc"
   │
   ▼
[Hỏi xác nhận]  "Bạn đã đưa bé ra khỏi xe chưa?"  ⏱ đếm ngược T1 (vd 60s)
   │                                   │
   │ (bấm "Đã đưa bé ra")              │ (không phản hồi sau T1)
   ▼                                   ▼
[Kết thúc an toàn]                 [LỚP 1: Chuông + rung mạnh, thông báo toàn màn hình]
                                        │  ⏱ T2 (vd 60s)
                                        ▼ (vẫn không phản hồi)
                                   [LỚP 2: Gọi/SMS người thân #1]
                                        │  ⏱ T3
                                        ▼ (không nhấc máy)
                                   [LỚP 3: Gọi/SMS người thân #2, #3 ... kèm vị trí GPS]
                                        │
                                        ▼ (tương lai)
                                   [LỚP 4: Gợi ý gọi cứu hộ khẩn cấp]
```

Các mốc thời gian `T1/T2/T3` cấu hình được trong Cài đặt.

---

## 6. Kiến trúc kỹ thuật

### 6.1. Tổng quan
- **Client di động:** Expo / React Native (chạy được cả iOS & Android, phù hợp prototype).
- **Lưu trữ cục bộ:** AsyncStorage / SQLite cho hồ sơ, liên hệ, nhật ký.
- **Backend (tuỳ chọn, Phase 2):** dịch vụ gửi SMS/cuộc gọi tự động (Twilio/Stringee),
  và đồng bộ nhiều thiết bị (bố + mẹ cùng nhận cảnh báo).

### 6.2. Các module
```
app/
  ├─ screens/          Màn hình: Onboarding, Home, Trip, Alert, Contacts, Settings, History
  ├─ services/
  │    ├─ tripDetector    Phát hiện bắt đầu/kết thúc chuyến (BT, activity, thủ công)
  │    ├─ alertEngine      Máy trạng thái leo thang cảnh báo (T1→T2→T3)
  │    ├─ notifier         Chuông, rung, thông báo đẩy
  │    ├─ contactService   Gọi điện / gửi SMS (expo-linking, expo-sms)
  │    └─ storage          Đọc/ghi dữ liệu cục bộ
  ├─ state/            Store (hồ sơ bé, xe, liên hệ, cấu hình, trạng thái cảnh báo)
  └─ models/           Kiểu dữ liệu (Child, Vehicle, Contact, Trip, AlertEvent)
```

### 6.3. Mô hình dữ liệu (nháp)
```ts
Child     { id, name, ageMonths, photoUri?, note? }
Vehicle   { id, name, bluetoothId?, plate? }
Contact   { id, name, phone, priority, notifyBySms, notifyByCall }
Trip      { id, childId, vehicleId, startedAt, endedAt?, endReason }
AlertEvent{ id, tripId, level, firedAt, acknowledgedAt?, location? }
Settings  { t1Seconds, t2Seconds, t3Seconds, alarmSound, autoDetect }
```

### 6.4. Máy trạng thái cảnh báo (alertEngine)
```
IDLE ──trip.start──> RIDING ──trip.end──> CONFIRMING
CONFIRMING ──ack──> IDLE
CONFIRMING ──timeout(T1)──> ALARM_LOCAL
ALARM_LOCAL ──ack──> IDLE
ALARM_LOCAL ──timeout(T2)──> CALLING_CONTACTS
CALLING_CONTACTS ──ack──> IDLE
CALLING_CONTACTS ──timeout(T3)/no-answer──> ESCALATED
```

---

## 7. Màn hình (UI)

1. **Onboarding** — giới thiệu, xin quyền (thông báo, vị trí, Bluetooth, danh bạ).
2. **Home** — trạng thái hiện tại (đang ở nhà / đang chở bé / cảnh báo), nút thủ công.
3. **Trip** — thông tin chuyến đang diễn ra.
4. **Alert (toàn màn hình)** — nút to "TÔI ĐÃ ĐƯA BÉ RA", đồng hồ đếm ngược, chuông.
5. **Contacts** — quản lý liên hệ khẩn cấp, thứ tự ưu tiên, cách báo (gọi/SMS).
6. **Settings** — mốc thời gian, chọn xe/Bluetooth, âm báo, bật/tắt tự động phát hiện.
7. **History** — nhật ký chuyến & cảnh báo.

---

## 8. Quyền & thư viện (Expo)

| Chức năng | Thư viện dự kiến | Quyền |
|-----------|------------------|-------|
| Thông báo đẩy / báo động | `expo-notifications` | Notifications |
| Gọi điện | `expo-linking` (`tel:`) | — |
| Gửi SMS | `expo-sms` | SMS |
| Vị trí / geofence | `expo-location` + `expo-task-manager` | Location (Always) |
| Phát hiện chuyển động | `expo-sensors` / native activity recognition | Motion |
| Âm thanh báo động | `expo-av` | — |
| Lưu trữ | `@react-native-async-storage/async-storage` | — |
| Chạy nền | `expo-background-fetch` / `expo-task-manager` | Background |

> Lưu ý: một số tính năng nền (activity recognition liên tục, tự động gọi điện) bị giới
> hạn trên iOS. Prototype sẽ ưu tiên **thông báo + mở sẵn màn hình gọi** thay vì gọi
> hoàn toàn tự động, để tuân thủ chính sách nền tảng.

---

## 9. Rủi ro & hạn chế

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|--------|-----------|------------|
| Báo nhầm (bé không có trên xe) | Gây phiền, người dùng tắt app | Tinh chỉnh tín hiệu, cho tắt nhanh, học thói quen |
| Bỏ sót (không phát hiện) | Nguy hiểm tính mạng | Nhiều lớp tín hiệu, thiên về cảnh báo |
| Hết pin điện thoại | Mất bảo vệ | Cảnh báo pin yếu, khuyến nghị bổ sung phần cứng |
| Hạn chế chạy nền của iOS/Android | Cảnh báo trễ | Dùng push server (Phase 2), local notification |
| Gọi tự động bị OS chặn | Không gọi được | Mở sẵn màn hình gọi + SMS tự động |
| Người dùng không cấp quyền | Mất chức năng | Onboarding giải thích rõ lý do từng quyền |

---

## 10. Lộ trình (Roadmap)

> **Quyết định đã chốt (2026-07-02):**
> 1. **Nền tảng:** làm **cả hai (iOS + Android)** dùng chung một codebase Expo.
> 2. **Cách gọi:** **gọi & SMS tự động qua backend** (Twilio/Stringee) là mục tiêu.
>    Vì backend cần khoá API và không test đầy đủ được trong môi trường hiện tại,
>    prototype dùng **provider cắm-được (pluggable)**: một `MockProvider` để chạy thử
>    + đường dẫn tích hợp Twilio/Stringee đánh dấu rõ, và **fallback `tel:`/SMS** khi
>    chưa cấu hình backend.
> 3. **Tự động phát hiện:** đưa vào **ngay Phase 1** (Bluetooth xe + phát hiện lái xe),
>    kèm **chế độ mô phỏng** để chạy được trên Expo Go / simulator khi không có thiết bị.

**Phase 1 — Prototype phần mềm (gần như hoàn tất):**
- [x] Khởi tạo project Expo (TS), điều hướng, store, mô hình dữ liệu.
- [x] Onboarding + xin quyền.
- [x] Quản lý hồ sơ bé, xe, liên hệ khẩn cấp.
- [x] Bắt đầu/kết thúc chuyến: thủ công ✅ + tự động theo tốc độ GPS ✅ + mô phỏng ✅ +
      **Bluetooth Classic (Android, cần dev build)** ✅ (iOS dùng GPS/activity thay thế).
- [x] alertEngine (máy trạng thái leo thang) + chuông/rung/thông báo + màn hình đếm ngược.
      *(logic đã kiểm chứng end-to-end)*
- [x] Gọi/SMS người thân qua provider cắm-được: `mock` + `device` (tel:/SMS) ✅ và
      **backend thật** (`server/`, Twilio + Stringee, đã test bằng mock) ✅.
- [x] Nhật ký chuyến & cảnh báo.

> **Còn lại để "chạy thật" (cần tài nguyên của người dùng, không phải code):**
> - Điền khoá Twilio/Stringee + deploy `server/` để có cuộc gọi/SMS thật.
> - Tạo **dev build** (`expo prebuild` / EAS dev client) để Bluetooth Classic hoạt động
>   (không chạy trong Expo Go), và test trên **điện thoại Android + xe thật**.

**Phase 2 — Nâng cấp thực địa (đang làm):**
- [x] Backend đồng bộ nhiều thiết bị: `/register` + `/notify-family` gửi **push (Expo)**
      cho cả bố + mẹ; app đăng ký token theo **mã gia đình**. (đã test dry-run)
- [x] **Geofence địa điểm an toàn** (nhà/trường): model + Haversine + quản lý địa điểm,
      gắn **tên nơi đỗ** vào cảnh báo/SMS. (logic đã kiểm chứng)
- [x] **Học thói quen để giảm báo nhầm**: gom kết quả kết thúc chuyến theo ngữ cảnh
      (nơi đỗ + thứ + khung giờ), điều chỉnh **thời gian xác nhận** trong khoảng an toàn
      (nơi quen → dài hơn ↓báo nhầm; nơi từng leo thang → ngắn hơn ↑bảo vệ). **Không bao
      giờ tắt chuông/gọi.** (logic đã kiểm chứng)
- [x] iOS: phát hiện kết thúc chuyến bằng **Core Motion (automotive) + Visits**
      (`iosMotionDetector`, không cần CarPlay entitlement). Đã nối vào `tripDetector`;
      cần **dev build + native module** để chạy thật, no-op an toàn trong Expo Go.
- [ ] iOS CarPlay UI: bỏ (không phù hợp danh mục entitlement của Apple).

**Phase 3 — Khai thác cảm biến/dữ liệu có sẵn trên xe (phác thảo):**

> **Tiền đề:** KHÔNG thêm thiết bị cảm biến mới. Chỉ dùng **cảm biến & dữ liệu xe đã có
> sẵn** (trạng thái máy, cửa, đai an toàn, chiếm chỗ ghế, nhiệt độ cabin, khoá xe...),
> truy cập qua cổng/kênh sẵn có. Cách này rẻ, không phải lắp đặt, nhưng phụ thuộc **xe hỗ
> trợ tới đâu** và **kênh nào đọc được dữ liệu**.

**3.0. Chọn kênh truy cập dữ liệu xe (quyết định nền tảng)**
- [ ] **OBD-II dongle Bluetooth (ELM327)** cắm cổng OBD: đọc CAN — trạng thái máy (RPM/ignition),
      và tuỳ hãng: cửa, đai an toàn qua PID riêng. Rẻ, phổ biến, nhưng PID khác nhau theo hãng.
- [ ] **API xe kết nối (connected-car)**: qua **aggregator như Smartcar** hoặc API hãng
      (VinFast/Tesla/Hyundai Bluelink/Toyota...). Đọc trạng thái cửa, khoá, vị trí, nhiệt độ
      cabin (tuỳ hãng) từ đám mây — không cần thiết bị cắm. Cần OAuth tài khoản xe, phủ theo hãng.
- [ ] **Hệ thống sẵn có của xe**: "Rear Seat Reminder" (nhắc ghế sau dựa trên logic cửa) hoặc
      **phát hiện người trong cabin** (radar/camera) trên xe đời mới — dùng trực tiếp **nếu hãng
      cho phép đọc**.
- [ ] Chọn kênh chính + dự phòng theo mức phủ hãng xe ở Việt Nam.

**3.1. Dữ liệu xe khả dụng & ánh xạ tín hiệu**
- [ ] Liệt kê theo từng kênh/hãng: `ignition/engine`, `door_open` (từng cửa), `lock_state`,
      `seatbelt`, `seat_occupancy` (thường chỉ ghế phụ trước), `cabin_temperature`, `gear`,
      `location`, và `in-cabin presence` (nếu có).
- [ ] Xác định tín hiệu nào **đáng tin để phát hiện có bé** vs chỉ dùng để **suy luận** (nhiều
      xe KHÔNG có cảm biến chiếm chỗ ghế sau → phải dùng logic cửa).

**3.2. Logic phát hiện dựa trên dữ liệu sẵn có (không có cảm biến ghế sau)**
- [ ] **Mẫu "Rear Seat Reminder"** thuần logic cửa: nếu **cửa sau được mở** trước chuyến →
      "có thể đã đặt bé phía sau"; khi **kết thúc chuyến** (tắt máy + mở cửa lái) mà **cửa sau
      chưa mở lại** → **nhắc kiểm tra ghế sau**.
- [ ] Dùng **nhiệt độ cabin** (từ xe) để chỉnh độ khẩn (nhiệt tăng nhanh → báo sớm hơn).
- [ ] Nếu xe **có cảm biến chiếm chỗ / phát hiện người** và đọc được → dùng làm tín hiệu
      **chắc chắn** (leo thang mạnh, ít báo nhầm).

**3.3. Tích hợp (kiến trúc hiện tại đã sẵn điểm cắm)**
- [x] **App:** service `obdReader.ts` (BLE tới ELM327, guard an toàn + hàm mô phỏng) đọc
      trạng thái máy/cửa → nối vào `tripDetector` (`onVehicleEngineStart/Stop`, reason `obd`).
- [x] **Logic cửa** `rearSeatReminder.ts` (thuần, đã kiểm chứng): cửa sau mở lúc lên xe +
      tắt máy chưa mở lại → cờ **"nghi có bé ở ghế sau"**; store dùng cờ này để **không nới
      dài** thời gian xác nhận và hiện cảnh báo "KIỂM TRA GHẾ SAU" (thiên về cảnh báo).
- [x] Nút **mô phỏng OBD** trên màn hình chính để test luồng không cần dongle/xe.
- [x] **Hợp nhất tín hiệu** `presenceModel.ts` (đã kiểm chứng): kết hợp **cảm biến chiếm chỗ
      ghế sau** (nếu có, đáng tin nhất), **đai an toàn ghế sau**, **logic cửa**, và **hồ sơ bé
      trên chuyến** → điểm khả năng có bé + mức (low/medium/high) + lý do. **Nhiệt độ cabin**
      dùng để rút ngắn thời gian xác nhận (nóng → báo sớm). Chỉ **hạ mức** khi cảm biến chiếm
      chỗ báo ghế TRỐNG; còn lại luôn thiên về cảnh báo.
- [x] **Tín hiệu điện thoại** `driverAwayDetector.ts`: **Pedometer** (đi bộ rời xe) + hook
      **RSSI** Bluetooth (rời xa xe) → khi nghi còn bé mà tài xế đã rời xe thì **leo thang sớm**
      (`engine.hastenConfirm`). Có nút mô phỏng.
- [x] **Nhiệt độ cabin** rút ngắn thời gian xác nhận (`confirmCapForTemp`).
- [x] **Server:** tích hợp **Smartcar** (`server/src/vehicle/`): `/vehicle/auth-url`,
      `/vehicle/exchange`, `/vehicle/state` (vị trí/odometer/khoá; provider `mock` để test —
      đã PASS). Lưu ý: Smartcar KHÔNG cấp sự kiện cửa/đai/chiếm chỗ → bổ trợ ngữ cảnh, còn
      phát hiện kết thúc chuyến vẫn dựa OBD.
- [x] **Màn hình Kết nối xe** (`VehicleScreen`, tab "Xe"): lấy link liên kết Smartcar, đổi
      code, đọc trạng thái xe; hướng dẫn ghép OBD dongle.
- [x] App **đọc `/vehicle/state`**: dùng **nhiệt độ cabin** (ưu tiên OBD, fallback Smartcar) và
      **vị trí xe** (fallback khi thiếu GPS điện thoại) trong `beginConfirm`.
- [x] **RSSI**: `obdReader.onCarRssi()` → khi rời xa xe gọi `driverAwayDetector` (có mô phỏng).
- [x] **Bảo mật/refresh:** token xe **mã hoá AES-256-GCM** khi lưu; **tự refresh** token
      Smartcar khi hết hạn (đã test bằng mock).
- [ ] Hoàn thiện **parse CAN theo hãng** trong `obdReader` + **đọc RSSI BLE thật** (cần dongle).

**3.4. Hạn chế & an toàn (quan trọng với tiền đề này)**
- [ ] Đa số xe **không expose cảm biến ghế sau** → logic cửa chỉ là **NHẮC**, không phải phát
      hiện chắc chắn → luôn **thiên về cảnh báo** (thà nhắc còn hơn bỏ sót).
- [ ] **Độ trễ/độ phủ:** API hãng có độ trễ & chỉ hỗ trợ một số hãng; PID OBD khác nhau.
- [ ] **Nguồn điện:** dongle OBD cắm liên tục có thể hao ắc-quy khi xe tắt máy lâu.
- [ ] **Bảo mật/riêng tư:** token OAuth tài khoản xe và dữ liệu vị trí phải được bảo vệ.

**3.5. Kiểm thử**
- [ ] Thử theo **từng hãng xe** (độ phủ tín hiệu khác nhau) và **từng loại dongle** OBD.
- [ ] Kịch bản mất kết nối OBD/API, xe tắt máy lâu, nhiều cửa mở/đóng.

> Ghi chú: đây là **kế hoạch/phác thảo**. Phần code-được-ngay là **app**: `obdReader.ts`
> (mock BLE để test) và cờ "nghi có bé ghế sau" cho `alertEngine`. Phần API hãng cần **tài
> khoản xe kết nối + phủ hãng**, và OBD cần **dongle thật + xe** để kiểm thử.

---

## 11. Câu hỏi còn mở (không chặn Phase 1)

- **Ngôn ngữ UI:** prototype làm **tiếng Việt** trước; có thể thêm song ngữ sau.
- **Tên & thương hiệu:** tạm dùng **"AnToànBé"**, đổi sau nếu cần.
- **Nhà cung cấp backend:** Twilio (quốc tế) hay Stringee (Việt Nam) — chốt khi lên Phase 2;
  code Phase 1 để cả hai cùng cắm vào chung một interface.

---

*Các quyết định chính đã chốt ở Mục 10. Đang hiện thực Phase 1 trong thư mục `app/`.*
