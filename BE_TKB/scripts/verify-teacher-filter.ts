/**
 * Kiem tra that trang Giao vien: phan trang 10 dong, loc theo mon dem dung va chi con giao vien
 * day mon do, Chao co / Sinh hoat khong con la "mon day", nut Sua/Xoa nam tren mot dong.
 *
 * Dung: npx ts-node --transpile-only scripts/verify-teacher-filter.ts <url-giao-dien> <url-backend>
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
  const admin = await app.get(PrismaService).user.findFirst({ where: { role: 'ADMIN' } });
  const token = app.get(JwtService).sign({ username: admin!.username, sub: admin!.id, role: admin!.role });

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  const teachers: any[] = await (await fetch(`${API}/resources/teachers`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const ceremony = teachers.filter((t) => t.teaching_subjects.some((s: any) => ['CHAO_CO', 'SH_CUOI_TUAN'].includes(s.code)));
  check('API: khong ai "day" Chao co / Sinh hoat', ceremony.length === 0, `${ceremony.length} giao vien con gan`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(([t, u]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
    [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);
  await page.goto(`${WEB}/admin/teachers`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2500);

  const rows = () => page.locator('table tbody tr').count();
  const nav = page.getByRole('navigation', { name: 'Phân trang giáo viên' });
  check('Trang 1 co 10 dong', (await rows()) === 10, `${await rows()} dong / ${teachers.length} giao vien`);
  check('Thanh phan trang', (await nav.innerText()).includes(`trong ${teachers.length}`), (await nav.innerText()).replace(/\s+/g, ' '));

  // Sua/Xoa tren mot dong
  const actions = await page.$$eval('table tbody tr', (trs: any[]) => trs.map((tr) => {
    const b = [...tr.querySelectorAll('.row-action')].map((x: any) => x.getBoundingClientRect());
    return b.length === 2 ? Math.abs(b[0].top - b[1].top) < 2 : true;
  }));
  check('Sua/Xoa cung mot dong', actions.every(Boolean), `${actions.filter(Boolean).length}/${actions.length} dong`);

  const trigger = page.getByRole('button', { name: 'Lọc giáo viên theo môn dạy' });
  await trigger.click();
  await page.waitForTimeout(400);
  const options = await page.getByRole('option').allInnerTexts();
  check('Danh sach mon khong co Chao co / Sinh hoat', !options.some((o) => /Chào cờ|Sinh hoạt/.test(o)), options.join(' | '));
  await page.keyboard.press('Escape');

  const subjects = new Map<string, { name: string; ids: Set<string> }>();
  for (const t of teachers) for (const s of t.teaching_subjects) {
    const e = subjects.get(String(s.id)) ?? { name: s.name, ids: new Set() };
    e.ids.add(t.id); subjects.set(String(s.id), e);
  }
  for (const { name, ids } of [...subjects.values()]) {
    await trigger.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: new RegExp(`^${name} [(]`) }).click();
    await page.waitForTimeout(400);
    const total = (await nav.count()) ? Number((await nav.innerText()).match(/trong (\d+)/)?.[1]) : await rows();
    const cells = await page.locator('table tbody tr td:nth-child(3)').allInnerTexts();
    const allTeach = cells.every((c) => c.split(',').map((x) => x.trim()).includes(name));
    check(`Loc ${name}`, total === ids.size && allTeach, `${total} giao vien (API ${ids.size}), cot mon deu co "${name}"`);
    if (name === 'Vật lý') await page.screenshot({ path: `${process.env.SHOT_DIR ?? '.'}/teachers-filter.png` });
  }

  await browser.close();
  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
