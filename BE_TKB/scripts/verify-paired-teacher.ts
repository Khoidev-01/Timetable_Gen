/**
 * Kiem tra that: ly thuyet va thuc hanh cung mon, cung lop, cung hoc ky luon cung mot giao vien.
 *
 * 1. API that tren CSDL that: sua giao vien o dong ly thuyet -> dong thuc hanh doi theo; them mot
 *    dong ly thuyet moi -> dong thuc hanh doi theo.
 * 2. Giao dien: sua giao vien o dong LT trong hop thoai -> dong TH tren bang doi ngay, roi Huy bo.
 * Moi thay doi trong CSDL duoc tra lai nhu cu o cuoi (ke ca khi hong giua chung).
 *
 * Dung: npx ts-node --transpile-only scripts/verify-paired-teacher.ts <url-giao-dien> <url-backend>
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
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  // Mot cap LT/TH cua mon Vat ly trong hoc ky dang xem tren giao dien (nam hoc 2026-2027, HK dau)
  const year = await prisma.academicYear.findFirst({ where: { name: '2026-2027' }, include: { semesters: { orderBy: { term_order: 'asc' } } } });
  const semester = year!.semesters[0];
  const subject = await prisma.subject.findFirst({ where: { code: 'LY' } });
  const cls = await prisma.class.findFirst({ where: { name: '10C1' } });
  const pair = await prisma.teachingAssignment.findMany({
    where: { semester_id: semester.id, class_id: cls!.id, subject_id: subject!.id, period_type: { in: ['THEORY', 'PRACTICE'] } },
    include: { teacher: true },
  });
  const theory = pair.find((a) => a.period_type === 'THEORY')!;
  const practice = pair.find((a) => a.period_type === 'PRACTICE')!;
  const original = new Map(pair.map((a) => [a.id, a.teacher_id]));
  const others = await prisma.teacher.findMany({ where: { major_subject: 'LY', id: { notIn: pair.map((a) => a.teacher_id) } } });
  const fallbackOthers = others.length ? others : await prisma.teacher.findMany({ where: { id: { notIn: pair.map((a) => a.teacher_id) } }, take: 2 });
  const [x, y] = fallbackOthers;
  console.log(`Cap thu: ${semester.name} ${cls!.name} Vat ly - LT ${theory.teacher.code}, TH ${practice.teacher.code}; se doi sang ${x.code}, ${y.code}`);

  let createdId: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  try {
    // ---- 1a. Sua dong ly thuyet qua API
    const put = await fetch(`${API}/assignments/${theory.id}`, { method: 'PUT', headers, body: JSON.stringify({ teacher_id: x.id }) });
    const afterPut = await prisma.teachingAssignment.findUnique({ where: { id: practice.id } });
    check('API sua LT -> TH doi theo', put.ok && afterPut!.teacher_id === x.id, `HTTP ${put.status}, TH gio la ${afterPut!.teacher_id === x.id ? x.code : afterPut!.teacher_id}`);

    // ---- 1b. Them dong ly thuyet moi qua API
    const post = await fetch(`${API}/assignments`, {
      method: 'POST', headers,
      body: JSON.stringify({ semester_id: semester.id, class_id: cls!.id, subject_id: subject!.id, teacher_id: y.id, total_periods: 1, period_type: 'THEORY' }),
    });
    createdId = post.ok ? (await post.json()).id : undefined;
    const afterPost = await prisma.teachingAssignment.findMany({ where: { id: { in: [theory.id, practice.id] } } });
    check('API them LT moi -> cac dong LT/TH cu doi theo', post.ok && afterPost.every((a) => a.teacher_id === y.id), `HTTP ${post.status}, ${afterPost.map((a) => a.period_type + '=' + (a.teacher_id === y.id ? y.code : a.teacher_id)).join(', ')}`);

    // Tra ve nhu cu truoc khi thu giao dien
    if (createdId) await prisma.teachingAssignment.delete({ where: { id: createdId } });
    createdId = undefined;
    for (const [id, teacherId] of original) await prisma.teachingAssignment.update({ where: { id }, data: { teacher_id: teacherId } });

    // ---- 2. Giao dien
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('dialog', (dialog: any) => dialog.accept());
    await page.goto(`${WEB}/`);
    await page.evaluate(([t, u]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
      [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);
    await page.goto(`${WEB}/admin/assignments`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(3000);
    await page.getByRole('tablist', { name: 'Lọc lớp thuộc khối 10' }).getByRole('tab').nth(1).click(); // 10C1: cac lop sap theo so
    await page.waitForTimeout(500);

    const table = page.locator('table.data-table').first();
    const rowOf = (label: string) => table.locator('tbody tr').filter({ hasText: 'Vật lý' }).filter({ hasText: label });
    // Hai dong co the nam o trang 2
    for (let i = 0; i < 3 && !(await rowOf('LT').count()); i++) {
      await page.getByRole('navigation', { name: 'Phân trang phân công' }).getByRole('button', { name: 'Sau' }).click();
      await page.waitForTimeout(300);
    }
    await rowOf('LT').getByRole('button', { name: 'Sửa' }).click();
    await page.waitForTimeout(1500);
    const dialog = page.locator('form').filter({ hasText: 'Giáo viên' });
    await dialog.locator('button[aria-haspopup="listbox"]').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: new RegExp(`[(]${x.code}[)]`) }).click();
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await page.waitForTimeout(600);

    const ltText = (await rowOf('LT').innerText()).replace(/\s+/g, ' ');
    const thText = (await rowOf('TH').innerText()).replace(/\s+/g, ' ');
    check('Giao dien sua LT -> dong TH doi ngay', ltText.includes(x.full_name) && thText.includes(x.full_name), `LT: ${ltText.slice(0, 40)} | TH: ${thText.slice(0, 40)}`);
    const dbBeforeSave = await prisma.teachingAssignment.findUnique({ where: { id: practice.id } });
    check('Chua bam Luu thi CSDL chua doi', dbBeforeSave!.teacher_id === original.get(practice.id), 'TH trong CSDL giu nguyen');

    await page.getByRole('button', { name: 'Hủy bỏ' }).click();
    await page.waitForTimeout(1500);
  } finally {
    if (createdId) await prisma.teachingAssignment.delete({ where: { id: createdId } }).catch(() => undefined);
    for (const [id, teacherId] of original) await prisma.teachingAssignment.update({ where: { id }, data: { teacher_id: teacherId } });
    const restored = await prisma.teachingAssignment.findMany({ where: { id: { in: [...original.keys()] } } });
    check('Da tra CSDL ve nhu cu', restored.every((a) => a.teacher_id === original.get(a.id)), restored.map((a) => a.period_type).join(', '));
    await browser.close();
  }

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
