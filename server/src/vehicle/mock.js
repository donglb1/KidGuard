// Provider xe giả lập — trả dữ liệu cố định để chạy thử luồng mà không cần tài khoản xe thật.
function createMockVehicleProvider() {
  return {
    name: 'mock',
    getAuthUrl() {
      return 'https://connect.smartcar.com/oauth/authorize?mock=1';
    },
    async exchangeCode(_code) {
      return {
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
        vehicleId: 'mock-vehicle',
        expiration: Date.now() + 3600_000,
      };
    },
    async refresh(token) {
      return { ...token, accessToken: 'mock-access-2', expiration: Date.now() + 3600_000 };
    },
    async getState(_token, _vehicleId) {
      return {
        provider: 'mock',
        location: { latitude: 21.0278, longitude: 105.8342 },
        odometerKm: 12345,
        locked: true,
        cabinTempC: 33,
      };
    },
  };
}

module.exports = { createMockVehicleProvider };
