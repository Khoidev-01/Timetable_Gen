/**
 * Xoa du lieu cua truong de nap lai bo du lieu mau tu dau.
 *
 * Xoa: giao vien (kem tai khoan giao vien), lop, phong, to hop, phan cong, thoi khoa bieu da
 * sinh, lich ban, yeu cau doi tiet, lop phu lich, nhat ky sua, thong bao.
 * Giu:  tai khoan quan tri, nam hoc va hoc ky, danh muc mon, tiet co dinh, bo quy tac dinh luong
 *       (constraint_settings), kho tri thuc cua tro ly.
 *
 * Sao luu CSDL truoc khi chay. Chay kem --apply moi xoa; khong co thi chi dem.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

(async () => {
  const counts = {
    'nhat ky sua TKB': await prisma.timetableChangeLog.count(),
    'tiet trong TKB': await prisma.timetableSlot.count(),
    'TKB da sinh': await prisma.generatedTimetable.count(),
    'yeu cau doi tiet': await prisma.swapRequest.count(),
    'lop phu lich': await prisma.scheduleOverlay.count(),
    'lich ban GV': await prisma.teacherBusyRequest.count(),
    'thong bao': await prisma.notification.count(),
    'phan cong': await prisma.teachingAssignment.count(),
    'rang buoc rieng GV': await prisma.teacherConstraint.count(),
    'tai khoan giao vien': await prisma.user.count({ where: { role: 'TEACHER' } }),
    lop: await prisma.class.count(),
    'giao vien': await prisma.teacher.count(),
    phong: await prisma.room.count(),
    'to hop': await prisma.curriculumCombination.count(),
  };
  console.log('Se xoa:');
  for (const [label, n] of Object.entries(counts)) console.log(`  ${label}: ${n}`);
  console.log('Giu lai:', {
    'tai khoan quan tri': await prisma.user.count({ where: { role: 'ADMIN' } }),
    'nam hoc': await prisma.academicYear.count(),
    'hoc ky': await prisma.semester.count(),
    mon: await prisma.subject.count(),
    'tiet co dinh': await prisma.fixedPeriodRule.count(),
    'quy tac dinh luong': await prisma.constraintSetting.count(),
    'kho tri thuc': await prisma.knowledgeChunk.count(),
  });

  if (!apply) {
    console.log('\n(xem truoc - chay kem --apply de xoa)');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.timetableChangeLog.deleteMany();
    await tx.timetableSlot.deleteMany();
    await tx.swapRequest.deleteMany();
    await tx.scheduleOverlay.deleteMany();
    await tx.generatedTimetable.deleteMany();
    await tx.teacherBusyRequest.deleteMany();
    await tx.notification.deleteMany();
    await tx.teachingAssignment.deleteMany();
    await tx.teacherConstraint.deleteMany();
    await tx.user.deleteMany({ where: { role: 'TEACHER' } });
    await tx.class.deleteMany();
    await tx.teacher.deleteMany();
    await tx.room.deleteMany();
    await tx.curriculumCombination.deleteMany();
  }, { timeout: 120_000 });

  console.log('\nDa xoa. Con lai:', {
    'giao vien': await prisma.teacher.count(),
    lop: await prisma.class.count(),
    phong: await prisma.room.count(),
    'phan cong': await prisma.teachingAssignment.count(),
    'TKB da sinh': await prisma.generatedTimetable.count(),
    'tai khoan': await prisma.user.count(),
    'tiet co dinh': await prisma.fixedPeriodRule.count(),
    'quy tac dinh luong': await prisma.constraintSetting.count(),
  });
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
