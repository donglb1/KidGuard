// Provider Telegram: gửi cảnh báo tới một chat/group Telegram (MIỄN PHÍ, không cần Twilio/Stringee).
//
// Telegram không đặt được CUỘC GỌI thoại, nên cả "call" và "sms" đều gửi TIN NHẮN khẩn tới
// chat đã cấu hình (bố + mẹ cùng vào group đó). Đơn giản, không tốn cước, không cần giấy tờ.
//
// Cách lấy cấu hình:
//  1) Chat với @BotFather trên Telegram → /newbot → lấy TELEGRAM_BOT_TOKEN.
//  2) Tạo group, thêm bot vào, gửi 1 tin; mở
//     https://api.telegram.org/bot<token>/getUpdates để lấy chat.id → TELEGRAM_CHAT_ID.
const axios = require('axios');

function createTelegramProvider(env) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = env;
  const dry = String(env.TELEGRAM_DRY_RUN || '').toLowerCase() === 'true';

  async function send(text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return { ok: false, via: 'telegram', detail: 'chưa cấu hình TELEGRAM_BOT_TOKEN/CHAT_ID' };
    }
    if (dry) {
      console.log('[telegram:dry-run]', text);
      return { ok: true, via: 'telegram' };
    }
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
    });
    return { ok: true, via: 'telegram' };
  }

  return {
    name: 'telegram',
    async call({ to, name, message }) {
      return send(`📞 GỌI KHẨN → ${name || to}\n${message}`);
    },
    async sms({ to, name, message }) {
      return send(`✉️ ${name || to}\n${message}`);
    },
  };
}

module.exports = { createTelegramProvider };
