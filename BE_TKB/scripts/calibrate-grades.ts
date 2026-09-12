/**
 * Do xem "tot" va "kem" thuc su nam o dau, truoc khi dat ten cho chung.
 *
 * Dat nhan chat luong theo cam tinh thi cai nhan do khong noi len gi: goi mot thoi khoa bieu
 * la "Kha" ma khong biet "Kha" hon cai gi va kem cai gi thi chi la doi mot con so kho hieu
 * lay mot chu kho hieu.
 *
 * Kich ban nay dung ba loi giai o ba muc cong suc khac nhau tren cung mot bo du lieu, roi
 * lay khoan phat CO THE TRANH duoc tren moi tiet lam thuoc do. Phan bat kha khang bi tru ra:
 * cham diem mot bo giai bang thu no khong the sua duoc la cham sai cho.
 */
import '../src/load-env';
import { writeSync } from 'fs';

/** Ghi thang xuong mo ta tep: mot phep do chay hang phut thi phai nhin duoc no da toi dau. */
const say = (line = '') => writeSync(1, `${line}
`);

/** So lan dung o moi muc. Mot lan chay lech toi vai tram diem, ma moc xep hang dat tren no. */
const RUNS = Number(process.argv[2] ?? 3);

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

interface Level {
  name: string;
  /** Số nước đi cho vòng tìm kiếm chính. 0 nghĩa là không tối ưu gì cả. */
  search: number;
}

const LEVELS: Level[] = [
  { name: 'Chỉ dựng thô, không tối ưu', search: 0 },
  { name: 'Tối ưu rất ngắn', search: 20_000 },
  { name: 'Tối ưu ngắn', search: 100_000 },
  { name: 'Tối ưu đầy đủ', search: 600_000 },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const data = await (algorithm as any).loadData(semester!.id);
  await constraints.initialize(semester!.id);

  say(`${RUNS} lan moi muc, lay so giua
`);
  say('Muc cong suc                 | phat/tiet | tranh duoc/tiet | loi cung | tung lan');
  say('-----------------------------|-----------|-----------------|----------|---------');

  for (const level of LEVELS) {
    process.env.TKB_SEARCH_MAIN = String(Math.max(1, level.search));

    const penalties: number[] = [];
    const avoidables: number[] = [];
    const hardEachRun: number[] = [];

    for (let run = 0; run < RUNS; run++) {
      const solution: any = { slots: [] };
      if (level.search === 0) {
        solution.slots = await (algorithm as any).buildConstruction(data);
        (algorithm as any).assignRooms(solution, data, () => undefined);
      } else {
        await (algorithm as any).buildOneSolution(solution, data, () => undefined);
      }

      const detail = constraints.getFitnessDetails(solution.slots);
      // Ban dung tho gan nhu luc nao cung con loi cung — no la diem XUAT PHAT, khong phai
      // mot thoi khoa bieu dung duoc. Van bao con so cua no, nhung bao kem so loi cung de
      // khong ai doc no nhu mot muc chat luong.
      hardEachRun.push(detail.hardViolations);

      const floor = (detail.breakdown?.soft ?? []).reduce(
        (sum: number, item: any) => sum + (item.floor ?? 0) * item.weight,
        0,
      );
      penalties.push(detail.penaltyPerSlot);
      avoidables.push((detail.softPenalty - floor) / solution.slots.length);
    }

    say(
      `${level.name.padEnd(28)} | ${median(penalties).toFixed(2).padStart(9)} | ` +
        `${median(avoidables).toFixed(2).padStart(15)} | ` +
        `${String(median(hardEachRun)).padStart(8)} | ` +
        avoidables.map((a) => a.toFixed(2)).sort().join('  '),
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
