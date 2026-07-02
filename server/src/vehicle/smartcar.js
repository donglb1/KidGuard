// Provider đọc dữ liệu xe qua Smartcar (aggregator kết nối nhiều hãng).
//
// LƯU Ý về độ phủ: Smartcar chủ yếu cung cấp VỊ TRÍ, quãng đường (odometer), trạng thái
// KHOÁ và thông tin xe — **không** có sự kiện mở cửa / đai an toàn / chiếm chỗ ghế sau.
// Vì vậy Smartcar bổ trợ cho ngữ cảnh (đã đỗ ở đâu, xe đã khoá chưa), còn phát hiện kết
// thúc chuyến/logic cửa vẫn dựa vào OBD (xem app/obdReader.ts).
const smartcar = require('smartcar');

function createSmartcarProvider(env) {
  const { SMARTCAR_CLIENT_ID, SMARTCAR_CLIENT_SECRET, SMARTCAR_REDIRECT_URI, SMARTCAR_MODE } = env;
  if (!SMARTCAR_CLIENT_ID || !SMARTCAR_CLIENT_SECRET || !SMARTCAR_REDIRECT_URI) {
    throw new Error('Thiếu cấu hình Smartcar (CLIENT_ID/CLIENT_SECRET/REDIRECT_URI).');
  }
  const client = new smartcar.AuthClient({
    clientId: SMARTCAR_CLIENT_ID,
    clientSecret: SMARTCAR_CLIENT_SECRET,
    redirectUri: SMARTCAR_REDIRECT_URI,
    mode: SMARTCAR_MODE || 'live',
  });

  const SCOPE = ['read_location', 'read_vehicle_info', 'read_security', 'read_odometer'];

  return {
    name: 'smartcar',
    getAuthUrl() {
      return client.getAuthUrl(SCOPE);
    },
    async exchangeCode(code) {
      const access = await client.exchangeCode(code);
      const { vehicles } = await smartcar.getVehicles(access.accessToken);
      return {
        accessToken: access.accessToken,
        refreshToken: access.refreshToken,
        expiration: access.expiration,
        vehicleId: vehicles[0],
      };
    },
    async refresh(token) {
      if (!token.refreshToken) return null;
      const access = await client.exchangeRefreshToken(token.refreshToken);
      return {
        ...token,
        accessToken: access.accessToken,
        refreshToken: access.refreshToken,
        expiration: access.expiration,
      };
    },
    async getState(token, vehicleId) {
      const v = new smartcar.Vehicle(vehicleId, token);
      const state = { provider: 'smartcar' };
      // Bọc từng lệnh vì độ phủ khác nhau theo hãng.
      try {
        const loc = await v.location();
        state.location = { latitude: loc.latitude, longitude: loc.longitude };
      } catch {
        /* hãng không hỗ trợ */
      }
      try {
        const odo = await v.odometer();
        state.odometerKm = odo.distance;
      } catch {
        /* bỏ qua */
      }
      return state;
    },
  };
}

module.exports = { createSmartcarProvider };
