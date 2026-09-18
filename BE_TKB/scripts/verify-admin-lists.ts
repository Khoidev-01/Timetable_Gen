/**
 * Kiem tra that tren giao dien dang chay: phan trang va nut loc o trang Tai khoan, Lop hoc,
 * Phong hoc, va cot "Mon day" o trang Giao vien.
 *
 * Moi kiem tra doi chieu voi so lieu CSDL chu khong chi "thay nut": bang hien dung 10 dong,
 * nut loc dem dung, loc xong chi con dung nhom do. Mot trang khong lay duoc du lieu thi moi
 * phep kiem "khong thay X" deu dat mot cach rong — nen truoc het phai thay du lieu.
 *
 * Dung: npx ts-node scripts/verify-admin-lists.ts <url-giao-dien> <url-backend>
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:4001';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = app.get(JwtService).sign({ username: admin!.username, sub: admin!.id, role: admin!.role });

  const users = await prisma.user.findMany({ select: { role: true } });
  const classes = await prisma.class.findMany({ select: { grade_level: true } });
  const rooms = await prisma.room.findMany({ select: { floor: true } });

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  // API giao vien tra ve mon day
  const apiTeachers: any[] = await (await fetch(`${API}/resources/teachers`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const withSubjects = apiTeachers.filter((t) => (t.teaching_subjects ?? []).length > 0);
  check('API giao vien co mon day', withSubjects.length > 0, `${withSubjects.length}/${apiTeachers.length} giao vien, vd ${withSubjects[0]?.full_name}: ${withSubjects[0]?.teaching_subjects.map((s: any) => s.name).join(', ')}`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(
    ([t, u]: [string, string]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
    [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role, full_name: 'Admin' })],
  );

  const rows = () => page.locator('table tbody tr').count();
  const open = async (path: string) => {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(2500);
  };
  const chip = (group: string, name: RegExp) => page.getByRole('group', { name: group }).getByRole('button', { name });

  // ---------------- Tai khoan
  await open('/admin/accounts');
  const teacherCount = users.filter((u) => u.role === 'TEACHER').length;
  check('Tai khoan: trang 1 co 10 dong', (await rows()) === 10, `${await rows()} dong, CSDL co ${users.length} tai khoan`);
  const pagerText = await page.getByRole('navigation', { name: 'Phân trang tài khoản' }).innerText();
  check('Tai khoan: thanh phan trang', pagerText.includes(`trong ${users.length}`), pagerText.replace(/\s+/g, ' '));
  await chip('Lọc theo vai trò', /Quản trị viên/).click();
  await page.waitForTimeout(500);
  const adminRows = await page.locator('table tbody tr').allInnerTexts();
  check('Tai khoan: loc Quan tri vien', adminRows.length > 0 && adminRows.every((r) => r.includes('Quản trị viên')), `${adminRows.length} dong, deu la Quan tri vien`);
  await chip('Lọc theo vai trò', /Giáo viên/).click();
  await page.waitForTimeout(500);
  const teacherChip = await chip('Lọc theo vai trò', /Giáo viên/).innerText();
  check('Tai khoan: nut Giao vien dem dung', teacherChip.includes(String(teacherCount)), `nut "${teacherChip.replace(/\s+/g, ' ')}", CSDL ${teacherCount}`);
  await page.getByRole('button', { name: 'Sau' }).click();
  await page.waitForTimeout(500);
  const page2 = await page.getByRole('navigation', { name: 'Phân trang tài khoản' }).innerText();
  check('Tai khoan: sang trang 2', page2.includes('Trang 2/'), page2.replace(/\s+/g, ' '));
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/accounts.png` : 'accounts.png' });

  // ---------------- Lop hoc
  await open('/admin/classes');
  check('Lop hoc: trang 1 co 10 dong', (await rows()) === Math.min(10, classes.length), `${await rows()} dong, CSDL co ${classes.length} lop`);
  const grades = [...new Set(classes.map((c) => c.grade_level))].sort();
  for (const grade of grades) {
    await chip('Lọc lớp theo khối', new RegExp(`Khối ${grade}`)).click();
    await page.waitForTimeout(400);
    const expected = classes.filter((c) => c.grade_level === grade).length;
    const cells = await page.locator('table tbody tr td:nth-child(2)').allInnerTexts();
    const pager = await page.getByRole('navigation', { name: 'Phân trang lớp học' }).count();
    const shown = pager ? Number((await page.getByRole('navigation', { name: 'Phân trang lớp học' }).innerText()).match(/trong (\d+)/)?.[1]) : cells.length;
    check(`Lop hoc: loc Khoi ${grade}`, cells.every((c) => c.trim() === String(grade)) && shown === expected, `${shown} lop (CSDL ${expected}), cot khoi toan "${grade}"`);
  }
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/classes.png` : 'classes.png' });

  // ---------------- Phong hoc
  await page.getByRole('button', { name: /^Phòng học/ }).click();
  await page.waitForTimeout(1500);
  check('Phong hoc: trang 1 co 10 dong', (await rows()) === Math.min(10, rooms.length), `${await rows()} dong, CSDL co ${rooms.length} phong`);
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  for (const floor of floors) {
    await chip('Lọc phòng theo tầng', new RegExp(`Tầng ${floor}\\b`)).click();
    await page.waitForTimeout(400);
    const expected = rooms.filter((r) => r.floor === floor).length;
    const cells = await page.locator('table tbody tr td:nth-child(3)').allInnerTexts();
    const nav = page.getByRole('navigation', { name: 'Phân trang phòng học' });
    const shown = (await nav.count()) ? Number((await nav.innerText()).match(/trong (\d+)/)?.[1]) : cells.length;
    check(`Phong hoc: loc Tang ${floor}`, cells.every((c) => c.trim() === String(floor)) && shown === expected, `${shown} phong (CSDL ${expected})`);
  }
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/rooms.png` : 'rooms.png' });

  // ---------------- Giao vien
  await open('/admin/teachers');
  const headers = await page.locator('table thead th').allInnerTexts();
  check('Giao vien: co cot Mon day', headers.some((h) => /môn dạy/i.test(h)), headers.join(' | '));
  const firstWithSubject = withSubjects[0];
  const rowText = await page.locator('table tbody tr', { hasText: firstWithSubject.full_name }).first().innerText();
  check(
    'Giao vien: hien dung mon',
    firstWithSubject.teaching_subjects.every((s: any) => rowText.includes(s.name)),
    `${firstWithSubject.full_name}: ${rowText.replace(/\s+/g, ' ').slice(0, 120)}`,
  );
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/teachers.png` : 'teachers.png' });

  await browser.close();
  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
