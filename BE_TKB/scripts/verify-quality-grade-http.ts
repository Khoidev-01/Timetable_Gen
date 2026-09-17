/**
 * Kiem tra that qua HTTP: moi API ma giao dien dung de hien chat luong deu tra ve bac danh
 * gia hop le, va bac do khop voi cach cham tren CSDL.
 *
 * Giao dien khong con hien diem so, nen neu mot API quen tra ve `grade` thi o do se hien
 * gach ngang — khong loi, khong canh bao, chi la trong. Test don vi khong bat duoc chuyen do
 * vi no nam o ranh gioi giua hai du an.
 *
 * Dung: PORT cua backend dang chay (mac dinh 4100)
 *   npx ts-node scripts/verify-quality-grade-http.ts 4100
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PORT = Number(process.argv[2] ?? 4100);
const GRADES = ['EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'WEAK', 'POOR'];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const official = await prisma.generatedTimetable.findFirst({ where: { is_official: true }, orderBy: { created_at: 'desc' } });
  if (!admin || !official) throw new Error('Thieu tai khoan quan tri hoac thoi khoa bieu chinh thuc');

  const token = jwt.sign({ username: admin.username, sub: admin.id, role: admin.role });
  const get = async (path: string) => {
    const response = await fetch(`http://localhost:${PORT}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
    return response.json();
  };

  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };

  const semester = official.semester_id;

  const dashboard: any = await get(`/algorithm/dashboard/${semester}`);
  check('Tong quan', GRADES.includes(dashboard.timetable?.grade), `grade=${dashboard.timetable?.grade}`);

  const variants: any = await get(`/algorithm/variants/${semester}`);
  const list = Array.isArray(variants) ? variants : variants.variants ?? [];
  check(
    'So sanh phuong an',
    list.length > 0 && list.every((v: any) => GRADES.includes(v.grade)),
    list.map((v: any) => `${v.name?.split(' ')[0]} ${v.name?.split(' ')[1]}=${v.grade}`).slice(0, 6).join(', '),
  );

  const result: any = await get(`/algorithm/result/${semester}`);
  const quality = result.quality ?? result.fitnessDetails?.quality;
  check('Bang chat luong', GRADES.includes(quality?.grade), `grade=${quality?.grade}, nhan=${quality?.gradeLabel}, y nghia="${quality?.gradeMeaning}"`);

  // Ban chinh thuc hop le thi khong duoc la Te; con loi cung thi phai la Te
  const official_ = list.find((v: any) => v.isOfficial);
  if (official_) {
    check(
      'Bac khop voi loi cung',
      official_.isValid ? official_.grade !== 'POOR' : official_.grade === 'POOR',
      `hop le=${official_.isValid}, grade=${official_.grade}`,
    );
  }

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
