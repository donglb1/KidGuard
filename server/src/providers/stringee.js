// Provider Stringee (Việt Nam): gọi ra (callout + SCCO "talk") và SMS (nếu bật brandname).
const axios = require('axios');
const jwt = require('jsonwebtoken');

const CALLOUT_URL = 'https://api.stringee.com/v1/call2/callout';
const SMS_URL = 'https://api.stringee.com/v1/sms';

function createStringeeProvider(env) {
  const {
    STRINGEE_API_SID,
    STRINGEE_API_SECRET,
    STRINGEE_FROM_NUMBER,
    STRINGEE_SMS_ENABLED,
  } = env;
  if (!STRINGEE_API_SID || !STRINGEE_API_SECRET || !STRINGEE_FROM_NUMBER) {
    throw new Error('Thiếu cấu hình Stringee (API_SID/API_SECRET/FROM_NUMBER).');
  }

  // Tạo access token JWT theo chuẩn Stringee (HS256, cty=stringee-api;v=1).
  function makeToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      jti: `${STRINGEE_API_SID}-${now}`,
      iss: STRINGEE_API_SID,
      exp: now + 3600,
      rest_api: true,
    };
    return jwt.sign(payload, STRINGEE_API_SECRET, {
      algorithm: 'HS256',
      header: { typ: 'JWT', alg: 'HS256', cty: 'stringee-api;v=1' },
    });
  }

  return {
    name: 'stringee',
    async call({ to, message }) {
      const token = makeToken();
      // SCCO: đọc lời cảnh báo bằng TTS tiếng Việt.
      const body = {
        from: { type: 'external', number: STRINGEE_FROM_NUMBER, alias: 'AnToanBe' },
        to: [{ type: 'external', number: to, alias: to }],
        actions: [{ action: 'talk', text: message, voice: 'female', repeat: 2 }],
      };
      const res = await axios.post(CALLOUT_URL, body, {
        headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      });
      return { ok: true, id: res.data?.call_id ?? 'stringee-call' };
    },
    async sms({ to, message }) {
      if (String(STRINGEE_SMS_ENABLED).toLowerCase() !== 'true') {
        // SMS Stringee cần brandname được duyệt. Nếu chưa bật, báo rõ để lớp trên fallback.
        throw new Error('Stringee SMS chưa bật (cần brandname được duyệt).');
      }
      const token = makeToken();
      const body = { sms: [{ from: 'AnToanBe', to, text: message }] };
      const res = await axios.post(SMS_URL, body, {
        headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      });
      return { ok: true, id: res.data?.sms_id ?? 'stringee-sms' };
    },
  };
}

module.exports = { createStringeeProvider };
