import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const all = await prisma.teachingAssignment.findMany({
    where: { semester_id: semester!.id },
    include: { subject: { select: { code: true, is_special: true } } },
  });
  const teachers = await prisma.teacher.findMany({ select: { id: true, code: true, max_periods_per_week: true } });
  const quota = new Map(teachers.map((t) => [t.id, t.max_periods_per_week]));

  const assignments = all.filter((a) => !a.subject.is_special);
  const load = new Map<string, number>();
  for (const a of assignments) load.set(a.teacher_id, (load.get(a.teacher_id) ?? 0) + a.total_periods);

  const perSubject = new Map<string, { need: number; team: Set<string> }>();
  for (const a of assignments) {
    const e = perSubject.get(a.subject.code) ?? { need: 0, team: new Set<string>() };
    e.need += a.total_periods;
    e.team.add(a.teacher_id);
    perSubject.set(a.subject.code, e);
  }

  console.log('Mon    | can | suc chua to | con du | nguoi da kin');
  console.log('-------|-----|-------------|--------|-------------');
  for (const [code, e] of [...perSubject].sort((a, b) => b[1].need - a[1].need)) {
    const capacity = [...e.team].reduce((s, id) => s + (quota.get(id) ?? 17), 0);
    const full = [...e.team].filter((id) => (load.get(id) ?? 0) >= (quota.get(id) ?? 17)).length;
    const slack = capacity - e.need;
    console.log(`${code.padEnd(6)} | ${String(e.need).padStart(3)} | ${String(capacity).padStart(11)} | ${String(slack).padStart(6)} | ${full}/${e.team.size}`);
  }
  await prisma.$disconnect();
})();
