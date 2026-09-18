/**
 * Kiem tra that nut tro ly keo duoc va chi do o hai goc duoi (trai / phai).
 *
 * Dung: npx ts-node --transpile-only scripts/verify-assistant-dock.ts <url-giao-dien>
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB = process.argv[2] ?? 'http://localhost:3000';

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
  const width = 1440;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(([t, u]: string[]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', u);
    localStorage.removeItem('assistant-dock-side');
  }, [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2000);

  const button = page.getByRole('button', { name: /Mở trợ lý MiKi/ });
  const center = async () => {
    const box = await button.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };
  const panel = page.getByText('Trợ lý thời khóa biểu');
  // Nut co hieu ung "tho" nen khong bao gio dung yen de Playwright bam kieu mac dinh; bam chuot that tai tam nut
  const tap = async () => {
    const c = await center();
    await page.mouse.click(c.x, c.y);
  };
  const closeButton = page.getByRole('button', { name: 'Đóng' });

  const start = await center();
  check('Mac dinh o goc phai', start.x > width / 2 && start.box.y > 700, `x=${Math.round(start.x)}, y=${Math.round(start.box.y)}`);

  // Bam thuong: van mo chat
  await tap();
  await page.waitForTimeout(600);
  check('Bam thuong mo chat', await panel.isVisible(), 'khung chat hien');
  await closeButton.click();
  await page.waitForTimeout(400);

  // Keo sang nua trai, tha giua man hinh phia tren
  const drag = async (toX: number, toY: number) => {
    const from = await center();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((toX - from.x) * i) / 10, from.y + ((toY - from.y) * i) / 10);
    await page.mouse.up();
    await page.waitForTimeout(500);
  };
  await drag(300, 300);
  const left = await center();
  check('Tha nua trai -> nhay ve goc duoi trai', left.x < width / 2 && left.box.y > 700, `x=${Math.round(left.x)}, y=${Math.round(left.box.y)}`);
  // Khong duoc de len thanh menu, nhat la nut Dang xuat o goc duoi trai
  const sidebar = await page.locator('[data-app-sidebar]').boundingBox();
  const logout = await page.getByRole('button', { name: /Đăng xuất/ }).first().boundingBox();
  const overlaps = (a: any, b: any) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  check('Ben trai nam ngoai thanh menu', Boolean(sidebar) && left.box.x >= sidebar.x + sidebar.width, `nut x=${Math.round(left.box.x)}, mep phai thanh menu=${Math.round((sidebar?.x ?? 0) + (sidebar?.width ?? 0))}`);
  check('Khong de len nut Dang xuat', !overlaps(left.box, logout), logout ? `Dang xuat o x=${Math.round(logout.x)} y=${Math.round(logout.y)}` : 'khong thay nut Dang xuat');
  check('Keo xong khong tu mo chat', !(await panel.isVisible()), 'khung chat khong hien');
  check('Nho vi tri', (await page.evaluate(() => localStorage.getItem('assistant-dock-side'))) === 'left', 'localStorage = left');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const afterReload = await center();
  check('Tai lai trang van o ben trai', afterReload.x < width / 2, `x=${Math.round(afterReload.x)}`);

  await tap();
  await page.waitForTimeout(600);
  const panelOpen = await panel.isVisible();
  const panelBox = panelOpen ? await panel.boundingBox() : null;
  if (!panelOpen) await page.screenshot({ path: (process.env.SHOT ?? 'dock-left.png').replace('.png', '-fail.png') });
  check('Khung chat mo cung phia trai', Boolean(panelBox) && panelBox.x < width / 2, panelOpen ? `tieu de khung chat x=${Math.round(panelBox?.x ?? -1)}` : 'khung chat KHONG mo');
  await page.screenshot({ path: process.env.SHOT ?? 'dock-left.png' });
  if (panelOpen) await closeButton.click();
  await page.waitForTimeout(400);

  await drag(width - 300, 400);
  const right = await center();
  check('Tha nua phai -> ve goc duoi phai', right.x > width / 2 && right.box.y > 700, `x=${Math.round(right.x)}, y=${Math.round(right.box.y)}`);

  await browser.close();
  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
