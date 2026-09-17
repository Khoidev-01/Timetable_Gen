/**
 * Chay phong thi nghiem thuat toan tu dong lenh. Day la cach DUY NHAT de chay no: trang
 * "Thu nghiem thuat toan" tren giao dien da bo.
 *
 * Moi thuat toan nhan cung mot bo nuoc di (ke ca chuoi Kempe) va cung mot ngan sach vong
 * lap, nen bang nay so CHIEN LUOC TIM KIEM chu khong so bo nuoc di. Moi lan chay dung loi
 * giai ban dau rieng.
 *
 * Mot tien trinh chi dung mot luong CPU, trong khi cac lan chay doc lap voi nhau. Nen
 * `benchmark-lab-parallel.sh` chay nhieu tien trinh cung luc, moi tien trinh MOT thuat toan
 * MOT lan, roi `merge-benchmark-lab.ts` gop lai.
 *
 * Dung: npx ts-node scripts/run-benchmark-lab.ts <so-lan> <so-vong-lap> <tep-json> [ma-thuat-toan]
 */
import '../src/load-env';
import { writeFileSync, writeSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BenchmarkService } from '../src/algorithm/benchmark.service';

const say = (line = '') => writeSync(1, `${line}\n`);

const RUNS = Number(process.argv[2] ?? 5);
const ITERATIONS = Number(process.argv[3] ?? 700_000);
const OUT = process.argv[4];
const SOLVER = process.argv[5];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const benchmark = app.get(BenchmarkService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const report = await benchmark.run({
    semesterId: semester!.id,
    runs: RUNS,
    iterations: ITERATIONS,
    solverKeys: SOLVER ? [SOLVER] : undefined,
  });

  for (const r of report.results) {
    say(`${r.key}: TB ${r.meanScore}, tot nhat ${r.bestScore}, hop le ${r.validRate}%, ${(r.meanDurationMs / 1000).toFixed(0)}s`);
  }

  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8');
  }

  process.exit(0);
}

main().catch((e) => { say(`Hong: ${e?.stack ?? e}`); process.exit(1); });
