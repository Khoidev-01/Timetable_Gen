/**
 * Sua file du lieu mau cho du nguoi va du phong.
 *
 * File goc khai 6 giao vien To Hoat dong nhung chi giao HDTN cho 3 nguoi (moi nguoi 10 lop
 * = 30 tiet/tuan tren dinh muc 17), con 3 nguoi kia chi day GDDP. Cong viec cua ca to la
 * 90 tiet HDTN + 30 tiet GDDP = 120 tiet/tuan, nen 6 nguoi van thieu: can it nhat 8.
 * Tuong tu, Tin hoc can 69 tiet/tuan ma chi co 4 giao vien (68 tiet).
 *
 * Phong thi thieu that: Ly va Hoa moi mon can 66 tiet thuc hanh nhung moi mon chi co mot
 * phong, ma mot phong toi da 60 tiet/tuan.
 *
 * Chay kem --apply moi ghi de len file; khong co thi chi in ra xem truoc.
 */
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const apply = process.argv.includes('--apply');

/** Cot trong tung sheet, doc theo tieu de o dong 2. */
const columnsOf = (sheet: ExcelJS.Worksheet, headerRow: number) => {
  const map: Record<string, number> = {};
  sheet.getRow(headerRow).eachCell((cell, column) => {
    map[String(cell.value ?? '').trim()] = column;
  });
  return map;
};

interface NewTeacher {
  code: string;
  name: string;
  team: string;
  subject: string;
  phone: string;
}

const NEW_TEACHERS: NewTeacher[] = [
  { code: 'GV073', name: 'Nguyễn Thị Quỳnh Chi', team: 'Tổ Hoạt động', subject: 'HDTN', phone: '0912004501' },
  { code: 'GV074', name: 'Trần Đức Khải', team: 'Tổ Hoạt động', subject: 'HDTN', phone: '0912004502' },
  { code: 'GV075', name: 'Lê Hoàng Nam', team: 'Tổ Tin học', subject: 'TIN', phone: '0912004503' },
];

const NEW_ROOMS = [
  { name: '316', type: 'Lab Vật lý', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng thực hành Vật lý thứ hai' },
  { name: '317', type: 'Lab Hóa học', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng thực hành Hóa học thứ hai' },
  // 102 tiet thuc hanh Tin moi tuan tren hai phong la kin 85% — vua du tren giay, nhung
  // moi tiet con phai roi dung buoi hoc cua lop, nen thuc te khong xep het
  { name: '318', type: 'Phòng Tin học', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng máy thứ ba' },
];

/** Chia lai cong viec cua mot nhom mon cho mot nhom giao vien, nguoi nhe tay nhat nhan truoc. */
function rebalance(
  rows: Array<{ row: number; periods: number; subject: string; className: string }>,
  teachers: string[],
) {
  const load = new Map(teachers.map((t) => [t, 0]));
  const plan: Array<{ row: number; teacher: string; subject: string; className: string }> = [];

  // Lop nang truoc, de phan con lai con cho xoay
  for (const row of [...rows].sort((a, b) => b.periods - a.periods)) {
    const chosen = [...load.entries()].sort((a, b) => a[1] - b[1])[0][0];
    load.set(chosen, load.get(chosen)! + row.periods);
    plan.push({ row: row.row, teacher: chosen, subject: row.subject, className: row.className });
  }
  return { plan, load };
}

(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);

  // ------------------------------------------------------------ giao vien
  const gv = book.getWorksheet('DM_Giao_vien')!;
  const gvCol = columnsOf(gv, 2);
  const nameOf = new Map<string, string>();
  const existingTeacherCodes = new Set<string>();
  for (let r = 3; r <= gv.rowCount; r++) {
    const code = String(gv.getRow(r).getCell(gvCol['Mã GV']).value ?? '').trim();
    if (!code) continue;
    nameOf.set(code, String(gv.getRow(r).getCell(gvCol['Họ tên']).value ?? '').trim());
    existingTeacherCodes.add(code);
  }

  let nextRow = gv.rowCount + 1;
  for (const teacher of NEW_TEACHERS) {
    nameOf.set(teacher.code, teacher.name);
    if (!apply) continue;
    // Chay lai lan hai khong duoc them trung: file da co ma nay thi bo qua
    if (existingTeacherCodes.has(teacher.code)) {
      console.log(`  (da co ${teacher.code}, bo qua)`);
      continue;
    }
    const row = gv.getRow(nextRow);
    row.getCell(gvCol['Mã GV']).value = teacher.code;
    row.getCell(gvCol['Họ tên']).value = teacher.name;
    row.getCell(gvCol['Liên hệ']).value = teacher.phone;
    row.getCell(gvCol['Tổ CM']).value = teacher.team;
    row.getCell(gvCol['Môn chuyên môn chính']).value = teacher.subject;
    row.getCell(gvCol['Trạng thái']).value = 'Đang dạy';
    row.getCell(gvCol['Định mức tuần']).value = 17;
    row.getCell(gvCol['Giảm trừ tuần']).value = 0;
    row.getCell(gvCol['Định mức hiệu lực']).value = 17;
    row.commit();
    nextRow += 1;
  }
  console.log(`Them ${NEW_TEACHERS.length} giao vien: ${NEW_TEACHERS.map((t) => `${t.code} ${t.name} (${t.subject})`).join(', ')}`);

  // ------------------------------------------------------------ phan cong
  const pc = book.getWorksheet('Phan_cong')!;
  const pcCol = columnsOf(pc, 2);

  const collect = (subjects: string[]) => {
    const rows: Array<{ row: number; periods: number; subject: string; className: string }> = [];
    for (let r = 3; r <= pc.rowCount; r++) {
      const subject = String(pc.getRow(r).getCell(pcCol['Mã môn']).value ?? '').trim();
      if (!subjects.includes(subject)) continue;
      rows.push({
        row: r,
        periods: Number(pc.getRow(r).getCell(pcCol['Tiết HK1']).value ?? 0),
        subject,
        className: String(pc.getRow(r).getCell(pcCol['Lớp']).value ?? ''),
      });
    }
    return rows;
  };

  const activityTeachers = ['GV067', 'GV068', 'GV069', 'GV070', 'GV071', 'GV072', 'GV073', 'GV074'];
  const itTeachers = ['GV050', 'GV051', 'GV052', 'GV053', 'GV075'];

  /** Ai day mon nay, doc tu cot "Mon chuyen mon chinh" cua sheet giao vien. */
  const specialistsOf = (subject: string) => {
    const codes: string[] = [];
    for (let r = 3; r <= gv.rowCount; r++) {
      const code = String(gv.getRow(r).getCell(gvCol['Mã GV']).value ?? '').trim();
      const major = String(gv.getRow(r).getCell(gvCol['Môn chuyên môn chính']).value ?? '').trim();
      if (code && major === subject) codes.push(code);
    }
    return codes;
  };

  const groups = [
    { label: 'Tổ Hoạt động (HDTN + GDDP)', rows: collect(['HDTN', 'GDDP']), teachers: activityTeachers },
    { label: 'Tổ Tin học (TIN)', rows: collect(['TIN']), teachers: itTeachers },
    // Nam mon con lai chi lech 1-3 tiet: khong thieu nguoi, chi la chia chua deu
    { label: 'Vật lý', rows: collect(['LY']), teachers: specialistsOf('LY') },
    { label: 'Hóa học', rows: collect(['HOA']), teachers: specialistsOf('HOA') },
    { label: 'Giáo dục kinh tế và pháp luật', rows: collect(['GDKT']), teachers: specialistsOf('GDKT') },
  ];

  for (const group of groups) {
    const { plan, load } = rebalance(group.rows, group.teachers);
    console.log(`\n${group.label}: chia lai ${plan.length} dong cho ${group.teachers.length} giao vien`);
    console.log('  Tai sau khi chia: ' + [...load].map(([t, n]) => `${t}=${n}`).join(' '));

    if (!apply) continue;
    for (const item of plan) {
      const row = pc.getRow(item.row);
      row.getCell(pcCol['GV HK1 Mã']).value = item.teacher;
      row.getCell(pcCol['GV HK1 Họ tên']).value = nameOf.get(item.teacher) ?? '';
      row.getCell(pcCol['GV HK2 Mã']).value = item.teacher;
      row.getCell(pcCol['GV HK2 Họ tên']).value = nameOf.get(item.teacher) ?? '';
      row.commit();
    }
  }

  // ------------------------------------------------------------ phong
  const ph = book.getWorksheet('DM_Phong')!;
  const phCol = columnsOf(ph, 2);
  const existingRooms = new Set<string>();
  for (let r = 3; r <= ph.rowCount; r++) {
    const name = String(ph.getRow(r).getCell(phCol['Tên phòng']).value ?? '').trim();
    if (name) existingRooms.add(name);
  }

  let roomRow = ph.rowCount + 1;
  for (const room of NEW_ROOMS) {
    if (!apply) continue;
    if (existingRooms.has(room.name)) {
      console.log(`  (da co phong ${room.name}, bo qua)`);
      continue;
    }
    const row = ph.getRow(roomRow);
    row.getCell(phCol['Tên phòng']).value = room.name;
    row.getCell(phCol['Loại']).value = room.type;
    row.getCell(phCol['Tầng']).value = room.floor;
    row.getCell(phCol['Sức chứa']).value = room.capacity;
    row.getCell(phCol['Buổi']).value = room.session;
    row.getCell(phCol['Ghi chú']).value = room.note;
    row.commit();
    roomRow += 1;
  }
  console.log(`\nThem ${NEW_ROOMS.length} phong: ${NEW_ROOMS.map((r) => `${r.name} (${r.type})`).join(', ')}`);

  if (!apply) {
    console.log('\nXem truoc. Them --apply de ghi de len file mau.');
    return;
  }

  await book.xlsx.writeFile(SOURCE);
  console.log('\nDa ghi lai file mau.');
})();
