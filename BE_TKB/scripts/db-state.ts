import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const years = await prisma.academicYear.findMany({ include: { semesters: true } });
  console.log('Nam hoc:', years.map((y) => `${y.id} "${y.name}" (${y.semesters.length} hoc ky)`).join(' | '));
  years.forEach((y) => y.semesters.forEach((s) => console.log(`   HK ${s.term_order}: ${s.id} "${s.name}"`)));
  console.log('Giao vien:', await prisma.teacher.count());
  console.log('Lop:', await prisma.class.count());
  console.log('Mon:', await prisma.subject.count());
  console.log('Phong:', await prisma.room.count());
  console.log('Phan cong:', await prisma.teachingAssignment.count());
  console.log('TKB da sinh:', await prisma.generatedTimetable.count());
  console.log('Tiet trong TKB:', await prisma.timetableSlot.count());
  await prisma.$disconnect();
})();
