// Provider Twilio: gọi (đọc lời cảnh báo bằng TwiML) và gửi SMS.
const twilio = require('twilio');

function createTwilioProvider(env) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('Thiếu cấu hình Twilio (SID/TOKEN/FROM_NUMBER).');
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  return {
    name: 'twilio',
    async call({ to, message }) {
      // TwiML đọc to lời cảnh báo bằng giọng tiếng Việt, lặp 2 lần.
      const twiml = `<Response><Say language="vi-VN" loop="2">${escapeXml(message)}</Say></Response>`;
      const res = await client.calls.create({
        to,
        from: TWILIO_FROM_NUMBER,
        twiml,
      });
      return { ok: true, id: res.sid };
    },
    async sms({ to, message }) {
      const res = await client.messages.create({
        to,
        from: TWILIO_FROM_NUMBER,
        body: message,
      });
      return { ok: true, id: res.sid };
    },
  };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c],
  );
}

module.exports = { createTwilioProvider };
