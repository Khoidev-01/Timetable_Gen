/**
 * Kiem tra that: tao phong qua hop thoai voi mot loai phong chuc nang, CSDL nhan, bang hien
 * dung nhan, va khong con phong nao de trong cot Loai. Xoa phong thu sau khi kiem.
 *
 * Dung: npx ts-node --transpile-only scripts/verify-room-types.ts <url-giao-dien>
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB = process.argv[2] ?? 'http://localhost:3000';
const TEST_ROOM = 'ZZ-THU-KIEM';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const token = app.get(JwtService).sign({ username: admin!.username, sub: admin!.id, role: admin!.role });

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('../../FE_TKB/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${WEB}/`);
  await page.evaluate(([t, u]: string[]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
    [token, JSON.stringify({ id: admin!.id, username: admin!.username, role: admin!.role })]);

  try {
    await page.goto(`${WEB}/admin/classes`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /^Phòng học/ }).click();
    await page.waitForTimeout(1500);

    // Moi phong trong bang deu co nhan loai (duyet het cac trang)
    const emptyTypes: string[] = [];
    for (;;) {
      const rows = await page.locator('table tbody tr').all();
      for (const row of rows) {
        const cells = await row.locator('td').allInnerTexts();
        if (cells.length >= 2 && cells[1].trim() === '') emptyTypes.push(cells[0].trim());
      }
      const next = page.getByRole('button', { name: 'Sau' });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
      await page.waitForTimeout(300);
    }
    const roomCount = await prisma.room.count();
    check('Khong phong nao trong cot Loai', emptyTypes.length === 0, emptyTypes.length ? `trong: ${emptyTypes.join(', ')}` : `da duyet ${roomCount} phong`);

    // Tao phong Tin hoc qua hop thoai
    await page.getByRole('button', { name: /Thêm phòng học/ }).click();
    await page.waitForTimeout(500);
    const dialog = page.locator('div.fixed').filter({ hasText: 'Thêm phòng học' }).last();
    await dialog.locator('input').first().fill(TEST_ROOM);
    await dialog.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByRole('option', { name: 'Phòng Tin học' }).click().catch(async () => {
      await page.getByText('Phòng Tin học', { exact: true }).last().click();
    });
    await dialog.getByRole('button', { name: /Lưu|Thêm/ }).last().click();
    await page.waitForTimeout(1500);

    const saved = await prisma.room.findFirst({ where: { name: TEST_ROOM } });
    check('CSDL nhan loai phong chuc nang', saved?.type === 'LAB_IT', saved ? `luu voi loai ${saved.type}` : 'KHONG luu duoc');
  } finally {
    const removed = await prisma.room.deleteMany({ where: { name: TEST_ROOM } });
    check('Da xoa phong thu', (await prisma.room.count({ where: { name: TEST_ROOM } })) === 0, `xoa ${removed.count} phong`);
    await browser.close();
  }

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
