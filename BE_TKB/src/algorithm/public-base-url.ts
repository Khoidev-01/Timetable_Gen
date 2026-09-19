/**
 * Địa chỉ web dùng để dựng liên kết công khai (mã QR dán bảng tin).
 *
 * Chỗ này từng chỉ đọc `PUBLIC_WEB_URL`, mặc định `http://localhost:3000`. Mà
 * docker-compose luôn truyền biến đó xuống kèm chính giá trị localhost, nên một lần deploy
 * quên khai biến trên máy chủ là mã QR in ra trỏ về máy của người bấm nút - quét bằng điện
 * thoại thì không mở được gì, và chỉ phát hiện ra lúc đã dán lên bảng tin.
 *
 * Nên thứ tự bây giờ: biến môi trường (nếu không phải localhost) → địa chỉ trình duyệt vừa
 * gọi tới (trình duyệt tự gắn `Origin`, không sửa được từ trang khác vì CORS đã chặn) →
 * cuối cùng mới tới giá trị trong biến, kể cả khi nó là localhost, để máy dev vẫn đúng.
 */
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;

const tidy = (value: string | undefined | null) => value?.trim().replace(/\/+$/, '') || '';

export function resolvePublicBaseUrl(configured: string | undefined, requestOrigin?: string): string {
  const fromEnv = tidy(configured);
  const fromRequest = tidy(requestOrigin);

  if (fromEnv && !LOCAL_HOST.test(fromEnv)) return fromEnv;
  if (fromRequest && !LOCAL_HOST.test(fromRequest)) return fromRequest;
  return fromEnv || fromRequest || 'http://localhost:3000';
}
