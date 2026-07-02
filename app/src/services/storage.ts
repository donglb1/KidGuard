import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, emptyData } from '@/models';

const KEY = '@antoanbe/data/v1';

/** Đọc toàn bộ dữ liệu app từ bộ nhớ cục bộ. Trả về mặc định nếu chưa có. */
export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Trộn với mặc định để an toàn khi thêm trường mới ở phiên bản sau.
    return {
      ...emptyData,
      ...parsed,
      settings: { ...emptyData.settings, ...(parsed.settings ?? {}) },
    };
  } catch (e) {
    console.warn('[storage] loadData lỗi, dùng mặc định:', e);
    return emptyData;
  }
}

/** Ghi toàn bộ dữ liệu app xuống bộ nhớ cục bộ. */
export async function saveData(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[storage] saveData lỗi:', e);
  }
}

/** Tạo id ngắn gọn không cần thư viện ngoài. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
