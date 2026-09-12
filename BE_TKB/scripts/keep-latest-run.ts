import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const all = await prisma.generatedTimetable.findMany({ orderBy: { created_at: 'desc' } });
  // Mot lan chay sinh dung ba phuong an; giu tron lan chay moi nhat, bo het phan truoc do
  const stale = all.slice(3);
  console.log(`Co ${all.length} thoi khoa bieu, xoa ${stale.length} ban cu.`);
  if (process.argv.includes('--apply') && stale.length) {
    await prisma.timetableSlot.deleteMany({ where: { timetable_id: { in: stale.map((t) => t.id) } } });
    await prisma.timetableChangeLog.deleteMany({ where: { timetable_id: { in: stale.map((t) => t.id) } } });
    await prisma.generatedTimetable.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
    console.log('Da xoa.');
  }
  const left = await prisma.generatedTimetable.findMany({ orderBy: { fitness_score: 'desc' } });
  console.log('Con lai: ' + left.map((t) => `${t.name.split(' —')[0]}=${t.fitness_score}`).join(' | '));
  await prisma.$disconnect();
})();
