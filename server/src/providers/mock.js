// Provider giả lập: không gọi/nhắn thật, chỉ log. Dùng để chạy thử server.
function createMockProvider() {
  const log = [];
  return {
    name: 'mock',
    async call({ to, message }) {
      const line = `[MOCK CALL] -> ${to} | ${message}`;
      log.push(line);
      console.log(line);
      return { ok: true, id: `mock-call-${Date.now()}` };
    },
    async sms({ to, message }) {
      const line = `[MOCK SMS] -> ${to} | ${message}`;
      log.push(line);
      console.log(line);
      return { ok: true, id: `mock-sms-${Date.now()}` };
    },
    _log: log,
  };
}

module.exports = { createMockProvider };
