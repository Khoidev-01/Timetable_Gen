import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { APIError } from 'better-auth/api';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { createBetterAuth } from './better-auth.config';

/** Vé giữa hai bước đăng nhập: đã qua mật khẩu, còn chờ mã. Ký bằng JWT, sống 10 phút. */
interface Challenge {
  purpose: 'otp';
  sub: string;
  email?: string;
  /** Email mới khai lần đầu, chỉ ghi vào hồ sơ khi mã đúng */
  newEmail?: boolean;
}

const CHALLENGE_TTL = '10m';

/** Chống spam gửi mã: mỗi email phải cách nhau ngần này giây, và tối đa ngần này mã mỗi giờ. */
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;

export const maskEmail = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');

/**
 * Bước 2 của đăng nhập: mã 6 số gửi về email. Mọi tài khoản đều phải qua bước này.
 *
 * Email của quản trị viên khai trong .env (ADMIN_EMAIL); giáo viên dùng email trong hồ sơ, chưa
 * có thì lần đầu phải khai và xác nhận bằng chính mã gửi tới email đó.
 */
@Injectable()
export class OtpService implements OnModuleDestroy {
  private readonly logger = new Logger(OtpService.name);
  private readonly auth: ReturnType<typeof createBetterAuth>;
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 2,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {
    this.auth = createBetterAuth(prisma, (email, otp) => this.mail.sendOtp(email, otp));
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  /** Tắt được bằng OTP_ENABLED=false (chỉ nên dùng khi chạy kiểm thử tự động). */
  get enabled() {
    return process.env.OTP_ENABLED !== 'false';
  }

  async emailOf(user: { id: string; role: string }): Promise<string | null> {
    if (user.role === 'ADMIN') return process.env.ADMIN_EMAIL?.trim() || null;
    const row = await this.prisma.user.findUnique({ where: { id: user.id }, include: { teacher_profile: true } });
    return row?.teacher_profile?.email?.trim() || null;
  }

  private issueChallenge(payload: Omit<Challenge, 'purpose'>) {
    return this.jwt.sign({ purpose: 'otp', ...payload } satisfies Challenge, { expiresIn: CHALLENGE_TTL });
  }

  private readChallenge(token: string): Challenge {
    try {
      const payload = this.jwt.verify<Challenge>(token);
      if (payload.purpose !== 'otp') throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.');
    }
  }

  /** Sau khi mật khẩu đúng: gửi mã, hoặc đòi khai email nếu hồ sơ chưa có. */
  async begin(user: { id: string; role: string }) {
    const email = await this.emailOf(user);
    if (!email) {
      if (user.role === 'ADMIN') {
        this.logger.error('ADMIN_EMAIL chưa được khai trong .env');
        throw new BadRequestException('Hệ thống chưa cấu hình email quản trị. Liên hệ người quản trị máy chủ.');
      }
      return { step: 'EMAIL_REQUIRED' as const, challenge: this.issueChallenge({ sub: user.id }) };
    }
    await this.send(email);
    return { step: 'OTP_REQUIRED' as const, challenge: this.issueChallenge({ sub: user.id, email }), emailHint: maskEmail(email) };
  }

  /** Khai email lần đầu (EMAIL_REQUIRED) hoặc gửi lại mã. */
  async request(challengeToken: string, email?: string) {
    const challenge = this.readChallenge(challengeToken);
    let target = challenge.email;
    let newEmail = challenge.newEmail ?? false;
    if (!target) {
      const trimmed = (email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new BadRequestException('Email không hợp lệ.');
      const taken = await this.prisma.teacher.findFirst({ where: { email: trimmed, user: { isNot: { id: challenge.sub } } } });
      if (taken) throw new BadRequestException('Email này đã được tài khoản khác dùng.');
      target = trimmed;
      newEmail = true;
    }
    await this.send(target);
    return { step: 'OTP_REQUIRED' as const, challenge: this.issueChallenge({ sub: challenge.sub, email: target, newEmail }), emailHint: maskEmail(target) };
  }

  /** Mã đúng → trả về user để cấp JWT; email khai lần đầu được ghi vào hồ sơ. */
  async verify(challengeToken: string, otp: string) {
    const challenge = this.readChallenge(challengeToken);
    if (!challenge.email) throw new BadRequestException('Chưa gửi mã cho phiên này.');
    try {
      await this.auth.api.signInEmailOTP({ body: { email: challenge.email, otp: String(otp).trim() } });
    } catch (error) {
      if (error instanceof APIError) {
        const code = (error.body as any)?.code ?? '';
        if (code === 'TOO_MANY_ATTEMPTS') throw new UnauthorizedException('Nhập sai quá 3 lần, hãy yêu cầu mã mới.');
        if (code === 'OTP_EXPIRED') throw new UnauthorizedException('Mã đã hết hạn, hãy yêu cầu mã mới.');
        throw new UnauthorizedException('Mã không đúng.');
      }
      throw error;
    }
    const user = await this.prisma.user.findUnique({ where: { id: challenge.sub }, include: { teacher_profile: true } });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại.');
    if (challenge.newEmail && user.teacher_profile_id) {
      await this.prisma.teacher.update({ where: { id: user.teacher_profile_id }, data: { email: challenge.email } });
    }
    return user;
  }

  /**
   * Một email chỉ nhận một mã mỗi 60 giây và tối đa 5 mã mỗi giờ, bất kể ai yêu cầu. Kẻ biết
   * mật khẩu của người khác (hoặc chỉ biết tên đăng nhập, lúc khai email lần đầu) không thể dội
   * hộp thư nạn nhân bằng mã; giới hạn theo IP ở controller không đủ vì IP đổi được.
   */
  private async guardSpam(email: string) {
    const key = email.toLowerCase();
    const cooldownKey = `otp:cooldown:${key}`;
    const hourlyKey = `otp:hourly:${key}`;
    const ttl = await this.redis.ttl(cooldownKey);
    if (ttl > 0) {
      throw new HttpException(`Mã vừa được gửi, hãy đợi ${ttl} giây rồi yêu cầu lại.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const count = await this.redis.incr(hourlyKey);
    if (count === 1) await this.redis.expire(hourlyKey, 3600);
    if (count > MAX_SENDS_PER_HOUR) {
      const wait = Math.max(1, Math.ceil((await this.redis.ttl(hourlyKey)) / 60));
      throw new HttpException(`Đã gửi quá ${MAX_SENDS_PER_HOUR} mã trong một giờ. Thử lại sau ${wait} phút.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SECONDS);
  }

  private async send(email: string) {
    await this.guardSpam(email);
    try {
      // sendVerificationOTP catches errors from its email callback internally, which can make
      // the UI claim that a code was sent even when SMTP failed. Generate/store the hashed OTP
      // through Better Auth, then await SMTP ourselves so delivery failures reach the client.
      const otp = await this.auth.api.createVerificationOTP({ body: { email, type: 'sign-in' } });
      await this.mail.sendOtp(email, otp);
    } catch (error) {
      this.logger.error(`Không gửi được OTP tới ${maskEmail(email)}: ${error}`);
      throw new BadRequestException('Không gửi được email mã đăng nhập. Thử lại sau hoặc liên hệ quản trị.');
    }
  }
}
