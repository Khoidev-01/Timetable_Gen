/**
 * Tuỳ chọn kết nối Redis dùng chung cho mọi nơi trong backend (captcha, OTP, trợ lý AI, hàng đợi).
 *
 * Trước đây mỗi nơi tự đọc REDIS_HOST/REDIS_PORT và không có mật khẩu, nên không thể bật
 * `requirepass` cho Redis mà không sửa từng chỗ. Đặt REDIS_PASSWORD thì mọi kết nối đều gửi mật
 * khẩu; để trống thì giữ hành vi cũ (Redis không mật khẩu, chỉ nên dùng khi cổng không lộ ra ngoài).
 */
export function redisConnectionOptions() {
  const password = process.env.REDIS_PASSWORD?.trim();
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(password ? { password } : {}),
  };
}
