import { buildOtpEmail } from './mail.service';

describe('buildOtpEmail', () => {
  it('renders a branded, accessible OTP email', () => {
    const email = buildOtpEmail('141703', 'https://gettimetable.cloud/');

    expect(email.subject).toBe('141703 là mã đăng nhập MiKiTimetable');
    expect(email.text).toContain('Mã đăng nhập của bạn: 141703');
    expect(email.text).toContain('Mã có hiệu lực trong 5 phút');
    expect(email.html).toContain('lang="vi"');
    expect(email.html).toContain('alt="MiKiTimetable"');
    expect(email.html).toContain('src="https://gettimetable.cloud/logo.png"');
    expect(email.html).toContain('Xác nhận đăng nhập');
    expect(email.html).toContain('Hiệu lực 5 phút');
    expect(email.html).not.toContain('141703</td>');
    expect((email.html.match(/line-height:48px/g) ?? [])).toHaveLength(6);
  });

  it('escapes characters before inserting them into HTML', () => {
    const email = buildOtpEmail('12<456', 'https://example.com/?a=1&b=2');

    expect(email.html).toContain('&lt;');
    expect(email.html).not.toContain('> < </td>');
    expect(email.html).toContain('href="https://example.com/?a=1&amp;b=2"');
  });
});
