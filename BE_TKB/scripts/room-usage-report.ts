import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const tt = await prisma.generatedTimetable.findFirst({ orderBy: { fitness_score: 'desc' } });
  const slots = await prisma.timetableSlot.findMany({
    where: { timetable_id: tt!.id },
    include: { subject: { select: { code: true } }, room: { select: { name: true, type: true } } },
  });

  const bySubject = new Map<string, Map<string, number>>();
  for (const s of slots) {
    if (!['TIN', 'LY', 'HOA', 'SINH', 'GDTC', 'GDQP'].includes(s.subject.code)) continue;
    if (!bySubject.has(s.subject.code)) bySubject.set(s.subject.code, new Map());
    const key = `${s.room?.name ?? 'khong co'} (${s.room?.type ?? '-'})`;
    const m = bySubject.get(s.subject.code)!;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  for (const [code, rooms] of bySubject) {
    console.log(`${code}: ` + [...rooms].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}=${n}`).join(' '));
  }

  // Trung phong: hai tiet cung phong cung gio
  const seen = new Map<string, number>();
  let clashes = 0;
  for (const s of slots) {
    if (!s.room_id) continue;
    const key = `${s.room_id}|${s.day}|${s.period}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) clashes++;
  }
  console.log(`\nTiet bi trung phong: ${clashes}`);
  await prisma.$disconnect();
})();
