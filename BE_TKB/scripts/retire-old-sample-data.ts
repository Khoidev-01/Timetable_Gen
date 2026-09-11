/**
 * Don bo du lieu mau cu sau khi da nhap file mau that.
 *
 * 21 giao vien va cac lop cu khong con dong phan cong nao - ho chi con duoc nhac den trong
 * cac thoi khoa bieu da sinh tu bo du lieu cu, ma nhung thoi khoa bieu do da vo nghia: chung
 * xep cho 7 lop, trong khi truong gio co 30 lop. Giu lai chi de ten hong hien ra trong moi
 * cau tra loi cua tro ly.
 *
 * Chay kem --apply moi xoa; khong co thi chi in ra xem truoc.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

(async () => {
  const orphanTeachers = await prisma.teacher.findMany({
    where: { teaching_assignments: { none: {} } },
    select: { id: true, code: true, full_name: true },
  });
  const orphanClasses = await prisma.class.findMany({
    where: { teaching_assignments: { none: {} } },
    select: { id: true, name: true },
  });

  console.log(`Giao vien khong con phan cong: ${orphanTeachers.length}`);
  console.log('  ' + orphanTeachers.map((t) => t.code).join(', '));
  console.log(`Lop khong con phan cong: ${orphanClasses.length}`);
  console.log('  ' + orphanClasses.map((c) => c.name).join(', '));

  const timetables = await prisma.generatedTimetable.count();
  const slots = await prisma.timetableSlot.count();
  console.log(`Thoi khoa bieu da sinh: ${timetables} (${slots} tiet) — deu xep tu bo du lieu cu`);

  if (!apply) {
    console.log('\nXem truoc. Them --apply de xoa that.');
    await prisma.$disconnect();
    return;
  }

  // Thu tu bat buoc: tiet tro toi giao vien bang khoa ngoai Restrict, nen phai di tu trong ra
  const overlays = await prisma.scheduleOverlay.deleteMany({});
  const swaps = await prisma.swapRequest.deleteMany({});
  const logs = await prisma.timetableChangeLog.deleteMany({});
  const deletedSlots = await prisma.timetableSlot.deleteMany({});
  const deletedTimetables = await prisma.generatedTimetable.deleteMany({});
  console.log(`Da xoa: ${overlays.count} overlay, ${swaps.count} yeu cau doi tiet, ${logs.count} nhat ky, ${deletedSlots.count} tiet, ${deletedTimetables.count} thoi khoa bieu.`);

  const removedTeachers = await prisma.teacher.deleteMany({
    where: { id: { in: orphanTeachers.map((t) => t.id) } },
  });
  const removedClasses = await prisma.class.deleteMany({
    where: { id: { in: orphanClasses.map((c) => c.id) } },
  });
  console.log(`Da xoa ${removedTeachers.count} giao vien va ${removedClasses.count} lop khong con dung den.`);

  const left = await prisma.teacher.findMany({ select: { full_name: true } });
  console.log(`Con lai ${left.length} giao vien, ${left.filter((t) => t.full_name.includes('?')).length} ten hong.`);
  await prisma.$disconnect();
})();
