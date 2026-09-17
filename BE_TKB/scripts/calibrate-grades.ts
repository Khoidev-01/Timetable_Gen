/**
 * Do xem sau bac danh gia thuc su nam o dau, truoc khi dat ten cho chung.
 *
 * Dat nhan chat luong theo cam tinh thi cai nhan do khong noi len gi: goi mot thoi khoa bieu
 * la "Kha" ma khong biet "Kha" hon cai gi va kem cai gi thi chi la doi mot con so kho hieu
 * lay mot chu kho hieu.
 *
 * Kich ban nay dung loi giai o sau muc cong suc tren cung mot bo du lieu, roi lay khoan phat
 * CO THE TRANH duoc tren moi tiet lam thuoc do. Phan bat kha khang bi tru ra: cham mot bo
 * giai bang thu no khong the sua duoc la cham sai cho.
 *
 * Moi lan dung chi dung mot luong CPU va cac lan dung doc lap nhau, nen co hai cach chay:
 *
 *   npx ts-node scripts/calibrate-grades.ts                    tat ca, 3 lan moi muc, tuan tu
 *   npx ts-node scripts/calibrate-grades.ts <MUC> <tep.json>   dung MOT lan, de chay song song
 */
import '../src/load-env';
import { mkdirSync, writeFileSync, writeSync } from 'fs';
import { dirname } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

/** Ghi thang xuong mo ta tep: mot phep do chay hang phut thi phai nhin duoc no da toi dau. */
const say = (line = '') => writeSync(1, `${line}\n`);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

export interface Level {
  key: string;
  name: string;
  /** Số nước đi cho vòng tìm kiếm chính. 0 nghĩa là không tối ưu gì cả. */
  search: number;
}

export const LEVELS: Level[] = [
  { key: 'RAW', name: 'Chỉ dựng thô, không tối ưu', search: 0 },
  { key: 'S5K', name: 'Tối ưu 5.000 nước đi', search: 5_000 },
  { key: 'S30K', name: 'Tối ưu 30.000 nước đi', search: 30_000 },
  { key: 'S150K', name: 'Tối ưu 150.000 nước đi', search: 150_000 },
  { key: 'S700K', name: 'Tối ưu đầy đủ (bản chính)', search: 700_000 },
  { key: 'S2400K', name: 'Tối ưu kéo dài 2,4 triệu', search: 2_400_000 },
];

async function main() {
  const onlyKey = process.argv[2];
  const out = process.argv[3];

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);

  const measure = async (level: Level) => {
    process.env.TKB_SEARCH_MAIN = String(Math.max(1, level.search));

    const solution: any = { slots: [] };
    if (level.search === 0) {
      solution.slots = await (algorithm as any).buildConstruction(data);
      (algorithm as any).assignRooms(solution, data, () => undefined);
    } else {
      await (algorithm as any).buildOneSolution(solution, data, () => undefined);
    }

    const detail = constraints.getFitnessDetails(solution.slots);
    return {
      level: level.key,
      search: level.search,
      penaltyPerSlot: detail.penaltyPerSlot,
      avoidablePerSlot: detail.quality.avoidablePerSlot,
      hardViolations: detail.hardViolations,
    };
  };

  if (onlyKey) {
    const level = LEVELS.find((l) => l.key === onlyKey);
    if (!level) throw new Error(`Khong co muc ${onlyKey}`);
    const result = await measure(level);
    say(JSON.stringify(result));
    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(result), 'utf-8');
    }
    process.exit(0);
  }

  const RUNS = 3;
  say(`${RUNS} lan moi muc, lay so giua\n`);
  say('Muc cong suc                  | tranh duoc/tiet | loi cung | tung lan');
  say('------------------------------|-----------------|----------|---------');
  for (const level of LEVELS) {
    const runs: Array<Awaited<ReturnType<typeof measure>>> = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(level));
    const avoidable = runs.map((r) => r.avoidablePerSlot);
    say(
      `${level.name.padEnd(29)} | ${median(avoidable).toFixed(2).padStart(15)} | ` +
      `${String(median(runs.map((r) => r.hardViolations))).padStart(8)} | ${avoidable.map((a) => a.toFixed(2)).join('  ')}`,
    );
  }
  process.exit(0);
}

main().catch((e) => { say(`Hong: ${e?.stack ?? e}`); process.exit(1); });
