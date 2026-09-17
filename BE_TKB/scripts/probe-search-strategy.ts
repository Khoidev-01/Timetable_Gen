/**
 * Thanh phan nao cua chien luoc tim kiem that su lam loi giai tot len?
 *
 * Moi thanh phan lay tu mot bo giai manh trong tai lieu — chuoi Kempe, ham nong lai, tim
 * kiem cuc bo lap, chap nhan muon — nhung "manh tren bai toan cua nguoi khac" khong co
 * nghia la manh tren bai toan nay. Nen bat tung cai, chay nhieu lan, so bang so giua, va
 * bao ca thoi gian: mot nuoc di dat hon thi cung ngan sach vong lap no dung lau hon.
 *
 * Dung: npx ts-node scripts/probe-search-strategy.ts <so-lan> <ngan-sach> <ten,ten,...>
 */
import '../src/load-env';
import { writeSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService, BASELINE_STRATEGY, SearchStrategy } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

const say = (line = '') => writeSync(1, `${line}\n`);

const STRATEGIES: Record<string, Partial<SearchStrategy>> = {
  BASELINE: {},
  KEMPE_10: { kempeShare: 0.1 },
  KEMPE_25: { kempeShare: 0.25 },
  KEMPE_50: { kempeShare: 0.5 },
  KEMPE_100: { kempeShare: 1 },
  REHEAT: { reheatAfter: 50_000, reheatLevel: 1 },
  REHEAT_ILS: { reheatAfter: 50_000, reheatLevel: 1, restartFromBest: true },
  LAHC_2K: { acceptance: 'LATE_ACCEPTANCE', lateAcceptanceLength: 2_000 },
  LAHC_10K: { acceptance: 'LATE_ACCEPTANCE', lateAcceptanceLength: 10_000 },
  KEMPE_REHEAT_ILS: { kempeShare: 0.1, reheatAfter: 50_000, reheatLevel: 1, restartFromBest: true },
};

const RUNS = Number(process.argv[2] ?? 4);
const BUDGET = Number(process.argv[3] ?? 600_000);
const NAMES = (process.argv[4] ?? Object.keys(STRATEGIES).join(',')).split(',');

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

  say(`${RUNS} lan moi chien luoc, ngan sach ${BUDGET} nuoc di\n`);

  const baseline: number[] = [];

  for (const entry of NAMES) {
    // "TEN@ngan-sach" de so cung THOI GIAN: nuoc di chuoi Kempe dat gap nhieu lan nuoc di
    // thuong, nen cung so vong lap thi no duoc chay lau hon — mot phep so khong cong bang
    const [name, ownBudget] = entry.split('@');
    const budget = ownBudget ? Number(ownBudget) : BUDGET;
    (algorithm as any).searchBudget = () => budget;
    const overrides = STRATEGIES[name];
    if (!overrides) {
      say(`Khong co chien luoc ${name}`);
      continue;
    }
    (algorithm as any).searchStrategy = { ...BASELINE_STRATEGY, ...overrides };

    const scores: number[] = [];
    const seconds: number[] = [];
    let broken = 0;

    for (let run = 0; run < RUNS; run++) {
      const started = Date.now();
      const solution: any = { slots: [] };
      await (algorithm as any).buildOneSolution(solution, data, () => undefined);
      seconds.push((Date.now() - started) / 1000);

      const detail = constraints.getFitnessDetails(solution.slots);
      if (detail.hardViolations > 0) {
        broken++;
        continue;
      }
      scores.push(detail.score);
    }

    if (name === 'BASELINE') baseline.push(...scores);

    let duel = '';
    if (name !== 'BASELINE' && baseline.length && scores.length) {
      let wins = 0;
      for (const a of scores) for (const b of baseline) if (a > b) wins++;
      duel = ` | thang ${Math.round((wins / (scores.length * baseline.length)) * 100)}% cap voi BASELINE`;
    }

    say(
      `${entry.padEnd(24)} | so giua ${String(scores.length ? median(scores) : '-').padStart(6)} | ` +
      `${median(seconds).toFixed(0).padStart(3)}s/lan | loi cung ${broken}/${RUNS}${duel}`,
    );
    say(`                    tung lan: ${[...scores].sort((a, b) => b - a).join('  ')}`);
  }

  process.exit(0);
}

main().catch((e) => { say(String(e?.stack ?? e)); process.exit(1); });
