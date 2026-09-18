/**
 * Chup man hinh that cac trang cua he thong dang chay (FE :3000, BE :4001) de dua vao bao cao.
 * Anh ghi vao reports/screenshots/. Dang nhap bang JWT ky truc tiep; rieng anh buoc OTP thi di
 * qua man hinh dang nhap that (tam doi mat khau admin, xong tra lai).
 *
 * Dung: npx ts-node --transpile-only scripts/capture-report-screenshots.ts (trong BE_TKB)
 */
import '../src/load-env';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB = 'http://localhost:3000';
const OUT = path.join(__dirname, '..', '..', 'reports', 'screenshots');
const TEST_PASSWORD = 'Kiemthu@2026';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const head = await prisma.teacher.findFirst({ where: { position: 'TT', department: 'Tổ Toán' }, include: { user: true } });
  const official = await prisma.generatedTimetable.findFirst({ where: { is_official: true, semester: { term_order: 1 } } });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  const shot = async (name: string, opts: any = {}) => {
    await page.waitForTimeout(opts.wait ?? 2500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false });
    console.log('  ', name);
  };
  const signIn = async (u: any, extra: any = {}) => {
    await page.goto(`${WEB}/`);
    await page.evaluate(([t, v]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', v); },
      [jwt.sign({ username: u.username, sub: u.id, role: u.role }), JSON.stringify({ id: u.id, username: u.username, role: u.role, ...extra })]);
  };
  const go = async (p: string) => page.goto(`${WEB}${p}`, { waitUntil: 'networkidle', timeout: 180000 });

  // ---------- dang nhap: buoc mat khau va buoc OTP (qua man hinh that)
  const originalHash = admin!.password_hash;
  const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379) });
  try {
    await prisma.user.update({ where: { id: admin!.id }, data: { password_hash: await bcrypt.hash(TEST_PASSWORD, 10) } });
    await redis.del(`otp:cooldown:${process.env.ADMIN_EMAIL!.toLowerCase()}`);
    const captchaIds: string[] = [];
    page.on('response', async (r: any) => { if (r.url().endsWith('/auth/captcha')) { try { captchaIds.push((await r.json()).sessionId); } catch { /* bo qua */ } } });
    await page.context().clearCookies();
    await page.goto(`${WEB}/`);
    await page.evaluate(() => localStorage.clear());
    await go('/');
    await shot('01-dang-nhap');
    const answer = await redis.get(`captcha:${captchaIds[captchaIds.length - 1]}`);
    await page.getByPlaceholder('Nhập mã giáo viên hoặc admin').fill(admin!.username);
    await page.getByPlaceholder('••••••').fill(TEST_PASSWORD);
    await page.getByPlaceholder('Nhập mã bên cạnh').fill(answer!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForSelector('form[data-step="otp"]', { timeout: 20000 });
    await page.getByPlaceholder('Nhập 6 chữ số').fill('482');
    await shot('02-dang-nhap-otp', { wait: 800 });
  } finally {
    await prisma.user.update({ where: { id: admin!.id }, data: { password_hash: originalHash } });
    redis.disconnect();
  }

  // ---------- quan tri
  await signIn(admin);
  await go('/admin'); await shot('03-tong-quan');
  await page.locator('[data-app-content]').evaluate((el: any) => el.scrollTo(0, 700)); await shot('04-tong-quan-bieu-do', { wait: 800 });
  await go('/admin/teachers'); await shot('05-giao-vien');
  await go('/admin/classes'); await shot('06-lop-hoc');
  await go('/admin/assignments'); await shot('07-phan-cong');
  await go('/admin/consolidation');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Tổng hợp', exact: true }).click();
  await page.waitForTimeout(3000);
  await shot('08-tong-hop', { fullPage: true, wait: 500 });
  await go('/admin/timetable'); await shot('09-thoi-khoa-bieu');
  await page.locator('[data-app-content]').evaluate((el: any) => el.scrollTo(0, 560)); await shot('10-thoi-khoa-bieu-luoi', { wait: 800 });
  await go('/admin/fixed-periods'); await shot('11-tiet-co-dinh', { fullPage: true });
  await go('/admin/fairness'); await shot('12-cong-bang');
  await go('/admin/configuration'); await shot('13-cau-hinh');
  await go('/admin/busy-schedule'); await shot('14-lich-ban');
  await go('/admin');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('menuitem', { name: 'Tài khoản của tôi' }).click();
  await shot('15-tai-khoan-cua-toi', { wait: 1500 });
  await page.keyboard.press('Escape');
  // tro ly AI
  const chat = page.locator('[class*="assistant-breathe"] button').first();
  if (await chat.count()) {
    const box = await chat.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await shot('16-tro-ly-ai', { wait: 1500 });
  }

  // ---------- giao vien (to truong)
  await signIn(head!.user, { full_name: head!.full_name, teacher_profile: { position: 'TT', department: head!.department } });
  await go('/teacher'); await shot('17-cong-giao-vien');
  await go('/teacher/schedule'); await shot('18-lich-ca-nhan');
  await go('/teacher/department-assignments'); await shot('19-phan-cong-to');
  await go('/teacher/swaps'); await shot('20-doi-tiet');

  // ---------- trang QR cong khai
  await page.evaluate(() => localStorage.clear());
  await go(`/xem/${official!.public_token}`); await shot('21-lien-ket-cong-khai', { fullPage: true });

  await browser.close();
  await app.close();
  console.log('Xong:', fs.readdirSync(OUT).length, 'anh');
}

main().catch((e) => { console.error(e); process.exit(1); });
