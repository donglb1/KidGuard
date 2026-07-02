require('dotenv').config();
const express = require('express');
const { createMockProvider } = require('./providers/mock');
const { createTwilioProvider } = require('./providers/twilio');
const { createStringeeProvider } = require('./providers/stringee');
const { createTelegramProvider } = require('./providers/telegram');
const { registerDevice, getFamily, getTokens } = require('./family');
const { sendPush } = require('./push');
const { buildVehicleProvider } = require('./vehicle');
const { saveToken, getToken } = require('./vehicle/tokenStore');

const PROVIDER = (process.env.PROVIDER || 'mock').toLowerCase();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || '';

// Chọn provider theo biến môi trường (cùng một interface { call, sms }).
function buildProvider() {
  switch (PROVIDER) {
    case 'twilio':
      return createTwilioProvider(process.env);
    case 'stringee':
      return createStringeeProvider(process.env);
    case 'telegram':
      return createTelegramProvider(process.env);
    case 'mock':
    default:
      return createMockProvider();
  }
}

const provider = buildProvider();
const vehicle = buildVehicleProvider();

const app = express();
app.use(express.json());

// Xác thực đơn giản bằng Bearer token (API_KEY do backend cấp cho app).
function auth(req, res, next) {
  if (!API_KEY) return next(); // Không đặt API_KEY => bỏ qua (chỉ nên dùng khi dev).
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

app.post('/call', auth, async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: 'thiếu to/message' });
  try {
    const result = await provider.call({ to, message });
    res.json(result);
  } catch (e) {
    console.error('[call] lỗi:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.post('/sms', auth, async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: 'thiếu to/message' });
  try {
    const result = await provider.sms({ to, message });
    res.json(result);
  } catch (e) {
    console.error('[sms] lỗi:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ---- Đồng bộ đa thiết bị (bố + mẹ cùng nhận cảnh báo) ----

// Đăng ký token push của một thiết bị vào một "gia đình".
app.post('/register', auth, (req, res) => {
  const { familyId, pushToken, deviceName } = req.body || {};
  if (!familyId || !pushToken) {
    return res.status(400).json({ ok: false, error: 'thiếu familyId/pushToken' });
  }
  try {
    const family = registerDevice(familyId, pushToken, deviceName);
    res.json({ ok: true, devices: family.devices.length });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Xem gia đình (debug).
app.get('/family/:id', auth, (req, res) => {
  const family = getFamily(req.params.id);
  res.json({ ok: true, devices: family.devices.map((d) => ({ deviceName: d.deviceName })) });
});

// Gửi cảnh báo tới mọi thiết bị khác trong gia đình (loại trừ thiết bị gửi).
app.post('/notify-family', auth, async (req, res) => {
  const { familyId, title, body, excludeToken, data } = req.body || {};
  if (!familyId || !title) {
    return res.status(400).json({ ok: false, error: 'thiếu familyId/title' });
  }
  try {
    const tokens = getTokens(familyId, excludeToken);
    const result = await sendPush(tokens, { title, body: body || '', data }, process.env);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[notify-family] lỗi:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ---- Dữ liệu xe kết nối (Smartcar/API hãng) ----

// Lấy URL để người dùng liên kết tài khoản xe.
app.get('/vehicle/auth-url', auth, (_req, res) => {
  try {
    res.json({ ok: true, url: vehicle.getAuthUrl(), provider: vehicle.name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Đổi mã OAuth lấy token và lưu theo familyId.
app.post('/vehicle/exchange', auth, async (req, res) => {
  const { familyId, code } = req.body || {};
  if (!familyId || !code) return res.status(400).json({ ok: false, error: 'thiếu familyId/code' });
  try {
    const token = await vehicle.exchangeCode(code);
    saveToken(familyId, token);
    res.json({ ok: true, vehicleId: token.vehicleId });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Đọc trạng thái xe (vị trí/khoá/odometer/nhiệt độ nếu có).
app.get('/vehicle/state', auth, async (req, res) => {
  const familyId = req.query.familyId;
  if (!familyId) return res.status(400).json({ ok: false, error: 'thiếu familyId' });
  let token = getToken(familyId);
  if (!token) return res.status(404).json({ ok: false, error: 'chưa liên kết xe' });
  try {
    // Tự làm mới token nếu đã hết hạn và provider hỗ trợ.
    if (token.expiration && Date.now() > token.expiration && vehicle.refresh) {
      const refreshed = await vehicle.refresh(token);
      if (refreshed) {
        token = refreshed;
        saveToken(familyId, token);
      }
    }
    const state = await vehicle.getState(token.accessToken, token.vehicleId);
    res.json({ ok: true, ...state });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Chỉ tự chạy khi gọi trực tiếp (để test import được app).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AnToànBé server (provider=${provider.name}) đang chạy tại cổng ${PORT}`);
  });
}

module.exports = app;
