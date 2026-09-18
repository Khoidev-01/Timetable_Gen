import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Gửi email qua SMTP khai trong .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
 * Lúc phát triển trỏ vào hộp thư giả lập (Mailpit) để đọc lại mã mà không gửi ra ngoài.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: nodemailer.Transporter | null = null;

  private transporter() {
    if (this.transport) return this.transport;
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error('Chưa cấu hình SMTP_HOST nên không gửi được email.');
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if ((user && !pass) || (!user && pass)) {
      throw new Error('SMTP_USER và SMTP_PASS phải được cấu hình cùng nhau.');
    }
    if (host === 'smtp.resend.com' && (!user || !pass)) {
      throw new Error('Resend yêu cầu SMTP_USER=resend và SMTP_PASS là API key hợp lệ.');
    }
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transport;
  }

  async sendOtp(to: string, otp: string) {
    const from = process.env.SMTP_FROM || 'MiKiTimetable <no-reply@mikitimetable.local>';
    const info = await this.transporter().sendMail({
      from,
      to,
      subject: `${otp} là mã đăng nhập MiKiTimetable`,
      text: `Mã đăng nhập của bạn: ${otp}\n\nMã có hiệu lực 5 phút. Nếu bạn không đăng nhập, hãy bỏ qua email này.`,
      html: `<p>Mã đăng nhập của bạn:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>Mã có hiệu lực 5 phút. Nếu bạn không đăng nhập, hãy bỏ qua email này.</p>`,
    });
    if (!info.accepted?.length) {
      throw new Error(`SMTP không chấp nhận người nhận: ${info.response || 'không có phản hồi'}`);
    }
    this.logger.log(
      `SMTP đã chấp nhận OTP tới ${to.replace(/^(.{2}).*(@.*)$/, '$1***$2')} (messageId: ${info.messageId})`,
    );
  }
}
