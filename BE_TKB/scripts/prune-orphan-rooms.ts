/**
 * Xoa nhung phong co trong CSDL ma file mau khong con khai.
 *
 * Nhap la upsert: no them va cap nhat, khong xoa. Nen mot phong da bo khoi file van nam lai
 * trong CSDL, va bo giai se xep tiet vao mot phong khong ton tai tren giay.
 */
import '../src/load-env';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const prisma = new PrismaClient();

(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);
  const sheet = book.getWorksheet('DM_Phong')!;
  const declared = new Set<string>();
  for (let r = 3; r <= sheet.rowCount; r++) {
    const name = String(sheet.getRow(r).getCell(1).value ?? '').trim();
    if (name) declared.add(name);
  }

  const rooms = await prisma.room.findMany({ select: { id: true, name: true } });
  const orphans = rooms.filter((r) => !declared.has(r.name));
  console.log(`File mau khai ${declared.size} phong; CSDL co ${rooms.length}.`);
  console.log(`Phong khong con trong file: ${orphans.map((o) => o.name).join(', ') || '(khong co)'}`);

  if (process.argv.includes('--apply') && orphans.length) {
    const ids = orphans.map((o) => o.id);
    await prisma.timetableSlot.updateMany({ where: { room_id: { in: ids } }, data: { room_id: null } });
    await prisma.class.updateMany({ where: { fixed_room_id: { in: ids } }, data: { fixed_room_id: null } });
    const removed = await prisma.room.deleteMany({ where: { id: { in: ids } } });
    console.log(`Da xoa ${removed.count} phong.`);
  }
  await prisma.$disconnect();
})();
