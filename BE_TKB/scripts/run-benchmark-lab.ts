/**
 * Chay phong thi nghiem thuat toan tu dong lenh, qua DUNG dich vu ma trang "Thu nghiem
 * thuat toan" goi — de con so trong bao cao va con so tren giao dien la mot.
 *
 * Moi thuat toan nhan cung mot bo nuoc di (ke ca chuoi Kempe) va cung mot ngan sach vong
 * lap, nen bang nay so CHIEN LUOC TIM KIEM chu khong so bo nuoc di. Moi lan chay dung loi
 * giai ban dau rieng.
 *
 * Dung: npx ts-node scripts/run-benchmark-lab.ts <so-lan> <so-vong-lap> <tep-csv>
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
const CSV_PATH = process.argv[4];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'log'] });
  const prisma = app.get(PrismaService);
  const benchmark = app.get(BenchmarkService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  say(`Hoc ky ${semester!.name} — ${RUNS} lan moi thuat toan, ${ITERATIONS} vong lap moi lan\n`);

  const started = Date.now();
  const report = await benchmark.run({ semesterId: semester!.id, runs: RUNS, iterations: ITERATIONS });

  say(`\nDiem loi giai ban dau (chua toi uu): ${report.constructionScore}\n`);
  say('Thuat toan                          | TB     | tot nhat | te nhat | lech chuan | hop le | giay TB');
  say('------------------------------------|--------|----------|---------|------------|--------|--------');
  for (const r of report.results) {
    say(
      `${r.label.padEnd(35)} | ${String(r.meanScore).padStart(6)} | ${String(r.bestScore).padStart(8)} | ` +
      `${String(r.worstScore).padStart(7)} | ${String(r.stdDeviation).padStart(10)} | ` +
      `${String(r.validRate).padStart(5)}% | ${(r.meanDurationMs / 1000).toFixed(0).padStart(6)}`,
    );
  }
  say(`\nTong thoi gian: ${((Date.now() - started) / 60000).toFixed(1)} phut`);

  if (CSV_PATH) {
    mkdirSync(dirname(CSV_PATH), { recursive: true });
    writeFileSync(CSV_PATH, report.csv + '\n', 'utf-8');
    writeFileSync(CSV_PATH.replace(/\.csv$/, '.json'), JSON.stringify(report, null, 2), 'utf-8');
    say(`Da ghi ${CSV_PATH}`);
  }

  process.exit(0);
}

main().catch((e) => { say(String(e?.stack ?? e)); process.exit(1); });
