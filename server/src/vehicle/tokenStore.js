// Lưu token xe kết nối theo familyId (file JSON), có MÃ HOÁ AES-256-GCM khi đặt TOKEN_ENC_KEY.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.VEHICLE_STORE || path.join(__dirname, '..', '..', 'data', 'vehicles.json');

function encKey() {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  // Chuẩn hoá về khoá 32 byte bằng SHA-256.
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(obj) {
  const key = encKey();
  const plaintext = JSON.stringify(obj);
  if (!key) {
    // Không có khoá → lưu thô (chỉ nên dùng khi dev). Cảnh báo một lần.
    return { _enc: false, data: plaintext };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    _enc: true,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

function decrypt(entry) {
  if (!entry) return null;
  if (!entry._enc) return JSON.parse(entry.data);
  const key = encKey();
  if (!key) throw new Error('Dữ liệu đã mã hoá nhưng thiếu TOKEN_ENC_KEY.');
  const iv = Buffer.from(entry.iv, 'base64');
  const tag = Buffer.from(entry.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(Buffer.from(entry.data, 'base64')), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function saveToken(familyId, token) {
  const all = readAll();
  all[familyId] = encrypt({ ...token, updatedAt: Date.now() });
  writeAll(all);
}

function getToken(familyId) {
  const entry = readAll()[familyId];
  return entry ? decrypt(entry) : null;
}

module.exports = { saveToken, getToken };
