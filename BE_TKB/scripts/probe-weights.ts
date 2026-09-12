/**
 * Doi trong so co lam diem tot len khong, hay chi chuyen khoan phat tu cho nay sang cho khac?
 *
 * Diem tong la mot TONG CO TRONG SO, nen nang trong so mot tieu chi luon lam tieu chi do tot
 * len — va gan nhu luon lam tieu chi khac te di. Chi co mot cach biet la lai hay lo: cham lai
 * ca hai phuong an bang CUNG MOT bo trong so goc.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

const PROFILES: Array<{ name: string; changes: Record<string, number> }> = [
  { name: 'Hien tai', changes: {} },
  { name: 'Uu tien tiet trong GV', changes: { teacherGaps: 12 } },
  { name: 'Uu tien buoi di lai', changes: { teacherAttendance: 16 } },
  { name: 'Ca hai', changes: { teacherGaps: 12, teacherAttendance: 16 } },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);
  const original = { ...constraints.weights };

  console.log('Bo trong so              | diem (cham bang bo GOC) | tiet trong | buoi di lai | xe le');
  console.log('-------------------------|-------------------------|------------|-------------|------');

  for (const profile of PROFILES) {
    Object.assign(constraints.weights, original, profile.changes);

    const solution: any = { slots: [] };
    await (algorithm as any).buildOneSolution(solution, data, () => undefined);

    // Cham lai bang bo GOC, neu khong thi hai con so khong so duoc voi nhau
    Object.assign(constraints.weights, original);
    const d = constraints.getFitnessDetails(solution.slots);
    const find = (label: string) => d.breakdown.soft.find((s: any) => s.label === label)?.count ?? 0;

    console.log(
      `${profile.name.padEnd(24)} | ${String(d.score).padStart(23)} | ` +
      `${String(find('Tiết trống giáo viên')).padStart(10)} | ` +
      `${String(find('Giáo viên phải đến trường thêm buổi')).padStart(11)} | ` +
      `${String(find('Môn 2 tiết bị xé lẻ')).padStart(5)}`,
    );
  }

  Object.assign(constraints.weights, original);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
