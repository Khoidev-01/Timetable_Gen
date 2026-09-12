/**
 * Boc tiet o cho dang loi co hon boc deu khap luoi khong, va bao nhieu phan tram thi dung?
 *
 * Moi muc ty le chay cung mot ngan sach, cung mot cach dung diem xuat phat, chi khac cach
 * chon tiet de thu doi cho. Chay nhieu lan moi muc va so bang so giua, vi mot lan chay
 * khong phan biet duoc "tot hon" voi "may hon" — hai thi nghiem trong so truoc day deu
 * thang o mot lan chay roi hoa khi chay ba lan.
 *
 * Cot "thang cap doi dau" ghep tung lan cua muc nay voi tung lan cua muc 0 (boc deu). No
 * khong gia dinh gi ve phan bo diem, va doc duoc ngay: 50% nghia la ngang nhau.
 *
 * Dung: npx ts-node scripts/probe-guided-moves.ts <so-lan-moi-muc> <ngan-sach> <cac-ty-le>
 *   vi du: npx ts-node scripts/probe-guided-moves.ts 5 300000 0,0.5,0.75,0.9
 */
import '../src/load-env';
import { writeSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

// Ghi thang xuong mo ta tep, khong qua bo dem: mot phep do chay hang chuc phut thi phai
// nhin duoc no da toi dau, chu khong phai cho den luc no ket thuc moi thay gi.
const say = (line = '') => writeSync(1, `${line}\n`);

const RUNS = Number(process.argv[2] ?? 5);
const BUDGET = Number(process.argv[3] ?? 300_000);
const SHARES = (process.argv[4] ?? '0,0.5,0.75,0.9').split(',').map(Number);

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

  say(`${RUNS} lan moi muc, ngan sach ${BUDGET} nuoc di\n`);

  const outcome = new Map<number, number[]>();

  for (const share of SHARES) {
    (algorithm as any).hotspotShare = share;

    const scores: number[] = [];
    const seconds: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const started = Date.now();
      const solution: any = { slots: [] };
      await (algorithm as any).buildOneSolution(solution, data, () => undefined);
      seconds.push((Date.now() - started) / 1000);

      const detail = constraints.getFitnessDetails(solution.slots);
      // Ban chinh dung lai toi sau lan va chi giu ban khong loi cung, nen mot lan hong
      // khong phai loi. Nhung neu mot muc hong nhieu hon han cac muc khac thi phai biet.
      if (detail.hardViolations > 0) {
        say(`  [ty le ${share}] bo mot lan: ${detail.hardViolations} loi cung`);
        continue;
      }
      scores.push(detail.score);
    }

    outcome.set(share, scores);

    const plain = outcome.get(0);
    let duel = '';
    if (plain && share !== 0 && plain.length && scores.length) {
      let wins = 0;
      for (const a of scores) for (const b of plain) if (a > b) wins += 1;
      duel = `${Math.round((wins / (scores.length * plain.length)) * 100)}%`;
    }

    say(
      `ty le ${String(share).padEnd(5)} | so giua ${String(median(scores)).padStart(6)} | ` +
      `tot ${String(Math.max(...scores)).padStart(6)} | te ${String(Math.min(...scores)).padStart(6)} | ` +
      `${seconds.length ? median(seconds).toFixed(1) : '-'}s | thang cap doi dau ${duel}`,
    );
    say(`        tung lan: ${[...scores].sort((a, b) => b - a).join('  ')}`);
  }

  say('\nTy le 0 la hanh vi truoc khi co co che nay. 50% cap doi dau nghia la ngang no.');
  process.exit(0);
}

main().catch((e) => { say(String(e)); process.exit(1); });
