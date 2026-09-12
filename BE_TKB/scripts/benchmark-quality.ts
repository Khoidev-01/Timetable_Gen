/**
 * Do chat luong loi giai qua nhieu lan chay.
 *
 * Diem dao dong tu lan chay nay sang lan khac, nen mot lan chay khong noi len dieu gi: mot
 * thay doi lam te di van co the trung mot lan chay dep. Lay trung vi cua N lan, va in ca
 * dai tu thap nhat den cao nhat de biet dai nhieu.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

const RUNS = Number(process.argv[2] ?? 5);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);

  let lastDetail: any;
  const scores: number[] = [];
  const hards: number[] = [];
  const times: number[] = [];

  for (let run = 1; run <= RUNS; run++) {
    const started = Date.now();
    const solution: any = { slots: [] };
    await (algorithm as any).buildOneSolution(solution, data, () => undefined);
    const seconds = (Date.now() - started) / 1000;

    const detail = constraints.getFitnessDetails(solution.slots);
    lastDetail = detail;
    scores.push(detail.score);
    hards.push(detail.hardViolations);
    times.push(seconds);
    console.log(`  lan ${run}: diem ${detail.score}, loi cung ${detail.hardViolations}, ${solution.slots.length} tiet, ${seconds.toFixed(1)}s`);
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  console.log(`\n${RUNS} lan chay — trung vi ${median}, trung binh ${mean.toFixed(0)}, thap nhat ${sorted[0]}, cao nhat ${sorted[sorted.length - 1]}`);
  console.log('Chi tiet khoan phat cua lan cuoi:');
  (lastDetail?.details ?? []).forEach((d: string) => console.log('  ' + d));
  console.log(`Loi cung: ${hards.join(' ')} — trung binh thoi gian ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}s/lan`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
