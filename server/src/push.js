// Gửi thông báo đẩy qua Expo Push API.
const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// PUSH_DRY_RUN=true => không gọi Expo thật, chỉ trả về danh sách (dùng để test).
function isDryRun(env) {
  return String(env.PUSH_DRY_RUN || '').toLowerCase() === 'true';
}

/**
 * Gửi cùng một thông báo tới nhiều Expo push token.
 * @returns { sent: number, dryRun: boolean }
 */
async function sendPush(tokens, { title, body, data }, env = process.env) {
  const valid = (tokens || []).filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return { sent: 0, dryRun: isDryRun(env) };

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: data || {},
  }));

  if (isDryRun(env)) {
    console.log(`[push:dry-run] sẽ gửi tới ${valid.length} thiết bị: ${title}`);
    return { sent: valid.length, dryRun: true };
  }

  await axios.post(EXPO_PUSH_URL, messages, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  return { sent: valid.length, dryRun: false };
}

module.exports = { sendPush };
