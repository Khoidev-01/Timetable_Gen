import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const EMAIL_THEME = {
  page: '#F3F6FC',
  surface: '#FDFEFF',
  surfaceSoft: '#EEF3FF',
  ink: '#15203B',
  muted: '#526078',
  subtle: '#74829A',
  border: '#D9E2F3',
  primary: '#315CE8',
  primaryDark: '#2446BC',
} as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });

export function buildOtpEmail(otp: string, publicWebUrl = process.env.PUBLIC_WEB_URL || 'https://gettimetable.cloud') {
  const normalizedOtp = String(otp).trim();
  const webUrl = publicWebUrl.trim().replace(/\/+$/, '') || 'https://gettimetable.cloud';
  const safeWebUrl = escapeHtml(webUrl);
  const logoUrl = `${safeWebUrl}/logo.png`;
  const otpCells = Array.from(normalizedOtp)
    .map(
      (digit, index) => `${index > 0 ? '<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>' : ''}
        <td width="36" height="48" align="center" valign="middle" style="width:36px;height:48px;border:1px solid ${EMAIL_THEME.border};border-radius:8px;background-color:${EMAIL_THEME.surface};color:${EMAIL_THEME.primaryDark};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:48px;mso-line-height-rule:exactly;font-variant-numeric:tabular-nums;">${escapeHtml(digit)}</td>`,
    )
    .join('');

  return {
    subject: `${normalizedOtp} là mã đăng nhập MiKiTimetable`,
    text: [
      'MiKiTimetable',
      'Xác nhận đăng nhập',
      '',
      `Mã đăng nhập của bạn: ${normalizedOtp}`,
      '',
      'Mã có hiệu lực trong 5 phút và chỉ dùng một lần.',
      'Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.',
      '',
      `MiKiTimetable: ${webUrl}`,
    ].join('\n'),
    html: `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Xác nhận đăng nhập MiKiTimetable</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_THEME.page};color:${EMAIL_THEME.ink};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Mã đăng nhập MiKiTimetable có hiệu lực trong 5 phút.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:${EMAIL_THEME.page};border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid ${EMAIL_THEME.border};border-radius:16px;background-color:${EMAIL_THEME.surface};border-collapse:separate;overflow:hidden;">
            <tr>
              <td height="4" style="height:4px;background-color:${EMAIL_THEME.primary};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:24px;border-bottom:1px solid ${EMAIL_THEME.border};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td width="56" valign="middle" style="width:56px;">
                      <img src="${logoUrl}" width="48" height="48" alt="MiKiTimetable" style="display:block;width:48px;height:48px;border:0;border-radius:12px;">
                    </td>
                    <td valign="middle" style="padding-left:12px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                      <div style="color:${EMAIL_THEME.ink};font-size:20px;font-weight:700;line-height:24px;">MiKiTimetable</div>
                      <div style="margin-top:4px;color:${EMAIL_THEME.muted};font-size:13px;line-height:20px;">Hệ thống xếp thời khóa biểu thông minh</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px;">
                <h1 style="margin:0;color:${EMAIL_THEME.ink};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;line-height:32px;">Xác nhận đăng nhập</h1>
                <p style="margin:12px 0 0;color:${EMAIL_THEME.muted};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;">Dùng mã dưới đây để hoàn tất đăng nhập vào MiKiTimetable.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:24px;border-radius:12px;background-color:${EMAIL_THEME.surfaceSoft};border-collapse:separate;">
                  <tr>
                    <td align="center" style="padding:24px 12px 12px;color:${EMAIL_THEME.muted};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;line-height:16px;text-transform:uppercase;">Mã đăng nhập</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 4px 16px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:separate;">
                        <tr>${otpCells}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 16px 24px;color:${EMAIL_THEME.primaryDark};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:20px;">Hiệu lực 5 phút&nbsp;&nbsp;·&nbsp;&nbsp;Chỉ dùng một lần</td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:24px;border:1px solid ${EMAIL_THEME.border};border-radius:12px;border-collapse:separate;">
                  <tr>
                    <td width="40" valign="top" style="width:40px;padding:16px 0 16px 16px;">
                      <div style="width:24px;height:24px;border-radius:12px;background-color:${EMAIL_THEME.surfaceSoft};color:${EMAIL_THEME.primaryDark};font-family:Georgia,serif;font-size:16px;font-weight:700;line-height:24px;text-align:center;">i</div>
                    </td>
                    <td style="padding:16px;color:${EMAIL_THEME.muted};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px;border-top:1px solid ${EMAIL_THEME.border};color:${EMAIL_THEME.subtle};font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;">
                Email được gửi tự động, vui lòng không trả lời.<br>
                <a href="${safeWebUrl}" target="_blank" style="color:${EMAIL_THEME.primaryDark};font-weight:600;text-decoration:none;">gettimetable.cloud</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

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
    const content = buildOtpEmail(otp);
    const info = await this.transporter().sendMail({
      from,
      to,
      ...content,
    });
    if (!info.accepted?.length) {
      throw new Error(`SMTP không chấp nhận người nhận: ${info.response || 'không có phản hồi'}`);
    }
    this.logger.log(
      `SMTP đã chấp nhận OTP tới ${to.replace(/^(.{2}).*(@.*)$/, '$1***$2')} (messageId: ${info.messageId})`,
    );
  }
}
