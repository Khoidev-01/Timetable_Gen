/**
 * Diem se la bao nhieu neu moi tieu chi cung luc dat muc tot nhat tung thay?
 *
 * Toi uu rieng tung tieu chi — tat het cac tieu chi khac — roi cong cac muc do lai. Con so ay
 * KHONG phai mot can duoi da chung minh: mot lan chay khong chung minh duoc rang khong con
 * cach nao thap hon. No la mot muc THAM CHIEU, va khoang cach tu no den diem hien tai chinh
 * la cai gia phai tra khi muoi lam tieu chi tranh nhau.
 *
 * Ban dau toi goi no la "can duoi" va cong thang con so do rieng tung tieu chi. Mot tieu chi
 * cho ra con so TE HON luc bat het — toi uu mot minh no van co the roi vao cho xau — va con
 * so "san" lai cao hon thuc te. Nay lay cai nho hon trong hai.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

/** Ten hien trong bang diem, va khoa trong so tuong ung. */
const CRITERIA: Array<{ label: string; weight: string }> = [
  { label: 'Môn học dồn cục', weight: 'spreadSubjects' },
  { label: 'Môn nặng học liền nhau', weight: 'heavySubjects' },
  { label: 'Môn ưu tiên ở tiết cuối', weight: 'morningPriority' },
  { label: 'Môn 2 tiết bị xé lẻ', weight: 'block2' },
  { label: 'Tiết trống giáo viên', weight: 'teacherGaps' },
  { label: 'Giáo viên dạy quá số tiết/buổi', weight: 'teacherMaxLoad' },
  { label: 'Giáo viên phải đến trường thêm buổi', weight: 'teacherAttendance' },
  { label: 'Giáo viên dạy cả sáng lẫn chiều', weight: 'bothSessionsSameDay' },
  { label: 'Môn tư duy xếp ngay sau Thể dục', weight: 'afterPhysicalEd' },
  { label: 'Giáo viên không có ngày nghỉ', weight: 'noDayOff' },
  { label: 'Giáo viên dạy quá 4 tiết liên tiếp', weight: 'consecutiveTeaching' },
  { label: 'Môn học cách nhau quá 3 ngày', weight: 'subjectSpacing' },
  { label: 'Môn nặng dồn trong một buổi', weight: 'afternoonOverload' },
  { label: 'Giáo viên phải leo cầu thang', weight: 'mobility' },
  { label: 'Thể dục xếp vào giờ nắng', weight: 'outdoorTiming' },
  { label: 'Môn nặng dồn trong một buổi (khối)', weight: 'blockRules' },
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

  const countOf = (schedule: any[], label: string) => {
    const detail = constraints.getFitnessDetails(schedule);
    return detail.breakdown.soft.find((s: any) => s.label === label)?.count ?? 0;
  };

  // Muc dang dat duoc khi bat het moi tieu chi
  const solution: any = { slots: [] };
  await (algorithm as any).buildOneSolution(solution, data, () => undefined);
  const current = constraints.getFitnessDetails(solution.slots);
  console.log(`Loi giai hien tai: diem ${current.score}, khoan phat ${current.softPenalty}, loi cung ${current.hardViolations}\n`);

  console.log('Tieu chi                              | dang co | rieng no | phat toi thieu');
  console.log('--------------------------------------|---------|----------|---------------');

  let bound = 0;
  for (const criterion of CRITERIA) {
    const weight = (original as any)[criterion.weight] ?? 0;
    if (weight === 0) continue;

    for (const key of Object.keys(constraints.weights)) {
      if (key === 'hardViolation') continue;
      (constraints.weights as any)[key] = 0;
    }
    (constraints.weights as any)[criterion.weight] = weight;

    const alone: any = { slots: [] };
    await (algorithm as any).buildOneSolution(alone, data, () => undefined);

    Object.assign(constraints.weights, original);
    const alone_ = countOf(alone.slots, criterion.label);
    const now = countOf(solution.slots, criterion.label);

    // Muc tot nhat TUNG QUAN SAT duoc, khong phai muc thap nhat ly thuyet. Toi uu rieng mot
    // tieu chi van co the ra con so te hon luc bat het — mot lan chay khong phai mot chung
    // minh — nen lay cai nho hon trong hai.
    const best = Math.min(alone_, now);
    bound += best * weight;

    console.log(
      `${criterion.label.padEnd(37)} | ${String(now).padStart(7)} | ${String(alone_).padStart(8)} | ${String(best * weight).padStart(14)}`,
    );
  }

  Object.assign(constraints.weights, original);

  const penalty = current.softPenalty;
  console.log(`\nCAN DUOI cua khoan phat : ${bound}`);
  console.log(`Khoan phat dang dat       : ${penalty}`);
  console.log(`Khoan cach con lai        : ${penalty - bound} diem (${Math.round(((penalty - bound) / penalty) * 100)}% khoan phat hien tai)`);
  console.log(`\nDiem tuong ung voi can duoi: ${1000 - bound}`);
  console.log('');
  console.log('Day KHONG phai mot can duoi da chung minh. No la diem se dat duoc NEU moi tieu');
  console.log('chi cung luc xuong toi muc tot nhat tung thay rieng no — ma chung tranh nhau nen');
  console.log('khong the. Khoang cach ben tren chinh la cai gia cua viec phai chon.');

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
