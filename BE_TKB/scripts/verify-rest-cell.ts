/**
 * Kiem tra that luong "Nghi - khong hoc" o trang Tiet co dinh, tu giao dien toi thuat toan:
 *
 *   1. chon mot o, chon "Nghi (khong hoc)", ghim -> o to do
 *   2. quy tac luu dung: ma NGHI, ap cho moi buoi
 *   3. bo cham dem moi tiet dang nam o o do thanh loi cung "Xep tiet vao o nghi"
 *   4. xoa quy tac thu, de khong de lai du lieu thu trong CSDL
 *
 * Dung: npx ts-node --transpile-only scripts/verify-rest-cell.ts <url-giao-dien> <url-backend> [thu] [tiet]
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConstraintService, REST_SUBJECT_CODE, TimeSlot } from '../src/algorithm/constraint.service';

const WEB = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:4001';
const DAY = Number(process.argv[4] ?? 7);
const PERIOD = Number(process.argv[5] ?? 4);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const constraints = app.get(ConstraintService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = app.get(JwtService).sign({ username: admin!.username, sub: admin!.id, role: admin!.role });
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  const before: any[] = await (await fetch(`${API}/tiet-co-dinh`, { headers: auth })).json();
  if (before.some((r) => r.subject_code === REST_SUBJECT_CODE)) throw new Error('Da co san quy tac nghi — dung lai de khong dung vao du lieu that');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(([t, u]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
    [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);
  await page.goto(`${WEB}/admin/fixed-periods`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2500);

  let restRuleId: string | undefined;
  try {
    const cell = page.locator('table tbody tr').nth(PERIOD - 1).locator('td').nth(DAY - 2).locator('button');
    await cell.click();
    // O trong tren luoi cung ghi "Chon mon", nen tim dung nut mo danh sach cua o chon mon
    await page.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByText('Nghỉ (không học)', { exact: true }).click();
    await page.getByRole('button', { name: /Ghim vào ô đã chọn/ }).click();
    await page.waitForTimeout(2500);

    const cellClass = (await cell.getAttribute('class')) ?? '';
    const cellText = await cell.innerText();
    check('O to do sau khi ghim', cellClass.includes('bg-red-100') && cellText.includes('Nghỉ - không học'), `class co bg-red-100: ${cellClass.includes('bg-red-100')}, chu: "${cellText.replace(/\s+/g, ' ')}"`);
    await page.screenshot({ path: process.env.SHOT ?? 'rest-cell.png' });

    const after: any[] = await (await fetch(`${API}/tiet-co-dinh`, { headers: auth })).json();
    const rule = after.find((r) => r.subject_code === REST_SUBJECT_CODE);
    restRuleId = rule?.id;
    check('Quy tac luu dung', Boolean(rule) && rule.day_of_week === DAY && rule.period === PERIOD && rule.main_session === null,
      rule ? `ma ${rule.subject_code}, thu ${rule.day_of_week} tiet ${rule.period}, buoi ${rule.main_session}` : 'khong thay');

    // Bo cham: moi tiet cua ban chinh thuc dang nam o o nay la mot loi cung
    const official = await prisma.generatedTimetable.findFirst({ where: { is_official: true }, include: { slots: true } });
    await constraints.initialize(official!.semester_id);
    const slots: TimeSlot[] = official!.slots.map((s) => ({
      id: s.id, day: s.day, period: s.period, classId: s.class_id, subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
    }));
    const inCell = slots.filter((s) => s.day === DAY && s.period === PERIOD).length;
    const detail = constraints.getFitnessDetails(slots);
    const counted = detail.breakdown.hard.find((h: any) => h.label === 'Xếp tiết vào ô nghỉ')?.count ?? 0;
    check('Bo cham dem dung', counted === inCell, `ban chinh thuc co ${inCell} tiet o thu ${DAY} tiet ${PERIOD}, bo cham dem ${counted} loi cung "Xếp tiết vào ô nghỉ"`);
  } finally {
    if (restRuleId) {
      const del = await fetch(`${API}/tiet-co-dinh/${restRuleId}`, { method: 'DELETE', headers: auth });
      const left: any[] = await (await fetch(`${API}/tiet-co-dinh`, { headers: auth })).json();
      check('Da xoa quy tac thu', del.ok && !left.some((r) => r.subject_code === REST_SUBJECT_CODE) && left.length === before.length,
        `HTTP ${del.status}, con ${left.length} quy tac (truoc ${before.length})`);
    }
    await browser.close();
  }

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
