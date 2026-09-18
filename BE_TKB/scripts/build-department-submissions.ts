/**
 * Dựng dữ liệu "tổ trưởng đã nộp" cho buổi demo happy case, đi qua đúng đường code thật:
 *
 *   1. Với mỗi tổ trưởng: tải mẫu của tổ (DepartmentAssignmentsService.template), điền mã giáo viên
 *      lấy từ sheet Phan_cong của Du_lieu_mau_GDPT2018_30lop.xlsx.
 *   2. Các tổ khác Tổ Toán: nộp bằng DepartmentAssignmentsService.submit, rồi xuất rows + issues
 *      ra scripts/data/happy-case-department-submissions.json để run-data-migrations.js ghi khi deploy.
 *   3. Tổ Toán: không nộp, chỉ ghi file Excel đã điền ra thư mục <outDir> để demo tải lên trực tiếp.
 *
 * Chạy trên CSDL vừa seed happy case và CHƯA có bài nộp nào (script sẽ nộp thật vào CSDL đó):
 *   DATABASE_URL=... npx ts-node --transpile-only scripts/build-department-submissions.ts <outDir>
 */
import '../src/load-env';
import * as ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DepartmentAssignmentsService } from '../src/department-assignments/department-assignments.service';

const DEMO_DEPARTMENT = 'Tổ Toán';
const SAMPLE_WORKBOOK = join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const OUTPUT_JSON = join(__dirname, 'data', 'happy-case-department-submissions.json');

async function readSampleAssignments() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SAMPLE_WORKBOOK);
  const ws = wb.getWorksheet('Phan_cong');
  if (!ws) throw new Error('File mẫu không có sheet Phan_cong');
  const byKey = new Map<string, { hk1: string; hk2: string }>();
  for (let r = 3; r <= ws.rowCount; r++) {
    const className = String(ws.getCell(r, 4).value ?? '').trim();
    const subjectCode = String(ws.getCell(r, 6).value ?? '').trim();
    if (!className || !subjectCode) continue;
    const entry = { hk1: String(ws.getCell(r, 11).value ?? '').trim(), hk2: String(ws.getCell(r, 13).value ?? '').trim() };
    const key = `${className}:${subjectCode}`;
    const known = byKey.get(key);
    // Dòng lý thuyết và thực hành của cùng lớp - môn phải cùng một giáo viên
    if (known && (known.hk1 !== entry.hk1 || known.hk2 !== entry.hk2)) throw new Error(`${key}: LT và TH khác giáo viên`);
    byKey.set(key, entry);
  }
  return byKey;
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('Thiếu thư mục ghi file Excel của Tổ Toán');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const service = app.get(DepartmentAssignmentsService);
  const sample = await readSampleAssignments();

  const heads = await prisma.teacher.findMany({ where: { position: 'TT' }, include: { user: true }, orderBy: { code: 'asc' } });
  const submissions: unknown[] = [];
  for (const head of heads) {
    if (!head.user || !head.department) throw new Error(`${head.code} chưa có tài khoản hoặc tổ`);
    const { buffer, fileName } = await service.template(head.user.id);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet('Phan_cong_to')!;
    let filled = 0;
    const missing: string[] = [];
    for (let r = 3; r <= ws.rowCount; r++) {
      const key = `${ws.getCell(r, 3).value ?? ''}:${ws.getCell(r, 5).value ?? ''}`;
      if (key === ':') continue;
      const assignment = sample.get(key);
      if (!assignment?.hk1) {
        missing.push(key);
        continue;
      }
      ws.getCell(r, 9).value = assignment.hk1;
      if (assignment.hk2 && assignment.hk2 !== assignment.hk1) ws.getCell(r, 10).value = assignment.hk2;
      filled++;
    }
    if (missing.length) throw new Error(`${head.department}: file mẫu không có giáo viên cho ${missing.join(', ')}`);
    const filledBuffer = Buffer.from(await wb.xlsx.writeBuffer());

    if (head.department === DEMO_DEPARTMENT) {
      mkdirSync(outDir, { recursive: true });
      const target = join(outDir, fileName);
      writeFileSync(target, filledBuffer);
      console.log(`${head.department} (${head.code}): ghi ${filled} dòng -> ${target}`);
      continue;
    }

    const result = await service.submit(head.user.id, fileName, filledBuffer);
    const errors = result.issues.filter((i) => i.level === 'ERROR');
    console.log(`${head.department} (${head.code}): nộp ${result.filled}/${result.rows} dòng, ${errors.length} lỗi, ${result.issues.length - errors.length} cảnh báo`);
    if (errors.length) throw new Error(`${head.department}: ${JSON.stringify(errors)}`);
    const saved = await prisma.departmentSubmission.findUniqueOrThrow({ where: { id: result.id } });
    submissions.push({ department: saved.department, headTeacherCode: head.code, fileName: saved.file_name, rows: saved.rows, issues: saved.issues });
  }

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(submissions, null, 2)}\n`);
  console.log(`Ghi ${submissions.length} bài nộp -> ${OUTPUT_JSON}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
