/**
 * The signing secret has no fallback on purpose. A default value means a deployment that
 * forgets to set JWT_SECRET still starts, and every token it issues can be forged by
 * anyone who has read the source.
 */
export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error('Thiếu biến môi trường JWT_SECRET. Đặt một chuỗi ngẫu nhiên tối thiểu 32 ký tự.');
  }

  if (secret.trim().length < 32) {
    throw new Error(
      `JWT_SECRET quá ngắn (${secret.trim().length} ký tự). Cần tối thiểu 32 ký tự.`,
    );
  }

  return secret;
}

export const JWT_EXPIRES_IN = '1d';
