import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

/**
 * better-auth chỉ đóng vai "động cơ OTP": sinh mã 6 số, băm khi lưu, hết hạn sau 5 phút, khóa
 * sau 3 lần nhập sai. Đăng nhập mật khẩu, JWT và phân quyền vẫn là của hệ thống; các bảng của
 * better-auth (auth_users, auth_sessions, auth_accounts, auth_verifications) tách riêng khỏi
 * bảng users.
 */
export function createBetterAuth(prisma: PrismaClient, sendOtp: (email: string, otp: string) => Promise<void>) {
  return betterAuth({
    secret: process.env.JWT_SECRET || 'dev-only-secret',
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4001',
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    user: { modelName: 'authUser' },
    session: { modelName: 'authSession' },
    account: { modelName: 'authAccount' },
    verification: { modelName: 'authVerification' },
    emailAndPassword: { enabled: false },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          await sendOtp(email, otp);
        },
      }),
    ],
  });
}
