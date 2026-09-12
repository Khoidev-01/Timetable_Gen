/**
 * Tung tieu chi mot minh no co the xuong toi dau?
 *
 * Diem thap co the do hai nguyen nhan khac han nhau: bo giai chua du gioi, hoac cong thuc do
 * voi mot muc san khong ai dat toi duoc. Nhin vao con so tong thi khong phan biet duoc.
 *
 * Phep thu nay tat het cac tieu chi khac, chi de lai mot, roi cho bo giai chay het suc. Con
 * so no dung lai la SAN THUC TE cua tieu chi do tren du lieu nay — khong phai san ly thuyet.
 * Neu san thuc te gan bang so dang co, thi bo giai da lam het muc va cong thuc dang do mot
 * thu khong the tot hon. Neu no thap hon nhieu, thi con cho de cai thien that.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

/** Tieu chi can do, kem ten hien trong bang diem. */
const PROBES: Array<{ key: string; label: string }> = [
  { key: 'teacherAttendance', label: 'Giáo viên phải đến trường thêm buổi' },
  { key: 'block2', label: 'Môn 2 tiết bị xé lẻ' },
  { key: 'morningPriority', label: 'Môn ưu tiên ở tiết cuối' },
  { key: 'teacherGaps', label: 'Tiết trống giáo viên' },
  { key: 'bothSessionsSameDay', label: 'Giáo viên dạy cả sáng lẫn chiều' },
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

  // Muc dang co, khi moi tieu chi deu bat
  const baseline: any = {};
  {
    const solution: any = { slots: [] };
    await (algorithm as any).buildOneSolution(solution, data, () => undefined);
    const detail = constraints.getFitnessDetails(solution.slots);
    for (const probe of PROBES) {
      baseline[probe.key] = detail.breakdown.soft.find((s: any) => s.label === probe.label)?.count ?? 0;
    }
    console.log(`Khi bat het moi tieu chi — loi cung ${detail.hardViolations}`);
  }

  console.log('\nTieu chi                              | dang co | rieng no | con giam duoc');
  console.log('--------------------------------------|---------|----------|---------------');

  for (const probe of PROBES) {
    // Tat het, chi bat mot
    for (const key of Object.keys(constraints.weights)) {
      if (key === 'hardViolation') continue;
      (constraints.weights as any)[key] = 0;
    }
    (constraints.weights as any)[probe.key] = (original as any)[probe.key];

    const solution: any = { slots: [] };
    await (algorithm as any).buildOneSolution(solution, data, () => undefined);

    // Cham lai bang bo trong so goc de con so so sanh duoc
    Object.assign(constraints.weights, original);
    const detail = constraints.getFitnessDetails(solution.slots);
    const alone = detail.breakdown.soft.find((s: any) => s.label === probe.label)?.count ?? 0;
    const now = baseline[probe.key];

    console.log(
      `${probe.label.padEnd(37)} | ${String(now).padStart(7)} | ${String(alone).padStart(8)} | ` +
      `${String(now - alone).padStart(13)}`,
    );
  }

  Object.assign(constraints.weights, original);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
