import * as Location from 'expo-location';
import { GeoPoint } from '@/models';

/** Xin quyền vị trí (khi dùng). Trả về true nếu được cấp. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Lấy vị trí hiện tại. Trả về undefined nếu không lấy được. */
export async function getCurrentLocation(): Promise<GeoPoint | undefined> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return undefined;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return undefined;
  }
}

/** Tạo link Google Maps từ toạ độ để đính vào SMS. */
export function mapsLink(p?: GeoPoint): string | undefined {
  if (!p) return undefined;
  return `https://maps.google.com/?q=${p.latitude},${p.longitude}`;
}
