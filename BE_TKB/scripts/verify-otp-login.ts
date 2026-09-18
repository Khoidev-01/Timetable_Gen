/**
 * Kiem tra that luong dang nhap hai buoc (mat khau -> ma 6 so qua email) tren API va giao dien.
 *
 * Can: backend dang chay, SMTP tro vao Mailpit (SMTP_HOST=127.0.0.1, SMTP_PORT=1026), Mailpit
 * API o http://127.0.0.1:8026. Dap an captcha doc tu Redis (script chay tren cung may chu).
 *
 * Kiem: admin nhan ma ve ADMIN_EMAIL; ma sai bi tu choi; ma dung -> JWT; giao vien chua co email
 * bi bat khai email, ma gui toi email do va email duoc luu vao ho so; nhap sai 3 lan thi ma bi
 * khoa; giao dien di het ba buoc.
 *
 * Dung: npx ts-node --transpile-only scripts/verify-otp-login.ts <url-backend> <url-giao-dien>
 */
import '../src/load-env';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const API = process.argv[2] ?? 'http://localhost:4001';
const WEB = process.argv[3] ?? 'http://localhost:3000';
const MAILPIT = process.env.MAILPIT_API ?? 'http://127.0.0.1:8026';
const TEST_PASSWORD = 'Kiemthu@2026';

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379) });

let failures = 0;
const check = (label: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
  if (!ok) failures++;
};

async function solveCaptcha() {
  const res = await fetch(`${API}/auth/captcha`, { method: 'POST' });
  const { sessionId } = await res.json();
  const answer = await redis.get(`captcha:${sessionId}`);
  if (!answer) throw new Error('Khong doc duoc dap an captcha tu Redis');
  return { captchaSessionId: sessionId, captchaCode: answer };
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function login(username: string, password: string) {
  return postJson('/auth/login', { username, password, ...(await solveCaptcha()) });
}

/** Ma OTP moi nhat Mailpit nhan cho mot dia chi. */
async function latestOtp(to: string, after: number): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const list: any = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=5`)).json();
    const fresh = (list.messages ?? []).filter((m: any) => new Date(m.Created).getTime() >= after - 2000);
    if (fresh.length) {
      const match = fresh[0].Subject.match(/(\d{6})/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL!;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const originalAdminHash = admin!.password_hash;
  const teacherUser = await prisma.user.findFirst({ where: { role: 'TEACHER' }, include: { teacher_profile: true }, orderBy: { username: 'asc' } });
  const originalTeacherHash = teacherUser!.password_hash;
  const originalTeacherEmail = teacherUser!.teacher_profile!.email;
  const testHash = await bcrypt.hash(TEST_PASSWORD, 10);

  try {
    await prisma.user.update({ where: { id: admin!.id }, data: { password_hash: testHash } });
    await prisma.user.update({ where: { id: teacherUser!.id }, data: { password_hash: testHash } });
    await prisma.teacher.update({ where: { id: teacherUser!.teacher_profile_id! }, data: { email: null } });

    // ---------------- sai mat khau: khong gui gi
    const wrong = await login(admin!.username, 'sai-mat-khau');
    check('Sai mat khau: tu choi, khong gui ma', wrong.status === 401 && !wrong.body.challenge, `HTTP ${wrong.status}`);

    // ---------------- admin
    let t0 = Date.now();
    const step1 = await login(admin!.username, TEST_PASSWORD);
    check('Admin: mat khau dung -> doi ma, chua cap JWT', step1.status < 300 && step1.body.step === 'OTP_REQUIRED' && !step1.body.access_token, `HTTP ${step1.status} ${step1.body.step} ${step1.body.emailHint}`);
    const adminOtp = await latestOtp(adminEmail, t0);
    check('Admin: Mailpit nhan duoc email co ma 6 so', !!adminOtp, adminOtp ? `ma ${adminOtp} toi ${adminEmail}` : 'khong co email');
    const bad = await postJson('/auth/otp/verify', { challenge: step1.body.challenge, otp: adminOtp === '000000' ? '111111' : '000000' });
    check('Admin: ma sai bi tu choi', bad.status === 401, `HTTP ${bad.status} ${bad.body.message}`);
    const good = await postJson('/auth/otp/verify', { challenge: step1.body.challenge, otp: adminOtp });
    check('Admin: ma dung -> JWT', good.status < 300 && !!good.body.access_token && good.body.user?.role === 'ADMIN', `HTTP ${good.status}`);
    const reuse = await postJson('/auth/otp/verify', { challenge: step1.body.challenge, otp: adminOtp });
    check('Admin: ma da dung khong dung lai duoc', reuse.status === 401, `HTTP ${reuse.status}`);
    const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${good.body.access_token}` } });
    check('JWT cap ra dung duoc', me.ok, `HTTP ${me.status}`);

    // ---------------- giao vien chua co email
    const tStep1 = await login(teacherUser!.username, TEST_PASSWORD);
    check('GV chua email: bat khai email', tStep1.body.step === 'EMAIL_REQUIRED' && !!tStep1.body.challenge, `${tStep1.body.step}`);
    const badEmail = await postJson('/auth/otp/request', { challenge: tStep1.body.challenge, email: 'khong-phai-email' });
    check('GV: email sai bi tu choi', badEmail.status === 400, `HTTP ${badEmail.status}`);
    const newEmail = `gv.kiemthu.${Date.now()}@truong.edu.vn`;
    t0 = Date.now();
    const sent = await postJson('/auth/otp/request', { challenge: tStep1.body.challenge, email: newEmail });
    check('GV: khai email -> gui ma', sent.body.step === 'OTP_REQUIRED', `${sent.body.step} ${sent.body.emailHint}`);
    const teacherOtp = await latestOtp(newEmail, t0);
    check('GV: email nhan ma', !!teacherOtp, teacherOtp ?? 'khong');
    const tGood = await postJson('/auth/otp/verify', { challenge: sent.body.challenge, otp: teacherOtp });
    const savedEmail = (await prisma.teacher.findUnique({ where: { id: teacherUser!.teacher_profile_id! } }))!.email;
    check('GV: ma dung -> JWT va email duoc luu vao ho so', tGood.status < 300 && !!tGood.body.access_token && savedEmail === newEmail, `HTTP ${tGood.status}, email trong ho so: ${savedEmail}`);

    // lan sau: khong hoi email nua, gui thang ma (xoa cooldown 60s cua chot chong spam de khoi phai doi)
    await redis.del(`otp:cooldown:${newEmail}`);
    t0 = Date.now();
    const again = await login(teacherUser!.username, TEST_PASSWORD);
    check('GV: lan sau gui thang ma toi email da luu', again.body.step === 'OTP_REQUIRED', `${again.body.step} ${again.body.emailHint}`);
    await latestOtp(newEmail, t0);
    // nhap sai 3 lan -> khoa
    let last = 0;
    for (let i = 0; i < 3; i++) last = (await postJson('/auth/otp/verify', { challenge: again.body.challenge, otp: '000000' })).status;
    const locked = await postJson('/auth/otp/verify', { challenge: again.body.challenge, otp: '000000' });
    check('Sai 3 lan: ma bi khoa', last === 401 && locked.status === 401 && /quá 3 lần|mã mới/i.test(locked.body.message ?? ''), `${locked.body.message}`);

    // ---------------- chong spam gui ma: cung email, xin lai ngay -> 429 kem so giay phai doi
    const spam = await postJson('/auth/otp/request', { challenge: again.body.challenge });
    check('Gui lai ngay bi chan 60 giay', spam.status === 429 && /\d+ giây/.test(spam.body.message ?? ''), `HTTP ${spam.status} ${spam.body.message}`);
    // Ep het cooldown, don qua 5 ma/gio -> chan theo gio
    await redis.del(`otp:cooldown:${newEmail}`);
    await redis.set(`otp:hourly:${newEmail}`, '5', 'EX', 3600);
    const hourly = await postJson('/auth/otp/request', { challenge: again.body.challenge });
    check('Qua 5 ma/gio bi chan', hourly.status === 429 && /5 mã/.test(hourly.body.message ?? ''), `HTTP ${hourly.status} ${hourly.body.message}`);
    await redis.del(`otp:hourly:${newEmail}`);
    // Admin cung vua nhan ma o tren: xoa cooldown de buoc giao dien khong bi chan
    await redis.del(`otp:cooldown:${adminEmail.toLowerCase()}`, `otp:hourly:${adminEmail.toLowerCase()}`);
    // Doi het gioi han 5 lan dang nhap/phut cua /auth/login truoc khi thu giao dien
    await new Promise((r) => setTimeout(r, 61_000));

    // ---------------- giao dien
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require('../../FE_TKB/node_modules/playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e: any) => errors.push(String(e)));
    // Bat sessionId cua captcha dang hien de doc dap an tu Redis
    const captchaIds: string[] = [];
    page.on('response', async (r: any) => {
      if (r.url().endsWith('/auth/captcha')) {
        try { captchaIds.push((await r.json()).sessionId); } catch { /* bo qua */ }
      }
    });
    await page.goto(`${WEB}/`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(1500);
    const answer = await redis.get(`captcha:${captchaIds[captchaIds.length - 1]}`);
    check('Giao dien: doc duoc captcha dang hien', !!answer, `${captchaIds.length} captcha`);
    await page.getByPlaceholder('Nhập mã giáo viên hoặc admin').fill(admin!.username);
    await page.getByPlaceholder('••••••').fill(TEST_PASSWORD);
    await page.getByPlaceholder('Nhập mã bên cạnh').fill(answer!);
    t0 = Date.now();
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await Promise.race([
      page.waitForSelector('form[data-step="otp"]', { timeout: 15000 }),
      page.waitForSelector('.text-red-500', { timeout: 15000 }),
    ]);
    const uiError = await page.locator('.text-red-500').first().innerText().catch(() => '');
    check('Giao dien: sang buoc nhap ma', (await page.locator('form[data-step="otp"]').count()) === 1, uiError || 'ok');
    const uiOtp = await latestOtp(adminEmail, t0);
    await page.getByPlaceholder('Nhập 6 chữ số').fill(uiOtp!);
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await page.waitForURL(/\/admin/, { timeout: 20000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    check('Giao dien: nhap ma -> vao trang quan tri, co token', page.url().includes('/admin') && !!token, page.url());
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/otp-login.png` : 'otp-login.png' });
    check('Giao dien khong loi JS', errors.length === 0, errors.join(' | ') || 'khong');
    await browser.close();
  } finally {
    await prisma.user.update({ where: { id: admin!.id }, data: { password_hash: originalAdminHash } });
    await prisma.user.update({ where: { id: teacherUser!.id }, data: { password_hash: originalTeacherHash } });
    await prisma.teacher.update({ where: { id: teacherUser!.teacher_profile_id! }, data: { email: originalTeacherEmail } });
    await prisma.authUser.deleteMany({ where: { email: { contains: 'gv.kiemthu.' } } });
    await prisma.$disconnect();
    redis.disconnect();
  }

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
