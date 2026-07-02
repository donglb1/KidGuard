import { GeoPoint, SafePlace } from '@/models';

/** Khoảng cách giữa 2 toạ độ (mét) theo công thức Haversine. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // bán kính Trái Đất (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Điểm có nằm trong bán kính của địa điểm không? */
export function isWithin(point: GeoPoint, place: SafePlace): boolean {
  return distanceMeters(point, place) <= place.radiusMeters;
}

/** Tìm địa điểm an toàn chứa điểm này (nếu có). */
export function findPlace(point: GeoPoint | undefined, places: SafePlace[]): SafePlace | undefined {
  if (!point) return undefined;
  return places.find((p) => isWithin(point, p));
}

/** Nhãn tên nơi đỗ (vd "Nhà", "Trường") để gắn vào cảnh báo, nếu khớp địa điểm. */
export function placeLabelFor(point: GeoPoint | undefined, places: SafePlace[]): string | undefined {
  return findPlace(point, places)?.name;
}
