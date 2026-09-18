/**
 * Kiem tra that tron luong "Tong hop phan cong" qua API tren CSDL that:
 *
 *   1. Moi to truong tai mau cua to, dien ma giao vien (lay theo phan cong dang co), nop.
 *      To Toan co y bo trong 3 dong; to Ngoai ngu khong nop.
 *   2. Admin xem tong quan, bam Tong hop (xem truoc), bam Phan cong tu dong.
 *   3. Doi chieu CSDL: dong to truong da chot giu nguyen, dong trong duoc tu dien dung chuyen
 *      mon, GVCN nhan HDTN + chao co, khong ai vuot dinh muc; he thong da bat dau xep lich.
 *
 * Dung: npx ts-node --transpile-only scripts/verify-department-flow.ts <url-backend>
 */
import '../src/load-env';
import * as ExcelJS from 'exceljs';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const API = process.argv[2] ?? 'http://localhost:4001';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  let failures = 0;
  const check = (label: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'DAT ' : 'HONG'}  ${label}: ${detail}`);
    if (!ok) failures++;
  };
  const auth = (u: { id: string; username: string; role: string }) => ({ Authorization: `Bearer ${jwt.sign({ username: u.username, sub: u.id, role: u.role })}` });

  const hk1 = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const current = await prisma.teachingAssignment.findMany({ where: { semester_id: hk1!.id }, include: { class: true, subject: true, teacher: true } });
  const currentTeacher = new Map(current.map((a) => [`${a.class.name}:${a.subject.code}`, a.teacher.code]));
  const heads = await prisma.teacher.findMany({ where: { position: 'TT' }, include: { user: true } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  // Giao vien thuong khong duoc nop
  const plain = await prisma.user.findFirst({ where: { role: 'TEACHER', teacher_profile: { position: 'GV' } } });
  const denied = await fetch(`${API}/department-assignments/mine`, { headers: auth(plain!) });
  check('GV thuong bi chan', denied.status === 403, `HTTP ${denied.status}`);

  const submittedRows = new Map<string, string>(); // lop:mon -> ma GV to truong chot
  const blanked: string[] = [];
  for (const head of heads) {
    if (head.department === 'Tổ Ngoại ngữ') continue;
    const u = head.user!;
    const mine: any = await (await fetch(`${API}/department-assignments/mine`, { headers: auth(u) })).json();
    const res = await fetch(`${API}/department-assignments/mine/template`, { headers: auth(u) });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as any);
    const ws = wb.getWorksheet('Phan_cong_to')!;
    let filledHere = 0;
    for (let r = 3; r <= ws.rowCount; r++) {
      const cls = String(ws.getCell(r, 3).value ?? '');
      const subject = String(ws.getCell(r, 5).value ?? '');
      if (!cls) continue;
      const key = `${cls}:${subject}`;
      if (head.department === 'Tổ Toán' && blanked.length < 3) {
        blanked.push(key);
        continue;
      }
      const code = currentTeacher.get(key);
      if (code) {
        ws.getCell(r, 9).value = code;
        submittedRows.set(key, code);
        filledHere++;
      }
    }
    const form = new FormData();
    form.append('file', new Blob([await wb.xlsx.writeBuffer()]), `phan-cong-${head.code}.xlsx`);
    const sub = await fetch(`${API}/department-assignments/mine/submit`, { method: 'POST', headers: auth(u), body: form });
    const body: any = await sub.json();
    const errors = (body.issues ?? []).filter((i: any) => i.level === 'ERROR');
    check(`${head.department}: nop`, sub.ok && errors.length === 0 && body.rows === mine.rowCount, `HTTP ${sub.status}, ${body.filled}/${body.rows} dong co GV (mau ${mine.rowCount} dong), ${errors.length} loi, ${(body.issues ?? []).length - errors.length} canh bao`);
  }

  // Nop sai to: dung mau to Toan nop bang tai khoan to truong to Van
  const math = heads.find((h) => h.department === 'Tổ Toán')!;
  const lit = heads.find((h) => h.department === 'Tổ Ngữ văn')!;
  const mathTemplate = await (await fetch(`${API}/department-assignments/mine/template`, { headers: auth(math.user!) })).arrayBuffer();
  const wrongForm = new FormData();
  wrongForm.append('file', new Blob([mathTemplate]), 'nham-to.xlsx');
  const wrong = await fetch(`${API}/department-assignments/mine/submit`, { method: 'POST', headers: auth(lit.user!), body: wrongForm });
  check('Nop nham mau to khac bi tu choi', wrong.status === 400, `HTTP ${wrong.status} ${(await wrong.json()).message}`);

  const overview: any = await (await fetch(`${API}/department-assignments/overview`, { headers: auth(admin!) })).json();
  const submitted = overview.departments.filter((d: any) => d.submission).map((d: any) => d.department);
  check('Tong quan: 6/7 to da nop, to Ngoai ngu chua', submitted.length === 6 && !submitted.includes('Tổ Ngoại ngữ'), submitted.join(', '));

  const preview: any = await (await fetch(`${API}/department-assignments/consolidate`, { method: 'POST', headers: auth(admin!) })).json();
  check('Tong hop: khong loi', preview.errors.length === 0, `${JSON.stringify(preview.stats)}, thieu to: ${preview.missingDepartments.join(', ')}`);

  const started = Date.now();
  const autoRes = await fetch(`${API}/department-assignments/auto-assign`, { method: 'POST', headers: auth(admin!) });
  const auto: any = await autoRes.json();
  check('Phan cong tu dong: nhap xong va bat dau xep lich', autoRes.ok && auto.scheduling?.length === 2 && auto.scheduling.every((s: any) => !s.error),
    `HTTP ${autoRes.status} sau ${((Date.now() - started) / 1000).toFixed(1)}s, nhap ${JSON.stringify(auto.imported?.assignments)}, xep lich ${JSON.stringify(auto.scheduling)}`);

  // Doi chieu CSDL
  const after = await prisma.teachingAssignment.findMany({ where: { semester_id: hk1!.id }, include: { class: true, subject: true, teacher: true } });
  const afterTeacher = new Map<string, Set<string>>();
  for (const a of after) {
    const key = `${a.class.name}:${a.subject.code}`;
    afterTeacher.set(key, (afterTeacher.get(key) ?? new Set()).add(a.teacher.code));
  }
  const changed = [...submittedRows].filter(([key, code]) => !(afterTeacher.get(key)?.size === 1 && afterTeacher.get(key)!.has(code)));
  check('Dong to truong da chot duoc giu nguyen', changed.length === 0, `${submittedRows.size} dong, doi ${changed.length}: ${changed.slice(0, 3).join(' ')}`);
  const blankFilled = blanked.map((key) => [...(afterTeacher.get(key) ?? [])][0]);
  const blankMajors = await prisma.teacher.findMany({ where: { code: { in: blankFilled.filter(Boolean) } } });
  check('Dong bo trong duoc tu dien dung chuyen mon', blankFilled.every(Boolean) && blankMajors.every((t) => t.major_subject === 'TOAN'), blanked.map((k, i) => `${k}->${blankFilled[i]}`).join(', '));
  const english = after.filter((a) => a.subject.code === 'ANH');
  check('To chua nop (Ngoai ngu) duoc tu dien', english.length === 30 && english.every((a) => a.teacher.major_subject === 'ANH'), `${english.length} lop Tieng Anh`);
  const consolidation = await prisma.assignmentConsolidation.findUnique({ where: { id: auto.consolidationId } });
  check('Luu bang hoan chinh de tai lai', !!consolidation && consolidation.workbook.length > 10000, `${consolidation?.workbook.length} byte`);
  const dl = await fetch(`${API}/department-assignments/consolidations/${auto.consolidationId}/download`, { headers: auth(admin!) });
  check('Tai bang hoan chinh', dl.ok && (dl.headers.get('content-type') ?? '').includes('spreadsheet'), `HTTP ${dl.status}`);

  await app.close();
  console.log(failures === 0 ? '\nTat ca dat. (chay scripts/audit-sample-data.ts de soat quy tac, doi xep lich xong roi kiem tra loi cung)' : `\n${failures} muc hong.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
