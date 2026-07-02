const { createMockVehicleProvider } = require('./mock');
const { createSmartcarProvider } = require('./smartcar');

// Chọn provider dữ liệu xe theo biến môi trường VEHICLE_PROVIDER=mock|smartcar.
function buildVehicleProvider(env = process.env) {
  const kind = (env.VEHICLE_PROVIDER || 'mock').toLowerCase();
  if (kind === 'smartcar') return createSmartcarProvider(env);
  return createMockVehicleProvider();
}

module.exports = { buildVehicleProvider };
