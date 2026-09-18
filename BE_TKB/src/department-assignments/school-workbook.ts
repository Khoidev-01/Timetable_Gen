import * as ExcelJS from 'exceljs';

/**
 * Ghi bảng phân công hoàn chỉnh ra đúng mẫu nhập của hệ thống (các sheet DM_Giao_vien, DM_Lop,
 * DM_Phong, DM_To_hop, Phan_cong). Đây là "mẫu cuối cùng": admin tải về xem được, và chính file
 * này được đưa qua đường Nhập Excel thật để xếp thời khóa biểu.
 */

export interface WorkbookTeacher {
  code: string;
  name: string;
  homeroomClass?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  major?: string | null;
  position: string;
  baseLoad: number;
  reduction: number;
  effectiveLoad: number;
  notes?: string | null;
}

export interface WorkbookClass {
  name: string;
  grade: number;
  students?: number | null;
  session: number;
  combinationCode?: string | null;
  roomName?: string | null;
  homeroomCode?: string | null;
  homeroomName?: string | null;
}

export interface WorkbookRoom {
  name: string;
  type: string;
  floor: number;
  capacity: number;
  fixedClasses: string[];
}

export interface WorkbookCombination {
  code: string;
  grade: number;
  electives: string[];
}

export interface WorkbookAssignment {
  className: string;
  grade: number;
  combinationCode?: string | null;
  subjectCode: string;
  subjectName: string;
  group: string;
  /** Tiết/tuần */
  weekly: number;
  practice: boolean;
  hk1TeacherCode: string;
  hk1TeacherName: string;
  hk2TeacherCode: string;
  hk2TeacherName: string;
  note: string;
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  CLASSROOM: 'Phòng học',
  LAB_PHYSICS: 'Lab Vật lý',
  LAB_CHEM: 'Lab Hóa học',
  LAB_BIO: 'Lab Sinh học',
  LAB_IT: 'Phòng Tin học',
  YARD: 'Sân bãi',
  MULTI_PURPOSE: 'Đa năng',
};

const POSITION_LABEL: Record<string, string> = { TT: 'Tổ trưởng', TP: 'Tổ phó' };

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

export function addTableSheet(wb: ExcelJS.Workbook, name: string, title: string, headers: string[], rows: unknown[][], widths: number[]) {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]);
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getRow(1).font = { bold: true, size: 13 };
  const header = ws.addRow(headers);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin' } };
  });
  rows.forEach((r) => ws.addRow(r));
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return ws;
}

export async function writeSchoolWorkbook(data: {
  yearName: string;
  hk1Weeks: number;
  hk2Weeks: number;
  teachers: WorkbookTeacher[];
  classes: WorkbookClass[];
  rooms: WorkbookRoom[];
  combinations: WorkbookCombination[];
  assignments: WorkbookAssignment[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  addTableSheet(wb, 'DM_Giao_vien', `Danh mục giáo viên - Năm học ${data.yearName}`,
    ['Mã GV', 'Họ tên', 'GVCN', 'Liên hệ', 'Email', 'Tổ CM', 'Chức vụ', 'Môn chuyên môn chính', 'Trạng thái', 'Định mức tuần', 'Giảm trừ tuần', 'Định mức hiệu lực', 'Ghi chú'],
    data.teachers.map((t) => [t.code, t.name, t.homeroomClass ?? '', t.phone ?? '', t.email ?? '', t.department ?? '', POSITION_LABEL[t.position] ?? '', t.major ?? '', 'Đang dạy', t.baseLoad, t.reduction, t.effectiveLoad, t.notes ?? '']),
    [9, 24, 8, 13, 24, 30, 11, 12, 11, 10, 10, 11, 50]);

  addTableSheet(wb, 'DM_Lop', `Danh mục lớp - Năm học ${data.yearName}`,
    ['Lớp', 'Khối', 'Sĩ số', 'Buổi học', 'Mã tổ hợp', 'Phòng chính', 'GVCN Mã', 'GVCN Họ tên', 'Ghi chú'],
    data.classes.map((c) => [c.name, c.grade, c.students ?? '', c.session === 0 ? 'Sáng' : 'Chiều', c.combinationCode ?? '', c.roomName ?? '', c.homeroomCode ?? '', c.homeroomName ?? '', '']),
    [8, 7, 7, 9, 10, 11, 10, 24, 20]);

  addTableSheet(wb, 'DM_Phong', 'Danh mục phòng học',
    ['Tên phòng', 'Loại', 'Tầng', 'Sức chứa', 'Buổi', 'Lớp cố định', 'Ghi chú'],
    data.rooms.map((r) => [r.name, ROOM_TYPE_LABEL[r.type] ?? 'Phòng học', r.floor, r.capacity, 'Cả ngày', r.fixedClasses.join(', '), '']),
    [11, 16, 7, 9, 10, 16, 30]);

  addTableSheet(wb, 'DM_To_hop', 'Danh mục tổ hợp môn học',
    ['Mã tổ hợp', 'Khối', 'Môn tự chọn 1', 'Môn tự chọn 2', 'Môn tự chọn 3', 'Môn tự chọn 4', 'Ghi chú'],
    data.combinations.map((c) => [c.code, c.grade, c.electives[0] ?? '', c.electives[1] ?? '', c.electives[2] ?? '', c.electives[3] ?? '', '']),
    [11, 7, 14, 14, 14, 14, 20]);

  addTableSheet(wb, 'Phan_cong', `Bảng phân công giảng dạy - Năm học ${data.yearName}`,
    ['STT', 'Năm học', 'Khối', 'Lớp', 'Mã tổ hợp', 'Mã môn', 'Tên môn', 'Nhóm CT', 'Tiết HK1', 'Tiết HK2', 'GV HK1 Mã', 'GV HK1 Họ tên', 'GV HK2 Mã', 'GV HK2 Họ tên', 'Ghi chú'],
    data.assignments.map((a, i) => [
      i + 1, data.yearName, a.grade, a.className, a.combinationCode ?? '', a.subjectCode, a.subjectName, a.group,
      a.weekly * data.hk1Weeks, a.weekly * data.hk2Weeks, a.hk1TeacherCode, a.hk1TeacherName, a.hk2TeacherCode, a.hk2TeacherName, a.note,
    ]),
    [6, 10, 6, 7, 9, 13, 30, 22, 8, 8, 10, 22, 10, 22, 30]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
