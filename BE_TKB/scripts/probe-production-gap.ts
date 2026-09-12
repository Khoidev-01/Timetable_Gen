/**
 * Cung ngan sach, vi sao duong chay that kem hon phep do co lap 550 diem?
 *
 * Phep do co lap dung tu mot luoi trong. Duong chay that thi nap truoc nhung tiet da bi
 * khoa cua lan xep gan nhat — tinh nang giu cho nhung tiet quan tri vien da ghim — roi moi
 * dung tiep tu do. Day la khac biet duy nhat giua hai duong, nen do thang no.
 *
 * Neu con so lech dung o day, thi moi lan xep lai deu bi lan truoc keo xuong, va cang xep
 * lai nhieu lan thi cang te — mot thu khong ai nhin thay tu giao dien.
 */
import '../src/load-env';
import { writeSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService, TimeSlot } from '../src/algorithm/constraint.service';

const say = (line = '') => writeSync(1, `${line}\n`);
const RUNS = Number(process.argv[2] ?? 3);
const BUDGET = Number(process.argv[3] ?? 600_000);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);
  (algorithm as any).searchBudget = () => BUDGET;

  // Dung nhung tiet bi khoa cua lan xep gan nhat, y het duong chay that
  const previous = await prisma.generatedTimetable.findFirst({
    where: { semester_id: semester!.id },
    orderBy: { created_at: 'desc' },
    include: { slots: { where: { is_locked: true } } },
  });
  const inherited: TimeSlot[] = (previous?.slots ?? []).map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id,
    roomId: s.room_id ?? undefined, isLocked: true,
  }));

  say(`Lan xep gan nhat de lai ${inherited.length} tiet bi khoa`);
  say(`${RUNS} lan moi duong, ngan sach ${BUDGET} nuoc di\n`);

  for (const [label, seed] of [
    ['luoi trong', [] as TimeSlot[]],
    ['nap truoc tiet khoa cua lan truoc', inherited],
  ] as const) {
    const scores: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const solution: any = { slots: seed.map((s) => ({ ...s })) };
      await (algorithm as any).buildOneSolution(solution, data, () => undefined);

      const detail = constraints.getFitnessDetails(solution.slots);
      if (detail.hardViolations > 0) {
        say(`  [${label}] bo mot lan: ${detail.hardViolations} loi cung`);
        continue;
      }
      scores.push(detail.score);
    }

    say(
      `${label.padEnd(34)} | so giua ${String(scores.length ? median(scores) : '-').padStart(6)} | ` +
      `tung lan: ${[...scores].sort((a, b) => b - a).join('  ')}`,
    );
  }

  process.exit(0);
}

main().catch((e) => { say(String(e)); process.exit(1); });
