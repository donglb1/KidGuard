// Sổ đăng ký thiết bị theo "gia đình" (familyId). Lưu ra file JSON để sống sót khi restart.
// Mỗi gia đình là một nhóm token push (bố + mẹ + người thân cùng nhận cảnh báo).
const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.FAMILY_STORE || path.join(__dirname, '..', 'data', 'families.json');

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

/** Đăng ký/cập nhật một thiết bị vào gia đình. Trùng token thì cập nhật tên. */
function registerDevice(familyId, pushToken, deviceName) {
  if (!familyId || !pushToken) throw new Error('thiếu familyId/pushToken');
  const all = readAll();
  const family = all[familyId] || { devices: [] };
  const existing = family.devices.find((d) => d.pushToken === pushToken);
  if (existing) {
    existing.deviceName = deviceName || existing.deviceName;
    existing.updatedAt = Date.now();
  } else {
    family.devices.push({ pushToken, deviceName: deviceName || 'Thiết bị', updatedAt: Date.now() });
  }
  all[familyId] = family;
  writeAll(all);
  return family;
}

function getFamily(familyId) {
  return readAll()[familyId] || { devices: [] };
}

/** Lấy các token của gia đình, có thể loại trừ token của thiết bị gửi (excludeToken). */
function getTokens(familyId, excludeToken) {
  return getFamily(familyId)
    .devices.map((d) => d.pushToken)
    .filter((t) => t && t !== excludeToken);
}

module.exports = { registerDevice, getFamily, getTokens };
