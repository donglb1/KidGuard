import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  AppData,
  AlertEvent,
  AlertLevel,
  Child,
  Contact,
  GeoPoint,
  SafePlace,
  Settings,
  Trip,
  TripEndReason,
  Vehicle,
  emptyData,
  defaultSettings,
} from '@/models';
import { loadData, saveData, newId } from '@/services/storage';
import { AlertEngine, EngineState } from '@/services/alertEngine';
import { tripDetector } from '@/services/tripDetector';
import { startBluetoothDetection, stopBluetoothDetection } from '@/services/bluetoothClassic';
import { startIosMotionDetection, stopIosMotionDetection } from '@/services/iosMotionDetector';
import { obdReader } from '@/services/obdReader';
import { rearSeatReminder } from '@/services/rearSeatReminder';
import { assessChildPresence, confirmCapForTemp } from '@/services/presenceModel';
import { driverAwayDetector } from '@/services/driverAwayDetector';
import { contactService } from '@/services/contact';
import { getCurrentLocation } from '@/services/location';
import {
  startAlarm as fireAlarm,
  stopAlarm as silenceAlarm,
  pushLocalNotification,
  getExpoPushToken,
} from '@/services/notifier';
import { placeLabelFor, findPlace } from '@/services/geofence';
import {
  contextKey,
  adjustConfirmSeconds,
  recordOutcome,
  isRoutine,
} from '@/services/habitModel';

interface StoreValue {
  data: AppData;
  ready: boolean;
  engineState: EngineState;
  activeTrip: Trip | null;
  /** Thời gian xác nhận (giây) hiệu lực cho lần cảnh báo hiện tại. */
  confirmSeconds: number;
  /** Ngữ cảnh hiện tại có "quen thuộc" (để hiện gợi ý) không. */
  isRoutineContext: boolean;
  /** Nghi ngờ còn bé trên xe (hợp nhất tín hiệu) cho lần cảnh báo hiện tại. */
  suspectRearSeat: boolean;
  /** Các lý do dẫn tới nghi ngờ (để hiển thị). */
  presenceReasons: string[];
  /** Điện thoại xác nhận tài xế đã rời xe (tín hiệu leo thang sớm). */
  driverAway: boolean;
  // Hồ sơ
  addChild: (c: Omit<Child, 'id'>) => void;
  removeChild: (id: string) => void;
  addVehicle: (v: Omit<Vehicle, 'id'>) => void;
  removeVehicle: (id: string) => void;
  addContact: (c: Omit<Contact, 'id'>) => void;
  updateContact: (c: Contact) => void;
  removeContact: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  addPlace: (name: string) => Promise<boolean>;
  removePlace: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  // Chuyến & cảnh báo
  startTrip: () => void;
  endTripManually: () => void;
  simulateTripEnd: () => void;
  acknowledge: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  // Thời gian xác nhận hiệu lực (đã áp học thói quen) + gợi ý ngữ cảnh quen thuộc.
  const [confirmSeconds, setConfirmSeconds] = useState<number>(defaultSettings.t1Seconds);
  const [isRoutineContext, setIsRoutineContext] = useState(false);
  const [suspectRearSeat, setSuspectRearSeat] = useState(false);
  const [presenceReasons, setPresenceReasons] = useState<string[]>([]);
  const [driverAway, setDriverAway] = useState(false);
  const suspectRearSeatRef = useRef(false);
  // Trạng thái xe mới nhất từ OBD (đặt lại theo từng chuyến với đai/chiếm chỗ).
  const rearSeatbeltRef = useRef(false);
  const rearOccupancyRef = useRef<boolean | undefined>(undefined);
  const cabinTempRef = useRef<number | undefined>(undefined);

  // Dùng ref để hooks của engine luôn thấy dữ liệu mới nhất mà không tạo lại engine.
  const dataRef = useRef(data);
  dataRef.current = data;
  // activeTripRef được cập nhật ĐỒNG BỘ trong listener (không chờ re-render),
  // để chuỗi start→end đồng bộ (vd nút mô phỏng) vẫn kích hoạt được engine.
  const activeTripRef = useRef<Trip | null>(null);

  const setTrip = useCallback((t: Trip | null) => {
    activeTripRef.current = t;
    setActiveTrip(t);
  }, []);

  const engineRef = useRef<AlertEngine | null>(null);
  const pushTokenRef = useRef<string | undefined>(undefined);
  // Khoá ngữ cảnh của lần cảnh báo hiện tại (để ghi nhận thói quen khi kết thúc).
  const currentContextRef = useRef<string | null>(null);
  // Đảm bảo mỗi chuyến chỉ ghi nhận thói quen một lần.
  const outcomeRecordedRef = useRef(false);
  // Ref tới hàm ghi thói quen, để engine (khởi tạo sớm) gọi được hàm định nghĩa sau.
  const recordHabitRef = useRef<((o: 'ack' | 'escalation') => void) | null>(null);

  const persist = useCallback((updater: (d: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const recordAlert = useCallback(
    (level: AlertLevel, location?: GeoPoint) => {
      const trip = activeTripRef.current;
      if (!trip) return;
      const event: AlertEvent = {
        id: newId(),
        tripId: trip.id,
        level,
        firedAt: Date.now(),
        location,
      };
      persist((d) => ({ ...d, alerts: [event, ...d.alerts] }));
    },
    [persist],
  );

  // Khởi tạo engine một lần.
  if (!engineRef.current) {
    engineRef.current = new AlertEngine(
      {
        onState: (s) => setEngineState(s),
        startAlarm: () => {
          fireAlarm(dataRef.current.settings.alarmSound);
          pushLocalNotification(
            'CẢNH BÁO: kiểm tra trẻ trong xe!',
            'Chưa xác nhận đã đưa bé ra khỏi xe. Nhấn để mở app.',
          );
        },
        stopAlarm: () => silenceAlarm(),
        call: async (contact, location) => {
          const label = placeLabelFor(location, dataRef.current.places);
          const msg = contactService.buildMessage(dataRef.current.children[0], location, label);
          const r = await contactService.call(contact, msg, location);
          return r.ok;
        },
        sms: async (contact, location) => {
          const label = placeLabelFor(location, dataRef.current.places);
          const msg = contactService.buildMessage(dataRef.current.children[0], location, label);
          const r = await contactService.sms(contact, msg, location);
          return r.ok;
        },
        getLocation: () => getCurrentLocation(),
        onAlertEvent: (level, location) => {
          recordAlert(level, location);
          // Ngay khi bắt đầu báo động, báo cho các thiết bị khác trong gia đình (bố + mẹ).
          if (level === 'alarm_local') {
            // Leo thang tới báo động = ngữ cảnh "rủi ro" cho học thói quen.
            recordHabitRef.current?.('escalation');
            driverAwayDetector.disarm();
            const familyId = dataRef.current.settings.familyId;
            if (familyId) {
              const label = placeLabelFor(location, dataRef.current.places);
              const body = label
                ? `Chưa xác nhận đã đưa bé ra. Nơi đỗ: ${label}`
                : 'Chưa xác nhận đã đưa bé ra khỏi xe. Kiểm tra ngay!';
              contactService.notifyFamily(familyId, '🚨 Cảnh báo bé trên xe', body, pushTokenRef.current);
            }
          }
        },
      },
      emptyData.settings,
    );
  }
  const engine = engineRef.current;

  // Nạp dữ liệu ban đầu.
  useEffect(() => {
    (async () => {
      const loaded = await loadData();
      setData(loaded);
      engine.updateSettings(loaded.settings);
      // Prototype mặc định dùng provider mock (không gọi/nhắn thật).
      // Cấu hình backend thật ở đây: contactService.configureBackend({ baseUrl, apiKey }).
      contactService.setProvider('mock');
      setReady(true);
    })();
  }, [engine]);

  // Đồng bộ settings sang engine khi đổi.
  useEffect(() => {
    engine.updateSettings(data.settings);
  }, [data.settings, engine]);

  // Đăng ký thiết bị vào gia đình (để bố + mẹ cùng nhận cảnh báo) khi có familyId + backend.
  useEffect(() => {
    if (!ready) return;
    const familyId = data.settings.familyId;
    if (!familyId || !contactService.hasBackend()) return;
    (async () => {
      const token = pushTokenRef.current ?? (await getExpoPushToken());
      if (!token) return;
      pushTokenRef.current = token;
      await contactService.registerFamilyDevice(familyId, token, `Thiết bị ${token.slice(-6)}`);
    })();
  }, [ready, data.settings.familyId]);

  // Bật/tắt tự động phát hiện kết thúc chuyến theo cài đặt.
  useEffect(() => {
    if (!ready) return;
    if (data.settings.autoDetect) {
      tripDetector.enableAutoDetect();
      // Bluetooth chỉ chạy trên Android + dev build; no-op an toàn nếu không có.
      startBluetoothDetection(() =>
        dataRef.current.vehicles.map((v) => v.bluetoothId ?? '').filter(Boolean),
      );
      // iOS: Core Motion + Visits (cần dev build + native module); no-op an toàn nếu không có.
      startIosMotionDetection();
      // OBD (dữ liệu xe qua ELM327); no-op an toàn nếu không có dongle/module.
      obdReader.startObd();
    } else {
      tripDetector.disableAutoDetect();
      stopBluetoothDetection();
      stopIosMotionDetection();
      obdReader.stopObd();
    }
  }, [ready, data.settings.autoDetect]);

  // Ghi nhận kết quả một lần kết thúc chuyến vào model thói quen (chỉ 1 lần/chuyến).
  const recordHabit = useCallback(
    (outcome: 'ack' | 'escalation') => {
      if (outcomeRecordedRef.current) return;
      if (!dataRef.current.settings.adaptiveConfirm) return;
      const key = currentContextRef.current;
      if (!key) return;
      outcomeRecordedRef.current = true;
      persist((d) => ({
        ...d,
        habits: { ...d.habits, [key]: recordOutcome(d.habits[key], outcome) },
      }));
    },
    [persist],
  );
  recordHabitRef.current = recordHabit;

  const beginConfirm = useCallback(
    async (reason: TripEndReason) => {
      const trip = activeTripRef.current;
      if (!trip) return;
      const d = dataRef.current;
      // Đóng thời điểm kết thúc chuyến.
      persist((prev) => ({
        ...prev,
        trips: prev.trips.map((t) =>
          t.id === trip.id ? { ...t, endedAt: Date.now(), endReason: reason } : t,
        ),
      }));

      // Lấy vị trí + trạng thái xe (best-effort) song song.
      const [phoneLoc, vehicleState] = await Promise.all([
        d.settings.attachLocation ? getCurrentLocation() : Promise.resolve(undefined),
        d.settings.familyId && contactService.hasBackend()
          ? contactService.getVehicleState(d.settings.familyId)
          : Promise.resolve(null),
      ]);
      // Vị trí điện thoại ưu tiên; nếu không có thì dùng vị trí xe từ Smartcar.
      const location = phoneLoc ?? vehicleState?.location;
      // Nhiệt độ cabin: ưu tiên OBD, sau đó tới API xe.
      const cabinTemp = cabinTempRef.current ?? vehicleState?.cabinTempC;
      const place = findPlace(location, d.places);
      const key = contextKey(place?.id, new Date());
      const stat = d.habits[key];
      const base = d.settings.t1Seconds;
      let seconds = d.settings.adaptiveConfirm ? adjustConfirmSeconds(base, stat) : base;

      // Hợp nhất nhiều tín hiệu sẵn có để ước lượng khả năng còn bé trên xe.
      const assessment = assessChildPresence({
        rearOccupancy: rearOccupancyRef.current,
        rearSeatbeltBuckled: rearSeatbeltRef.current,
        rearDoorSuspect: rearSeatReminder.finish(),
        childRegisteredAboard: !!trip.childId,
      });
      const suspect = assessment.level !== 'low';
      // Nghi có bé → KHÔNG nới dài xác nhận; nhiệt độ nóng → rút ngắn thêm.
      if (suspect) seconds = Math.min(seconds, base);
      seconds = confirmCapForTemp(seconds, cabinTemp);

      currentContextRef.current = key;
      outcomeRecordedRef.current = false;
      suspectRearSeatRef.current = suspect;
      setSuspectRearSeat(suspect);
      setPresenceReasons(assessment.reasons);
      setConfirmSeconds(seconds);
      setDriverAway(false);
      setIsRoutineContext(d.settings.adaptiveConfirm && isRoutine(stat) && !suspect);

      // Nếu nghi còn bé, theo dõi điện thoại để biết tài xế có rời xe không (leo thang sớm).
      if (suspect) driverAwayDetector.arm();

      engine.armConfirm(dataRef.current.contacts, { confirmSeconds: seconds, location });
    },
    [engine, persist],
  );

  // Lắng nghe sự kiện từ tripDetector.
  useEffect(() => {
    const unsub = tripDetector.subscribe((e) => {
      if (e.type === 'start') {
        rearSeatReminder.onTripStart();
        // Đặt lại trạng thái đai/chiếm chỗ cho chuyến mới (nhiệt độ giữ giá trị mới nhất).
        rearSeatbeltRef.current = false;
        rearOccupancyRef.current = undefined;
        const trip: Trip = {
          id: newId(),
          childId: dataRef.current.children[0]?.id,
          vehicleId: dataRef.current.vehicles[0]?.id,
          startedAt: Date.now(),
        };
        setTrip(trip);
        persist((d) => ({ ...d, trips: [trip, ...d.trips] }));
      } else if (e.type === 'end') {
        beginConfirm(e.reason);
      }
    });
    // Sự kiện xe từ OBD: cửa → logic nhắc ghế sau; tắt máy → đánh dấu ignition off
    // (chạy TRƯỚC khi tripDetector phát 'end', nhờ thứ tự trong obdReader.emit).
    const unsubObd = obdReader.subscribe((e) => {
      if (e.type === 'door') rearSeatReminder.onDoorEvent(e.rear, e.open);
      else if (e.type === 'engine' && !e.on) rearSeatReminder.onIgnitionOff();
      else if (e.type === 'seatbelt' && e.rear) rearSeatbeltRef.current = e.buckled;
      else if (e.type === 'occupancy' && e.rear) rearOccupancyRef.current = e.occupied;
      else if (e.type === 'temp') cabinTempRef.current = e.celsius;
    });
    // Điện thoại xác nhận tài xế đã rời xe → nếu đang xác nhận và nghi còn bé, leo thang sớm.
    const unsubAway = driverAwayDetector.subscribe(() => {
      setDriverAway(true);
      if (engine.getState() === 'confirming' && suspectRearSeatRef.current) {
        engine.hastenConfirm(10);
        setConfirmSeconds(10);
      }
    });
    return () => {
      unsub();
      unsubObd();
      unsubAway();
    };
  }, [beginConfirm, persist, setTrip, engine]);

  const startTrip = useCallback(() => tripDetector.startManual(), []);
  const endTripManually = useCallback(() => tripDetector.endManual(), []);
  const simulateTripEnd = useCallback(() => {
    if (!tripDetector.isTripActive()) tripDetector.startManual();
    tripDetector.endManual();
  }, []);

  const acknowledge = useCallback(() => {
    // Xác nhận ngay ở bước hỏi = ngữ cảnh "quen thuộc" cho học thói quen.
    if (engine.getState() === 'confirming') recordHabit('ack');
    driverAwayDetector.disarm();
    engine.acknowledge();
    setTrip(null);
  }, [engine, setTrip, recordHabit]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      engineState,
      activeTrip,
      confirmSeconds,
      isRoutineContext,
      suspectRearSeat,
      presenceReasons,
      driverAway,
      addChild: (c) => persist((d) => ({ ...d, children: [...d.children, { ...c, id: newId() }] })),
      removeChild: (id) =>
        persist((d) => ({ ...d, children: d.children.filter((x) => x.id !== id) })),
      addVehicle: (v) =>
        persist((d) => ({ ...d, vehicles: [...d.vehicles, { ...v, id: newId() }] })),
      removeVehicle: (id) =>
        persist((d) => ({ ...d, vehicles: d.vehicles.filter((x) => x.id !== id) })),
      addContact: (c) =>
        persist((d) => ({ ...d, contacts: [...d.contacts, { ...c, id: newId() }] })),
      updateContact: (c) =>
        persist((d) => ({ ...d, contacts: d.contacts.map((x) => (x.id === c.id ? c : x)) })),
      removeContact: (id) =>
        persist((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== id) })),
      updateSettings: (s) => persist((d) => ({ ...d, settings: { ...d.settings, ...s } })),
      addPlace: async (name) => {
        const point = await getCurrentLocation();
        if (!point) return false;
        const place: SafePlace = {
          id: newId(),
          name,
          latitude: point.latitude,
          longitude: point.longitude,
          radiusMeters: 150,
        };
        persist((d) => ({ ...d, places: [...d.places, place] }));
        return true;
      },
      removePlace: (id) => persist((d) => ({ ...d, places: d.places.filter((x) => x.id !== id) })),
      setOnboarded: (v) => persist((d) => ({ ...d, onboarded: v })),
      startTrip,
      endTripManually,
      simulateTripEnd,
      acknowledge,
    }),
    [
      data,
      ready,
      engineState,
      activeTrip,
      confirmSeconds,
      isRoutineContext,
      suspectRearSeat,
      presenceReasons,
      driverAway,
      persist,
      startTrip,
      endTripManually,
      simulateTripEnd,
      acknowledge,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore phải nằm trong <StoreProvider>');
  return ctx;
}
