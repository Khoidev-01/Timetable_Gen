/**
 * Kiem tra that kieu bang danh sach va thanh cuon noi tren giao dien dang chay.
 *
 * Moi bang: mot co chu cho moi o, tieu de chu thuong va can giua, co duong ke chia cot, bo cuc
 * co dinh, do rong cot khong doi khi chuyen trang. Vung cuon: thanh cuon goc khong chiem be
 * ngang, thanh cuon noi hien va keo duoc.
 *
 * Dung: npx ts-node --transpile-only scripts/verify-data-tables.ts <url-giao-dien>
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB = process.argv[2] ?? 'http://localhost:3000';
const SHOTS = process.env.SHOT_DIR;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const admin = await app.get(PrismaService).user.findFirst({ where: { role: 'ADMIN' } });
  const token = app.get(JwtService).sign({ username: admin!.username, sub: admin!.id, role: admin!.role });

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(([t, u]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
    [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);

  const inspect = () => page.$$eval('table.data-table', (tables: any[]) => tables.map((table) => {
    const ths = [...table.querySelectorAll('thead th')];
    const fonts = new Set<string>();
    for (const td of table.querySelectorAll('tbody td:not([colspan])')) {
      fonts.add(getComputedStyle(td).fontSize);
      for (const child of td.querySelectorAll('*')) {
        if ((child as HTMLElement).innerText?.trim()) fonts.add(getComputedStyle(child).fontSize);
      }
    }
    for (const th of ths) fonts.add(getComputedStyle(th).fontSize);
    const firstTh = ths[0];
    return {
      headers: ths.map((th: any) => th.innerText.trim()),
      notCentered: ths.filter((th: any) => getComputedStyle(th).textAlign !== 'center').map((th: any) => th.innerText.trim()),
      upper: ths.some((th: any) => getComputedStyle(th).textTransform === 'uppercase'),
      fonts: [...fonts],
      layout: getComputedStyle(table).tableLayout,
      divider: firstTh ? getComputedStyle(firstTh).borderRightWidth : '0px',
      widths: ths.map((th: any) => Math.round(th.getBoundingClientRect().width)),
      rows: table.querySelectorAll('tbody tr').length,
    };
  }));

  const pages: Array<[string, string, (() => Promise<void>)?]> = [
    ['Tai khoan', '/admin/accounts'],
    ['Lop hoc', '/admin/classes'],
    ['Phong hoc', '/admin/classes', async () => { await page.getByRole('button', { name: /^Phòng học/ }).click(); await page.waitForTimeout(1500); }],
    ['Giao vien', '/admin/teachers'],
    ['Mon hoc', '/admin/subjects'],
    ['Phan cong', '/admin/assignments'],
    ['Lich ban GV', '/admin/busy-schedule'],
  ];

  for (const [name, path, before] of pages) {
    await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(2500);
    if (before) await before();
    const tables = await inspect();
    if (tables.length === 0) {
      check(`${name}`, false, 'khong thay bang data-table nao');
      continue;
    }
    for (const [i, t] of tables.entries()) {
      const label = tables.length > 1 ? `${name} (bang ${i + 1})` : name;
      check(`${label}: mot co chu`, t.fonts.length === 1, `co chu: ${t.fonts.join(', ')} (${t.rows} dong)`);
      check(`${label}: tieu de can giua, chu thuong`, t.notCentered.length === 0 && !t.upper, t.notCentered.length ? `chua can giua: ${t.notCentered.join(', ')}` : t.headers.join(' | '));
      check(`${label}: co dinh + ke cot`, t.layout === 'fixed' && t.divider !== '0px', `layout=${t.layout}, ke cot=${t.divider}`);
    }
    if (SHOTS && ['Giao vien', 'Lop hoc'].includes(name)) await page.screenshot({ path: `${SHOTS}/table-${path.split('/').pop()}.png` });
  }

  // Do rong cot khong doi khi chuyen trang
  await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2000);
  const before = (await inspect())[0].widths;
  await page.getByRole('button', { name: 'Sau' }).click();
  await page.waitForTimeout(600);
  const after = (await inspect())[0].widths;
  check('Chuyen trang khong doi do rong cot', JSON.stringify(before) === JSON.stringify(after), `${before.join('/')} -> ${after.join('/')}`);

  // Thanh cuon
  await page.goto(`${WEB}/admin/teachers`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2500);
  const scroll = await page.evaluate(() => {
    const main = document.querySelector('[data-app-content]') as HTMLElement;
    return { offset: main.offsetWidth, client: main.clientWidth, scrollable: main.scrollHeight > main.clientHeight };
  });
  check('Thanh cuon goc khong chiem be ngang', scroll.offset === scroll.client, `offsetWidth=${scroll.offset}, clientWidth=${scroll.client}, trang dai=${scroll.scrollable}`);
  const thumb = page.locator('[data-overlay-scroll-thumb]');
  check('Co thanh cuon noi', (await thumb.count()) === 1, `so thanh: ${await thumb.count()}`);
  if (await thumb.count()) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    const box = await thumb.boundingBox();
    const startTop = await page.evaluate(() => (document.querySelector('[data-app-content]') as HTMLElement).scrollTop);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 5 });
    await page.mouse.up();
    const endTop = await page.evaluate(() => (document.querySelector('[data-app-content]') as HTMLElement).scrollTop);
    check('Keo thanh cuon noi thi trang cuon', endTop > startTop, `scrollTop ${startTop} -> ${endTop}`);
    const pageRight = await page.evaluate(() => {
      const table = document.querySelector('table.data-table') as HTMLElement;
      return Math.round(table.getBoundingClientRect().right);
    });
    check('Thanh cuon nam de len, khong dat canh bang', box.x < pageRight + 40, `thanh o x=${Math.round(box.x)}, mep phai bang=${pageRight}`);
  }

  await browser.close();
  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
