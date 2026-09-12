/**
 * Tim kiem lau hon thi diem tot len bao nhieu, va het bao nhieu thoi gian?
 *
 * Ma nguon dang co mot dong chu thich cua chinh toi: "gap doi so vong lap mua duoc khoang
 * 600 diem". Do la mot con so toi tung do mot lan roi viet vao. Phep do nay chay lai no
 * that su, nhieu lan moi muc, vi mot lan chay khong phan biet duoc "tot hon" voi "may hon".
 *
 * Dung: npx ts-node scripts/probe-budget.ts <so-lan-moi-muc>
 */
import '../src/load-env';
import { writeSync } from 'fs';

// Ghi thang xuong mo ta tep, khong qua bo dem: mot phep do chay hang chuc phut thi phai
// nhin duoc no da toi dau, chu khong phai cho den luc no ket thuc moi thay gi.
const say = (line = '') => writeSync(1, `${line}
`);
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

const RUNS = Number(process.argv[2] ?? 3);
const BUDGETS = [600_000, 1_200_000, 2_400_000];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);

  say(`${RUNS} lan moi muc ngan sach\n`);
  say('Ngan sach  | diem giua | diem tot nhat | giay/lan');
  say('-----------|-----------|---------------|---------');

  for (const budget of BUDGETS) {
    (algorithm as any).searchBudget = () => budget;

    const scores: number[] = [];
    const seconds: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const started = Date.now();
      const solution: any = { slots: [] };
      await (algorithm as any).buildOneSolution(solution, data, () => undefined);
      seconds.push((Date.now() - started) / 1000);

      const detail = constraints.getFitnessDetails(solution.slots);
      // Mot loi giai co loi cung khong so sanh duoc voi mot loi giai khong loi cung
      scores.push(detail.hardViolations > 0 ? NaN : detail.score);
    }

    const valid = scores.filter((s) => !Number.isNaN(s));
    say(
      `${String(budget).padStart(10)} | ${String(valid.length ? median(valid) : 'loi cung').padStart(9)} | ` +
      `${String(valid.length ? Math.max(...valid) : '-').padStart(13)} | ${median(seconds).toFixed(1).padStart(8)}`,
    );
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
