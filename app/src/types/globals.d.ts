// Cho phép dùng require() động (để nạp native module tuỳ chọn mà không lỗi typecheck
// khi thư viện chưa được cài, ví dụ khi chạy trong Expo Go).
declare function require(moduleName: string): any;
