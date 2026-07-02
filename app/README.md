# KidGuard — App cảnh báo quên trẻ trên ô tô

> Tên hiển thị Play Store đề xuất: **KidGuard – Cảnh báo trẻ trên xe**.

Ứng dụng di động (Expo / React Native, chạy cả **iOS & Android**) giúp cảnh báo khi
có nguy cơ bỏ quên trẻ nhỏ trên ô tô. Khi kết thúc chuyến đi mà bố/mẹ không xác nhận đã
đưa bé ra, app sẽ **báo động → gọi & nhắn tin cho người thân kèm vị trí xe**.

> Xem tài liệu thiết kế đầy đủ ở [`../DESIGN.md`](../DESIGN.md).

## Chạy thử

```bash
cd car-child-alert/app
npm install
npm start          # rồi mở bằng Expo Go (quét QR) hoặc:
npm run android    # / npm run ios
```

Yêu cầu: Node 18+, [Expo CLI](https://docs.expo.dev/) (đi kèm khi `npm install`),
và app **Expo Go** trên điện thoại (hoặc simulator/emulator).

## Cách test luồng cảnh báo (không cần thiết bị thật)

1. Mở app → qua bước Onboarding (cấp quyền thông báo/vị trí).
2. Tab **Cài đặt**: thêm 1 **bé**. Có thể chỉnh T1/T2/T3 xuống ~5–10s cho nhanh.
3. Tab **Liên hệ**: thêm ít nhất 1 số điện thoại khẩn cấp.
4. Tab **Trang chủ**: bấm **“Bắt đầu chở bé”** → rồi **“Mô phỏng: quên bé trên xe”**.
5. Màn hình cảnh báo hiện ra, đếm ngược → nếu không bấm **“TÔI ĐÃ ĐƯA BÉ RA”** sẽ
   leo thang: báo động (chuông/rung) → gọi/SMS người thân → khẩn cấp.

Ở chế độ mặc định, việc gọi/SMS dùng **provider `mock`** (chỉ ghi log ra console, không
gọi/nhắn thật) để test an toàn.

## Cấu trúc

```
app/
├─ App.tsx                     Điều hướng (tab) + overlay cảnh báo
├─ src/
│  ├─ models/                  Kiểu dữ liệu (Child, Vehicle, Contact, Trip, AlertEvent, Settings)
│  ├─ state/store.tsx          Store trung tâm (dữ liệu + runtime + nối engine/detector)
│  ├─ services/
│  │  ├─ alertEngine.ts        Máy trạng thái leo thang cảnh báo (T1→T2→T3)
│  │  ├─ tripDetector.ts       Phát hiện bắt đầu/kết thúc chuyến (thủ công/activity/BT/mô phỏng)
│  │  ├─ notifier.ts           Chuông + rung + thông báo đẩy
│  │  ├─ location.ts           Vị trí GPS + link Google Maps
│  │  ├─ storage.ts            Lưu trữ cục bộ (AsyncStorage)
│  │  └─ contact/              Gọi & SMS qua provider cắm-được
│  │     ├─ types.ts           Interface AlertProvider
│  │     ├─ mockProvider.ts    Giả lập (chạy thử)
│  │     ├─ deviceProvider.ts  Mở màn hình gọi tel: / SMS trên máy (fallback)
│  │     ├─ backendProvider.ts Gọi/SMS tự động qua backend (Twilio/Stringee)
│  │     └─ index.ts           Điều phối & chọn provider
│  ├─ screens/                 Onboarding, Home, Contacts, Settings, History, AlertOverlay
│  └─ components/ui.tsx        Thành phần UI dùng chung
```

## Gọi & SMS tự động qua backend (Twilio / Stringee)

⚠️ **KHÔNG** đặt khoá bí mật Twilio/Stringee trong app di động — sẽ bị lộ. Hãy dựng một
backend nhỏ giữ khoá, app chỉ gọi tới đó. Backend cần 2 route:

```
POST {baseUrl}/call  body: { to, name, message, location }
POST {baseUrl}/sms   body: { to, name, message, location }
```

Rồi cấu hình trong `src/state/store.tsx` (chỗ nạp dữ liệu ban đầu):

```ts
contactService.configureBackend({ baseUrl: 'https://your-server/api/alert', apiKey: '...' });
contactService.setProvider('backend'); // thay cho 'mock'
```

Xem `src/services/contact/backendProvider.ts` để biết chi tiết interface.

> **Không muốn tốn cước?** Server còn có provider **`telegram`** (miễn phí): đặt
> `PROVIDER=telegram` + `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` trong `../server/.env`, cảnh
> báo sẽ gửi vào group Telegram của bố mẹ. App không cần đổi gì (vẫn gọi `/call` `/sms`).

## Bluetooth xe thật (Android) — cần dev build

Phát hiện tự động khi bạn **xuống xe** dựa trên việc điện thoại **ngắt kết nối Bluetooth**
với head-unit của xe. Vì đây là native module (`react-native-bluetooth-classic`), app
**không chạy trong Expo Go** khi bật tính năng này — phải tạo **dev build**:

```bash
cd car-child-alert/app
npm install
npx expo prebuild                 # sinh thư mục android/ (và ios/)
npx expo run:android              # cài lên máy Android thật
```

Sau đó vào **Cài đặt → Xe**, nhập **tên/địa chỉ Bluetooth** của xe (vd "Car Multimedia"
hoặc `00:11:22:33:44:55`) để app biết thiết bị nào là xe.

- **Android:** nghe sự kiện kết nối/ngắt Bluetooth Classic (rảnh tay) của xe.
- **iOS:** hệ điều hành không cho app thấy kết nối/ngắt của loa xe thường (giới hạn MFi).
  Thay vào đó iOS dùng **`iosMotionDetector`** (Core Motion *automotive* + Visits) để phát
  hiện "vừa xuống xe" — **không cần CarPlay entitlement** — cộng **tốc độ GPS** và nút mô
  phỏng. Phần Core Motion/Visits cần **dev build + native module** (xem dưới); nếu không có,
  tự bỏ qua an toàn.

### iOS: Core Motion + Visits (thay cho CarPlay)

`src/services/iosMotionDetector.ts` phát hiện kết thúc chuyến bằng API iOS gốc:
- **Core Motion** (`CMMotionActivityManager`): `automotive → stationary/walking` = xuống xe.
- **Visits** (`startMonitoringVisits`): xác nhận "vừa đỗ tại một nơi".

Cần **dev build** và một **native module** cầu nối Core Motion/Visits sang JS (interface kỳ
vọng ghi trong đầu file `iosMotionDetector.ts`). Quyền: **Motion & Fitness** + **Location
(Always)** — đã khai báo trong `app.json` (`NSMotionUsageDescription`, background location).
Lưu ý: các tín hiệu này có **độ trễ** (Core Motion vài chục giây; Visits vài phút) nên dùng
kèm GPS + nút thủ công; đáng tin cậy nhất vẫn là phần cứng (Phase 3).
- Nếu chạy trong Expo Go (không có module), phần Bluetooth **tự bỏ qua an toàn**, app vẫn
  chạy bình thường với GPS/activity + mô phỏng.

## Phase 2 — Đồng bộ bố + mẹ & địa điểm an toàn

- **Cảnh báo cả bố + mẹ:** vào **Cài đặt → Gia đình**, nhập **cùng một mã gia đình** trên
  điện thoại của bố và mẹ. Khi một máy bắt đầu báo động, máy kia nhận **thông báo đẩy** ngay.
  (Cần đã cấu hình backend — xem phần dưới.)
- **Địa điểm an toàn:** vào **Cài đặt → Địa điểm an toàn**, đặt tên (Nhà/Trường) và lưu
  vị trí hiện tại. Cảnh báo/SMS sẽ ghi **tên nơi đỗ** thay vì chỉ toạ độ.
- **Học thói quen (giảm báo nhầm):** app ghi nhận nơi/giờ bạn hay kết thúc chuyến và cách
  bạn xử lý (xác nhận ngay hay để báo động). Nơi bạn **thường xuống xe an toàn** → app
  **nới dài** thời gian xác nhận (ít báo nhầm hơn); nơi từng **để leo thang** → **rút ngắn**
  để bảo vệ nhanh hơn. Có giới hạn min/max và **không bao giờ tắt chuông/gọi**. Bật/tắt ở
  **Cài đặt → Cảnh báo → Học thói quen**.

Đồng bộ đa thiết bị dùng **Expo push** qua backend (`../server/`: `/register`,
`/notify-family`). Push token lấy tự động khi có mã gia đình + backend đã cấu hình.

- **Kết nối xe (tab "Xe"):** liên kết tài khoản xe qua **Smartcar** (lấy link → dán code →
  đọc trạng thái) và hướng dẫn ghép **OBD dongle**. App đọc `/vehicle/state` để lấy **nhiệt
  độ cabin** (ưu tiên OBD, fallback Smartcar) và **vị trí xe** (fallback khi thiếu GPS), đưa
  vào đánh giá cảnh báo. Token xe được **mã hoá** và **tự refresh** ở server.

## Phase 3 (bắt đầu) — dùng dữ liệu sẵn có của xe

Không thêm cảm biến mới; đọc trạng thái xe qua **OBD-II dongle Bluetooth (ELM327)**:
- `src/services/obdReader.ts` — đọc trạng thái **máy** (nổ/tắt) và **cửa** qua BLE (cần dev
  build + `react-native-ble-plx`); **no-op an toàn trong Expo Go** và có hàm **mô phỏng**.
- `src/services/rearSeatReminder.ts` — logic **"nhắc ghế sau"** thuần: nếu **cửa sau mở** lúc
  lên xe và **tắt máy chưa mở lại** → nghi **còn bé ở ghế sau** → app **không nới dài** thời
  gian xác nhận và hiện cảnh báo **"KIỂM TRA GHẾ SAU"**.

- `src/services/presenceModel.ts` — **hợp nhất nhiều tín hiệu** để tăng chính xác: cảm biến
  chiếm chỗ ghế sau (nếu xe có, đáng tin nhất), **đai an toàn ghế sau**, logic cửa, và hồ sơ
  bé trên chuyến → điểm khả năng có bé (low/medium/high). **Nhiệt độ cabin** rút ngắn thời
  gian xác nhận khi nóng. Chỉ hạ mức khi cảm biến ghế sau báo TRỐNG; còn lại thiên về cảnh báo.

- `src/services/driverAwayDetector.ts` — **tín hiệu điện thoại**: **Pedometer** (expo-sensors,
  chạy thật) phát hiện tài xế đi bộ rời xe, và hook **RSSI** Bluetooth (rời xa xe). Khi **nghi
  còn bé** mà **tài xế đã rời xe** → app **leo thang sớm** (rút countdown còn ~10s).

**Thử không cần dongle:** ở **Trang chủ → OBD (thử nghiệm)** bấm lần lượt *Nổ máy → Mở cửa
sau → (Cài đai / Nhiệt độ 40°C) → Tắt máy → (Tài xế rời xe)*; màn hình cảnh báo hiện mức nghi
ngờ, lý do và trạng thái "tài xế đã rời xe".

> Thư viện native cho dev build (tự cài khi prebuild, không nằm trong `package.json` vì được
> nạp động): `react-native-bluetooth-classic` (Android BT), `react-native-ble-plx` (OBD BLE).

Còn lại (cần tài nguyên thật): hoàn thiện parse CAN theo hãng trong `obdReader` (cần dongle),
và/hoặc tích hợp **API xe kết nối** (Smartcar/API hãng) ở server để đọc cửa/nhiệt độ cabin.

## ✅ Việc cần làm (Phase 1 · 2 · 3)

> **Trạng thái chung:** toàn bộ **phần code của Phase 1–3 đã xong** và chạy được ở chế độ
> mô phỏng (typecheck app xanh, test server PASS). Các mục `[ ]` dưới đây là việc **còn lại
> để chạy thật**, đa số **cần thiết bị/tài khoản/kiểm thử vật lý của bạn**, không phải thiếu code.

### Phase 1 — Prototype cảnh báo (đã code xong)
- [x] Onboarding, hồ sơ bé/xe, liên hệ khẩn cấp, máy trạng thái leo thang, chuông/rung/thông
      báo, màn hình đếm ngược, nhật ký, gọi/SMS qua provider cắm-được (`mock`/`device`/backend).
- [ ] **Cuộc gọi/SMS thật:**
  - [ ] Tạo tài khoản **Twilio** hoặc **Stringee**, lấy khoá + số gửi đi.
  - [ ] Điền `../server/.env` (theo `.env.example`), đặt `PROVIDER=twilio|stringee`.
  - [ ] **Deploy** `../server/` (Render / Railway / Fly / Cloud Run...), lấy URL công khai.
  - [ ] Trong `src/state/store.tsx`: `contactService.configureBackend({ baseUrl, apiKey })`
        + `contactService.setProvider('backend')`.
- [ ] **Kiểm thử thiết bị thật:** chạy end-to-end với số điện thoại thật (chỉnh T1/T2/T3 ngắn),
      kiểm tra khi app chạy nền / màn hình khoá.

### Phase 2 — Đồng bộ bố+mẹ, geofence, học thói quen (đã code xong)
- [x] Đồng bộ đa thiết bị (Expo push, mã gia đình), địa điểm an toàn (geofence), học thói quen
      giảm báo nhầm, iOS Core Motion/Visits.
- [ ] **Bật đồng bộ bố+mẹ thật:** deploy `../server/` (như trên) để `/register` + `/notify-family`
      hoạt động; hai máy nhập cùng **Mã gia đình** (Cài đặt → Gia đình).
- [ ] **iOS Core Motion/Visits chạy thật:** tạo **dev build** + native module cầu nối Core
      Motion/Visits (interface ghi trong `src/services/iosMotionDetector.ts`); test trên iPhone thật.

### Phase 3 — Dùng cảm biến sẵn có của xe (đã code xong nhóm A)
- [x] `obdReader` (máy/cửa/đai/chiếm chỗ/nhiệt độ + mô phỏng), logic nhắc ghế sau
      (`rearSeatReminder`), hợp nhất tín hiệu (`presenceModel`), tín hiệu điện thoại
      (`driverAwayDetector`: pedometer + RSSI), màn hình **Kết nối xe**, server **Smartcar**
      (mã hoá token + tự refresh).
- [ ] **OBD thật:** tạo **dev build**, cài `react-native-ble-plx`, và **hiệu chỉnh PID CAN theo
      từng hãng** trong `obdReader` (đọc RSSI BLE thật + trạng thái máy/cửa) — cần **dongle ELM327 + xe**.
- [ ] **Bluetooth Android thật:** `npx expo prebuild && npx expo run:android`, cài
      `react-native-bluetooth-classic`, nhập tên/địa chỉ BT xe (Cài đặt → Xe), thử chuyến thật.
- [ ] **Smartcar thật:** tạo tài khoản Smartcar, điền `SMARTCAR_*` trong `../server/.env`
      (`VEHICLE_PROVIDER=smartcar`, `TOKEN_ENC_KEY`), liên kết xe ở tab **Xe** và kiểm chứng độ phủ theo hãng.
- [ ] **Thử thực địa & quyết định:** kiểm thử từng hãng xe/dongle, kịch bản mất kết nối/hao ắc-quy;
      chốt kênh chính cho thị trường VN; chính sách riêng tư dữ liệu vị trí/xe.

### Ghi chú kỹ thuật
- Thư viện native cho **dev build** (được nạp động, không nằm trong `package.json`):
  `react-native-bluetooth-classic` (Android BT), `react-native-ble-plx` (OBD BLE).
- Provider gọi/SMS mặc định là **mock**; các phần Bluetooth/OBD/iOS-motion **tự bỏ qua an toàn**
  trong Expo Go và chạy được nhờ **nút mô phỏng** (Trang chủ). Đáng tin cậy nhất về lâu dài vẫn
  là cảm biến chuyên dụng của xe.

> Chi tiết đầy đủ theo từng mục nhỏ: xem checklist trong [`../DESIGN.md`](../DESIGN.md) (Mục 10).
