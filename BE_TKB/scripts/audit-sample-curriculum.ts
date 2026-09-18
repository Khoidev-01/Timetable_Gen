/** Kiểm tra workbook mẫu và dữ liệu seed production của happy case, không sửa file. */
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { buildDemands, completeAssignments } from '../src/department-assignments/department-plan';

const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const data = require('./data/happy-case-school-data.json');
const CEREMONIES = new Set(['CHAO_CO', 'SH_CUOI_TUAN']);
const OFF_SESSION = new Set(['GDTC', 'GDQP']);

const columnsOf = (sheet: ExcelJS.Worksheet) => {
  const columns: Record<string, number> = {};
  sheet.getRow(2).eachCell((cell, column) => {
    columns[String(cell.value ?? '').trim()] = column;
  });
  return columns;
};

async function main() {
  const failures: string[] = [];
  const check = (condition: boolean, label: string, detail = '') => {
    console.log(`${condition ? 'ĐẠT' : 'HỎNG'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!condition) failures.push(label);
  };

  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);
  const classSheet = book.getWorksheet('DM_Lop')!;
  const teacherSheet = book.getWorksheet('DM_Giao_vien')!;
  const assignmentSheet = book.getWorksheet('Phan_cong')!;
  const classColumns = columnsOf(classSheet);
  const teacherColumns = columnsOf(teacherSheet);
  const assignmentColumns = columnsOf(assignmentSheet);

  const workbookClasses = new Map<string, { grade: number; session: number }>();
  for (let row = 3; row <= classSheet.rowCount; row++) {
    const item = classSheet.getRow(row);
    const name = String(item.getCell(classColumns['Lớp']).value ?? '').trim();
    if (!name) continue;
    workbookClasses.set(name, {
      grade: Number(item.getCell(classColumns['Khối']).value),
      session: String(item.getCell(classColumns['Buổi học']).value).trim() === 'Chiều' ? 1 : 0,
    });
  }

  const workbookTeachers = new Map<string, { reduction: number; effective: number }>();
  for (let row = 3; row <= teacherSheet.rowCount; row++) {
    const item = teacherSheet.getRow(row);
    const code = String(item.getCell(teacherColumns['Mã GV']).value ?? '').trim();
    if (!code) continue;
    workbookTeachers.set(code, {
      reduction: Number(item.getCell(teacherColumns['Giảm trừ tuần']).value ?? 0),
      effective: Number(item.getCell(teacherColumns['Định mức hiệu lực']).value ?? 0),
    });
  }

  const jsonClasses = new Map(data.classes.map((item: any) => [item.name, item]));
  const jsonTeachers = new Map(data.teachers.map((item: any) => [item.code, item]));
  const classMismatch = [...workbookClasses].filter(([name, item]) => {
    const seeded: any = jsonClasses.get(name);
    return !seeded || seeded.gradeLevel !== item.grade || seeded.mainSession !== item.session;
  });
  const teacherMismatch = [...workbookTeachers].filter(([code, item]) => {
    const seeded: any = jsonTeachers.get(code);
    return !seeded || seeded.workloadReduction !== item.reduction || seeded.maxPeriodsPerWeek !== item.effective;
  });

  check(workbookClasses.size === 30 && jsonClasses.size === 30, 'Đủ 30 lớp ở workbook và seed');
  check(
    [...workbookClasses.values()].filter((item) => item.session === 0).length === 21 &&
      [...workbookClasses.values()].filter((item) => item.session === 1).length === 9,
    'Đúng 21 lớp sáng và 9 lớp chiều',
  );
  check(classMismatch.length === 0, 'Buổi học và khối lớp khớp giữa workbook/seed', `${classMismatch.length} dòng lệch`);
  check(teacherMismatch.length === 0, 'Định mức giáo viên khớp giữa workbook/seed', `${teacherMismatch.length} dòng lệch`);

  const perClass = new Map<string, { main: number; opposite: number; ceremonies: number }>();
  const teacherLoads = new Map<string, number>();
  const teacherSessions = new Map<string, Set<number>>();
  const invalidGrades: string[] = [];
  for (let row = 3; row <= assignmentSheet.rowCount; row++) {
    const item = assignmentSheet.getRow(row);
    const className = String(item.getCell(assignmentColumns['Lớp']).value ?? '').trim();
    const subject = String(item.getCell(assignmentColumns['Mã môn']).value ?? '').trim();
    const teacher = String(item.getCell(assignmentColumns['GV HK1 Mã']).value ?? '').trim();
    if (!className || !subject || !teacher) continue;
    const weekly = Number(item.getCell(assignmentColumns['Tiết HK1']).value ?? 0) / 18;
    const shape = perClass.get(className) ?? { main: 0, opposite: 0, ceremonies: 0 };
    if (CEREMONIES.has(subject)) shape.ceremonies += weekly;
    else if (OFF_SESSION.has(subject)) shape.opposite += weekly;
    else shape.main += weekly;
    perClass.set(className, shape);

    if (!CEREMONIES.has(subject)) teacherLoads.set(teacher, (teacherLoads.get(teacher) ?? 0) + weekly);
    if (!CEREMONIES.has(subject) && !OFF_SESSION.has(subject)) {
      const session = workbookClasses.get(className)!.session;
      if (!teacherSessions.has(teacher)) teacherSessions.set(teacher, new Set());
      teacherSessions.get(teacher)!.add(session);
    }
    const seeded: any = jsonTeachers.get(teacher);
    const grade = workbookClasses.get(className)!.grade;
    if (!seeded?.teachableGrades?.includes(grade)) invalidGrades.push(`${className}:${subject}:${teacher}`);
  }

  const badShapes = [...perClass].filter(([, shape]) => shape.main !== 26 || shape.opposite !== 3 || shape.ceremonies !== 2);
  const overloads = [...teacherLoads].filter(([code, load]) => load > workbookTeachers.get(code)!.effective);
  const mixedSessions = [...teacherSessions].filter(([, sessions]) => sessions.size > 1);
  check(badShapes.length === 0, 'Mỗi lớp có 26 tiết chính + 3 tiết trái buổi + 2 tiết tập thể', `${badShapes.length} lớp lệch`);
  check(overloads.length === 0, 'Workbook không có giáo viên vượt định mức hiệu lực', `${overloads.length} giáo viên vượt`);
  check(mixedSessions.length === 0, 'Giáo viên văn hóa chỉ phục vụ một buổi', `${mixedSessions.length} giáo viên dạy hai buổi`);
  check(invalidGrades.length === 0, 'Workbook không phân giáo viên sai khối được dạy', `${invalidGrades.length} dòng sai`);

  const planClasses = data.classes.map((item: any, index: number) => ({
    id: String(index), name: item.name, grade: item.gradeLevel, session: item.mainSession,
    combinationCode: item.combinationCode, homeroomTeacherCode: item.homeroomTeacherCode,
  }));
  const planTeachers = data.teachers.map((item: any) => ({
    code: item.code, name: item.fullName, major: item.majorSubject, department: item.department,
    position: item.position, capacity: item.maxPeriodsPerWeek, teachableGrades: item.teachableGrades,
  }));
  const combinations = data.combinations.map((item: any) => ({
    code: item.code, grade: item.gradeLevel, electives: item.electiveSubjects,
  }));
  const demands = buildDemands(planClasses, combinations);
  const completed = completeAssignments({ classes: planClasses, teachers: planTeachers, demands, submissions: [] });
  const autoErrors = completed.issues.filter((issue) => issue.level === 'ERROR');
  const autoWrongGrades = completed.assignments.filter((assignment) => {
    const teacher: any = jsonTeachers.get(assignment.hk1TeacherCode);
    return !teacher?.teachableGrades?.includes(assignment.grade);
  });
  check(completed.assignments.length === demands.length && completed.stats.unassigned === 0, 'Tự động phân đủ 420/420 dòng');
  check(autoErrors.length === 0, 'Tự động phân công không phát sinh lỗi', `${autoErrors.length} lỗi`);
  check(autoWrongGrades.length === 0, 'Tự động phân công không giao sai khối', `${autoWrongGrades.length} dòng sai`);

  let excelErrors = 0;
  for (const sheet of book.worksheets) {
    sheet.eachRow((row) => row.eachCell((cell) => {
      if (cell.type === ExcelJS.ValueType.Error || /^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/.test(String(cell.value ?? ''))) excelErrors++;
    }));
  }
  check(excelErrors === 0, 'Workbook không có lỗi công thức Excel', `${excelErrors} ô lỗi`);
  check(26 === 6 * 5 - 2 - 2, '26 tiết chính vừa khít cấu hình nghỉ và tiết tập thể');
  check(3 <= 6 * 3, '3 tiết trái buổi nằm trong các tiết 1-3 hoặc 8-10 được phép');

  if (failures.length) {
    console.error(`\nHỎNG ${failures.length} mục.`);
    process.exit(1);
  }
  console.log('\nTất cả điều kiện dữ liệu happy case đều đạt.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
