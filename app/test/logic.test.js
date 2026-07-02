/*
 * Test logic cốt lõi của KidGuard (an toàn tính mạng — cần chính xác).
 * Chạy trên logic đã compile ra CommonJS (test/build) để không phụ thuộc React Native.
 *   npm test  →  tsc -p test/tsconfig.build.json && node test/logic.test.js
 */
const assert = require('assert');

const { AlertEngine } = require('./build/services/alertEngine.js');
const habit = require('./build/services/habitModel.js');
const presence = require('./build/services/presenceModel.js');
const geo = require('./build/services/geofence.js');
const { RearSeatReminder } = require('./build/services/rearSeatReminder.js');

// ---- harness tối giản ----
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Settings thời lượng ngắn (giây) để test nhanh với timer thật.
const S = 0.05; // 50ms
function settings(over = {}) {
  return {
    t1Seconds: S,
    t2Seconds: S,
    t3Seconds: S,
    autoDetect: false,
    alarmSound: true,
    attachLocation: false,
    adaptiveConfirm: true,
    ...over,
  };
}
function contact(name, priority, over = {}) {
  return { id: name, name, phone: '0900', priority, notifyBySms: false, notifyByCall: false, ...over };
}
function makeHooks() {
  const h = {
    states: [],
    alarms: 0,
    stops: 0,
    log: [],
    onState: (s) => h.states.push(s),
    startAlarm: () => { h.alarms += 1; },
    stopAlarm: () => { h.stops += 1; },
    call: async (c) => { h.log.push('call:' + c.name); return true; },
    sms: async (c) => { h.log.push('sms:' + c.name); return true; },
  };
  return h;
}

// ================= alertEngine =================

test('confirming → acknowledge trước T1 → KHÔNG bao giờ báo động', async () => {
  const h = makeHooks();
  const e = new AlertEngine(h, settings());
  await e.armConfirm([contact('P1', 1)], { confirmSeconds: S });
  await delay(20);
  e.acknowledge();
  await delay(120);
  assert.strictEqual(e.getState(), 'idle');
  assert.strictEqual(h.alarms, 0, 'không được phát chuông');
  assert.ok(h.states.includes('confirming'));
});

test('không xác nhận → hết T1 → alarm_local + phát chuông; acknowledge → tắt chuông', async () => {
  const h = makeHooks();
  const e = new AlertEngine(h, settings({ t2Seconds: 0.4 }));
  await e.armConfirm([contact('P1', 1)], { confirmSeconds: S });
  await delay(150);
  assert.strictEqual(e.getState(), 'alarm_local');
  assert.strictEqual(h.alarms, 1, 'phải phát chuông đúng 1 lần');
  e.acknowledge();
  assert.strictEqual(e.getState(), 'idle');
  assert.ok(h.stops >= 1, 'phải tắt chuông');
});

test('leo thang đầy đủ: gọi người thân theo đúng thứ tự ưu tiên rồi escalated', async () => {
  const h = makeHooks();
  const e = new AlertEngine(h, settings());
  // Truyền lộn xộn để kiểm tra sắp xếp: P2 trước P1.
  const contacts = [
    contact('P2', 2, { notifyBySms: true, notifyByCall: true }),
    contact('P1', 1, { notifyByCall: true }),
  ];
  await e.armConfirm(contacts, { confirmSeconds: S });
  await delay(400);
  assert.strictEqual(e.getState(), 'escalated');
  // P1 (ưu tiên 1, chỉ gọi) trước, rồi P2 (sms + gọi).
  assert.deepStrictEqual(h.log, ['call:P1', 'sms:P2', 'call:P2']);
  assert.ok(h.states.includes('calling_contacts'));
  assert.ok(h.states.includes('escalated'));
});

test('hastenConfirm rút ngắn thời gian xác nhận', async () => {
  const h = makeHooks();
  const e = new AlertEngine(h, settings({ t2Seconds: 0.4 }));
  await e.armConfirm([contact('P1', 1)], { confirmSeconds: 1 }); // 1000ms
  e.hastenConfirm(S); // rút còn 50ms
  await delay(150);
  assert.strictEqual(e.getState(), 'alarm_local', 'phải báo động sớm sau khi rút ngắn');
  assert.strictEqual(h.alarms, 1);
  e.acknowledge();
});

test('acknowledge trong lúc đang gửi SMS → KHÔNG thực hiện cuộc gọi tiếp theo', async () => {
  const h = makeHooks();
  const e = new AlertEngine(h, settings({ t3Seconds: 0.5 }));
  let smsCalls = 0;
  let phoneCalls = 0;
  h.sms = async () => { smsCalls += 1; e.acknowledge(); return true; };
  h.call = async () => { phoneCalls += 1; return true; };
  await e.armConfirm([contact('P1', 1, { notifyBySms: true, notifyByCall: true })], { confirmSeconds: S });
  await delay(200);
  assert.strictEqual(smsCalls, 1, 'SMS gửi 1 lần');
  assert.strictEqual(phoneCalls, 0, 'KHÔNG được gọi sau khi đã xác nhận');
  assert.strictEqual(e.getState(), 'idle');
});

// ================= habitModel =================

test('contextKey đúng định dạng nơi|thứ|khung-giờ', () => {
  const d = new Date(2026, 0, 5, 10, 0); // Thứ Hai, 10h → w1, h3
  assert.strictEqual(habit.contextKey('home', d), 'home|w1|h3');
  assert.strictEqual(habit.contextKey(undefined, d), 'other|w1|h3');
});

test('routineScore & isRoutine', () => {
  assert.strictEqual(habit.routineScore(undefined), 0.5);
  assert.strictEqual(habit.routineScore({ acks: 3, escalations: 1, lastSeen: 0 }), 0.75);
  assert.strictEqual(habit.isRoutine({ acks: 3, escalations: 0, lastSeen: 0 }), true);
  assert.strictEqual(habit.isRoutine({ acks: 1, escalations: 1, lastSeen: 0 }), false); // chưa đủ mẫu
});

test('adjustConfirmSeconds: kẹp min/max & cần đủ mẫu, không tắt bước nào', () => {
  assert.strictEqual(habit.adjustConfirmSeconds(60, undefined), 60); // thiếu mẫu → giữ nguyên
  assert.strictEqual(habit.adjustConfirmSeconds(60, { acks: 4, escalations: 0, lastSeen: 0 }), 90); // ×1.5
  assert.strictEqual(habit.adjustConfirmSeconds(60, { acks: 0, escalations: 4, lastSeen: 0 }), 30); // ×0.5
  assert.strictEqual(habit.adjustConfirmSeconds(60, { acks: 2, escalations: 2, lastSeen: 0 }), 60); // ×1.0
  assert.strictEqual(habit.adjustConfirmSeconds(10, { acks: 0, escalations: 5, lastSeen: 0 }), 15); // sàn 15s
});

test('recordOutcome không đột biến bản ghi cũ', () => {
  const before = { acks: 1, escalations: 0, lastSeen: 111 };
  const after = habit.recordOutcome(before, 'escalation');
  assert.strictEqual(after.acks, 1);
  assert.strictEqual(after.escalations, 1);
  assert.strictEqual(before.escalations, 0, 'bản ghi cũ phải nguyên vẹn');
  const fresh = habit.recordOutcome(undefined, 'ack');
  assert.strictEqual(fresh.acks, 1);
});

// ================= presenceModel =================

test('assessChildPresence: cảm biến chiếm chỗ quyết định', () => {
  assert.strictEqual(presence.assessChildPresence({ rearOccupancy: true }).level, 'high');
  const empty = presence.assessChildPresence({ rearOccupancy: false });
  assert.strictEqual(empty.level, 'low');
  assert.ok(empty.likelihood <= 0.1);
});

test('assessChildPresence: hợp nhất trọng số & ngưỡng mức', () => {
  // đai(0.5)+cửa(0.35)+hồ sơ(0.4) = 1.25 → kẹp 1 → high
  const all = presence.assessChildPresence({
    rearSeatbeltBuckled: true, rearDoorSuspect: true, childRegisteredAboard: true,
  });
  assert.strictEqual(all.level, 'high');
  assert.strictEqual(all.likelihood, 1);
  // chỉ cửa (0.35) → medium
  assert.strictEqual(presence.assessChildPresence({ rearDoorSuspect: true }).level, 'medium');
  // không gì → low
  assert.strictEqual(presence.assessChildPresence({}).level, 'low');
});

test('confirmCapForTemp: càng nóng càng rút ngắn, không nới dài', () => {
  assert.strictEqual(presence.confirmCapForTemp(60, undefined), 60);
  assert.strictEqual(presence.confirmCapForTemp(60, 40), 15); // rất nóng
  assert.strictEqual(presence.confirmCapForTemp(60, 33), 30); // nóng
  assert.strictEqual(presence.confirmCapForTemp(60, 25), 60); // mát → giữ
  assert.strictEqual(presence.confirmCapForTemp(10, 40), 10); // không làm dài hơn base
});

// ================= geofence =================

test('distanceMeters & isWithin', () => {
  const a = { latitude: 0, longitude: 0 };
  assert.strictEqual(geo.distanceMeters(a, a), 0);
  // 1 độ kinh tuyến tại xích đạo ≈ 111.19 km
  const d = geo.distanceMeters(a, { latitude: 0, longitude: 1 });
  assert.ok(Math.abs(d - 111195) < 500, 'khoảng cách 1° ~111km, được ' + d);
  const place = { id: 'home', name: 'Nhà', latitude: 10, longitude: 10, radiusMeters: 150 };
  assert.strictEqual(geo.isWithin({ latitude: 10, longitude: 10 }, place), true);
  assert.strictEqual(geo.isWithin({ latitude: 11, longitude: 11 }, place), false);
});

test('findPlace & placeLabelFor', () => {
  const places = [{ id: 'home', name: 'Nhà', latitude: 10, longitude: 10, radiusMeters: 150 }];
  assert.strictEqual(geo.placeLabelFor({ latitude: 10, longitude: 10 }, places), 'Nhà');
  assert.strictEqual(geo.findPlace(undefined, places), undefined);
  assert.strictEqual(geo.placeLabelFor({ latitude: 20, longitude: 20 }, places), undefined);
});

// ================= rearSeatReminder =================

test('nghi ghế sau: cửa sau mở lúc lên xe, tắt máy chưa mở lại → nghi ngờ', () => {
  const r = new RearSeatReminder();
  r.onTripStart();
  r.onDoorEvent(true, true); // mở cửa sau khi lên xe
  r.onIgnitionOff();
  assert.strictEqual(r.evaluate(), true);
  assert.strictEqual(r.finish(), true);
});

test('không nghi: mở lại cửa sau sau khi tắt máy (đã lấy bé ra)', () => {
  const r = new RearSeatReminder();
  r.onTripStart();
  r.onDoorEvent(true, true);
  r.onIgnitionOff();
  r.onDoorEvent(true, true); // mở lại cửa sau sau khi tắt máy
  assert.strictEqual(r.evaluate(), false);
});

test('không nghi: chỉ mở cửa trước / không mở cửa sau', () => {
  const r1 = new RearSeatReminder();
  r1.onTripStart();
  r1.onIgnitionOff();
  assert.strictEqual(r1.evaluate(), false);
  const r2 = new RearSeatReminder();
  r2.onTripStart();
  r2.onDoorEvent(false, true); // cửa trước → bỏ qua
  r2.onIgnitionOff();
  assert.strictEqual(r2.evaluate(), false);
});

// ---- chạy tuần tự ----
(async () => {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✓ ' + t.name);
      pass += 1;
    } catch (e) {
      console.error('  ✗ ' + t.name + '\n      ' + (e && e.message));
      fail += 1;
    }
  }
  console.log(`\n${pass} pass, ${fail} fail`);
  if (fail > 0) {
    console.error('❌ Có test THẤT BẠI.');
    process.exit(1);
  }
  console.log('✅ Tất cả test logic cảnh báo đều PASS.');
})();
