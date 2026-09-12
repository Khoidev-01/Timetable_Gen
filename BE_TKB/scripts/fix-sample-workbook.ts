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
  // Tinh dung giam tru chu nhiem (4 tiet) thi Ly con du dung 3 tiet tren 66 tiet nhu cau, va
  // bon trong nam nguoi da kin dinh muc. Bon phan tram du la khong du cho mot bo giai xoay:
  // no phai xep dung nguoi con cho vao dung gio lop can. Hoa cung vay, du 7 tiet.
  { code: 'GV076', name: 'Nguyễn Thị Bích Hằng', team: 'Tổ Lý - Hóa', subject: 'LY', phone: '0912004504' },
  { code: 'GV077', name: 'Trương Văn Hậu', team: 'Tổ Lý - Hóa', subject: 'HOA', phone: '0912004505' },
];

const NEW_ROOMS = [
  { name: '316', type: 'Lab Vật lý', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng thực hành Vật lý thứ hai' },
  { name: '317', type: 'Lab Hóa học', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng thực hành Hóa học thứ hai' },
  // 102 tiet thuc hanh Tin moi tuan tren hai phong la kin 85% — vua du tren giay, nhung
  // moi tiet con phai roi dung buoi hoc cua lop, nen thuc te khong xep het
  { name: '318', type: 'Phòng Tin học', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng máy thứ ba' },
  // Sinh chi can 30 tiet/tuan nen mot phong la du tren giay. Nhung 30 lop deu hoc buoi
  // chinh cua minh, nen nhu cau don cuc vao vai khung gio: lop nao kin lich thi dung 3 o
  // con lai deu vuong dung cai phong Sinh duy nhat.
  { name: '319', type: 'Lab Sinh học', floor: 3, capacity: 45, session: 'Cả ngày', note: 'Phòng thực hành Sinh học thứ hai' },
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

  // ------------------------------------------------------------ giam tru chu nhiem
  // Giao vien chu nhiem THPT duoc giam 4 tiet moi tuan (Thong tu 05/2025). File mau dang de
  // 0 cho 37 nguoi va 3 cho 5 nguoi — nghia la cong viec chu nhiem khong duoc tinh vao dau
  // ca, va bang phan cong nhin thi thay ho ranh hon thuc te.
  //
  // He thong luu dinh muc DA TRU vao "Dinh muc hieu luc", nen dat lai ca hai cot: giam tru 4
  // va hieu luc 13.
  const HOMEROOM_REDUCTION = 4;
  if (apply) {
    // Truong co 30 lop, nhung 42 nguoi tu khai chu nhiem — muoi hai nguoi khai cac lop
    // 10C11-10C14, 11B10-11B14, 12A12-12A14 khong he ton tai, sot lai tu mot bo cuc truong
    // lon hon. Ho van day du tai, nen giam tru cho ho la cat mat bon tiet cua mot nguoi
    // khong lam chu nhiem, va ho lap tuc vuot dinh muc.
    const realClasses = new Set<string>();
    const classSheetForHomeroom = book.getWorksheet('DM_Lop');
    if (classSheetForHomeroom) {
      const c = columnsOf(classSheetForHomeroom, 2);
      for (let r = 3; r <= classSheetForHomeroom.rowCount; r++) {
        const name = String(classSheetForHomeroom.getRow(r).getCell(c['Lớp']).value ?? '').trim();
        if (name) realClasses.add(name);
      }
    }

    let reduced = 0;
    let cleared = 0;
    for (let r = 3; r <= gv.rowCount; r++) {
      const row = gv.getRow(r);
      const code = String(row.getCell(gvCol['Mã GV']).value ?? '').trim();
      const homeroom = String(row.getCell(gvCol['GVCN']).value ?? '').trim();
      if (!code) continue;

      const base = Number(row.getCell(gvCol['Định mức tuần']).value ?? 17);

      if (homeroom && !realClasses.has(homeroom)) {
        row.getCell(gvCol['GVCN']).value = '';
        row.getCell(gvCol['Giảm trừ tuần']).value = 0;
        row.getCell(gvCol['Định mức hiệu lực']).value = base;
        cleared += 1;
      } else if (homeroom) {
        row.getCell(gvCol['Giảm trừ tuần']).value = HOMEROOM_REDUCTION;
        row.getCell(gvCol['Định mức hiệu lực']).value = base - HOMEROOM_REDUCTION;
        reduced += 1;
      }
      row.commit();
    }
    console.log(`
Giam tru ${HOMEROOM_REDUCTION} tiet cho ${reduced} giao vien chu nhiem that — dinh muc hieu luc con ${17 - HOMEROOM_REDUCTION}.`);
    console.log(`Xoa ${cleared} dong khai chu nhiem lop khong ton tai.`);
  }

  // ------------------------------------------------------------ dinh muc tiet
  // Dua phan bo tiet ve dung dinh muc GDPT 2018 cho cap THPT (Thong tu 32/2018, sua doi boi
  // Thong tu 13/2022). So tiet/tuan = so tiet/nam chia 35 tuan:
  //
  //   Ngu van 105, Toan 105, Ngoai ngu 1 105, Hoat dong trai nghiem 105  -> 3 tiet/tuan
  //   Giao duc the chat 70                                               -> 2
  //   GD quoc phong 35, GD dia phuong 35                                 -> 1
  //   Lich su 52 (phan bat buoc theo TT 13/2022)                         -> 1,49
  //
  // File mau lech dung hai cho: Toan 4 tiet va Lich su 2 tiet ca nam. Phan con lai da dung,
  // ke ca mau mon lua chon — bon mon moi mon 2 tiet, cong 3 tiet chuyen de gop vao ba trong
  // bon mon do, thanh 3+3+3+2.
  //
  // Hai tiet doi ra khong chi la chuyen dung chuan. Lop nao cung dang can 29 tren 29 o buoi
  // chinh, khong con mot o nao de xoay, va do la ly do kiem tra tien xep lich bao "gan kin
  // lich" cho hang loat lop. Cat dung so tiet khong duoc day la tra lai cho bo giai cho tho.
  const CURRICULUM_FIX: Record<string, { hk1: number; hk2: number; why: string }> = {
    // 105 tiet/nam = 3 tiet/tuan, khong phai 4
    TOAN: { hk1: 3, hk2: 3, why: 'Toan 105 tiet/nam' },
    // 52 tiet/nam. Chia 2 tiet/tuan o HK1 (18 tuan) va 1 tiet/tuan o HK2 (17 tuan) = 53,
    // sat nhat voi 52 ma van la so tiet nguyen trong moi tuan
    LS: { hk1: 2, hk2: 1, why: 'Lich su 52 tiet/nam' },
  };

  if (apply) {
    let adjusted = 0;
    for (let r = 3; r <= pc.rowCount; r++) {
      const row = pc.getRow(r);
      const subject = String(row.getCell(pcCol['Mã môn']).value ?? '').trim();
      const fix = CURRICULUM_FIX[subject];
      if (!fix) continue;

      if (Number(row.getCell(pcCol['Tiết HK1']).value ?? 0) !== fix.hk1) {
        row.getCell(pcCol['Tiết HK1']).value = fix.hk1;
        adjusted += 1;
      }
      if (Number(row.getCell(pcCol['Tiết HK2']).value ?? 0) !== fix.hk2) {
        row.getCell(pcCol['Tiết HK2']).value = fix.hk2;
        adjusted += 1;
      }
      row.commit();
    }
    console.log(`\nDa sua ${adjusted} o so tiet ve dung dinh muc GDPT 2018:`);
    Object.entries(CURRICULUM_FIX).forEach(([code, fix]) =>
      console.log(`  ${code}: HK1 ${fix.hk1} tiet, HK2 ${fix.hk2} tiet — ${fix.why}`),
    );
  }

  // ------------------------------------------------------------ bang tong hop
  // Sheet nay la bao cao, khong phai dau vao — bo nhap khong doc no. Nhung no van la thu
  // nguoi dung mo ra doi chieu, va no dang la nhung con so tinh tu truoc khi chia lai: mot
  // bao cao sai con te hon khong co bao cao, vi khong ai nghi la phai nghi ngo no.
  const summary = book.getWorksheet('Tong_hop_GV');
  if (summary && apply) {
    const sumCol = columnsOf(summary, 2);

    // Chao co va sinh hoat cuoi tuan khong phai tiet day: tinh chung vao phan chenh lech
    // dinh muc la tinh hai lan, vi nhiem vu chu nhiem da duoc bu bang phan giam tru
    const CEREMONY = ['CHAO_CO', 'SH_CUOI_TUAN'];
    const load = new Map<string, { hk1: number; hk2: number; rows1: number; rows2: number; ceremony: number }>();
    const bump = (code: string) => {
      if (!code) return undefined;
      if (!load.has(code)) load.set(code, { hk1: 0, hk2: 0, rows1: 0, rows2: 0, ceremony: 0 });
      return load.get(code)!;
    };

    for (let r = 3; r <= pc.rowCount; r++) {
      const row = pc.getRow(r);
      const subject = String(row.getCell(pcCol['Mã môn']).value ?? '').trim();
      const isCeremony = CEREMONY.includes(subject);

      const teacher1 = bump(String(row.getCell(pcCol['GV HK1 Mã']).value ?? '').trim());
      if (teacher1) {
        const periods = Number(row.getCell(pcCol['Tiết HK1']).value ?? 0);
        teacher1.hk1 += periods;
        teacher1.rows1 += 1;
        if (isCeremony) teacher1.ceremony += periods;
      }

      const teacher2 = bump(String(row.getCell(pcCol['GV HK2 Mã']).value ?? '').trim());
      if (teacher2) {
        teacher2.hk2 += Number(row.getCell(pcCol['Tiết HK2']).value ?? 0);
        teacher2.rows2 += 1;
      }
    }

    // Viet lai tu dong 3 tro di, mot dong moi giao vien, theo dung thu tu sheet giao vien
    const teacherRows: Array<{ code: string; name: string; team: string; quota: number; reduction: number }> = [];
    for (let r = 3; r <= gv.rowCount; r++) {
      const code = String(gv.getRow(r).getCell(gvCol['Mã GV']).value ?? '').trim();
      if (!code) continue;
      teacherRows.push({
        code,
        name: String(gv.getRow(r).getCell(gvCol['Họ tên']).value ?? '').trim(),
        team: String(gv.getRow(r).getCell(gvCol['Tổ CM']).value ?? '').trim(),
        quota: Number(gv.getRow(r).getCell(gvCol['Định mức tuần']).value ?? 17),
        reduction: Number(gv.getRow(r).getCell(gvCol['Giảm trừ tuần']).value ?? 0),
      });
    }

    for (let r = summary.rowCount; r >= 3; r--) summary.spliceRows(r, 1);

    teacherRows.forEach((teacher, index) => {
      const stats = load.get(teacher.code) ?? { hk1: 0, hk2: 0, rows1: 0, rows2: 0, ceremony: 0 };
      const effective = teacher.quota - teacher.reduction;
      const teaching1 = stats.hk1 - stats.ceremony;

      const row = summary.getRow(3 + index);
      row.getCell(sumCol['Mã GV']).value = teacher.code;
      row.getCell(sumCol['Họ tên']).value = teacher.name;
      row.getCell(sumCol['Tổ CM']).value = teacher.team;
      row.getCell(sumCol['Định mức tuần']).value = teacher.quota;
      row.getCell(sumCol['Giảm trừ tuần']).value = teacher.reduction;
      row.getCell(sumCol['Định mức hiệu lực']).value = effective;
      row.getCell(sumCol['Tổng tiết HK1']).value = stats.hk1;
      row.getCell(sumCol['Tổng tiết HK2']).value = stats.hk2;
      row.getCell(sumCol['Chênh HK1']).value = teaching1 - effective;
      row.getCell(sumCol['Chênh HK2']).value = stats.hk2 - stats.ceremony - effective;
      row.getCell(sumCol['Tổng tiết năm']).value = stats.hk1 + stats.hk2;
      row.getCell(sumCol['Số dòng PC HK1']).value = stats.rows1;
      row.getCell(sumCol['Số dòng PC HK2']).value = stats.rows2;
      row.getCell(sumCol['Ghi chú']).value = stats.ceremony
        ? `Cột chênh đã trừ ${stats.ceremony} tiết nghi lễ (chào cờ, sinh hoạt cuối tuần)`
        : '';
      row.commit();
    });

    const over = teacherRows.filter((t) => {
      const stats = load.get(t.code);
      return stats && stats.hk1 - stats.ceremony > t.quota - t.reduction;
    });
    console.log(`\nDa dung lai bang Tong_hop_GV: ${teacherRows.length} giao vien, ${over.length} nguoi vuot dinh muc.`);
  }

  if (!apply) {
    console.log('\nXem truoc. Them --apply de ghi de len file mau.');
    return;
  }

  await book.xlsx.writeFile(SOURCE);
  console.log('\nDa ghi lai file mau.');
})();
