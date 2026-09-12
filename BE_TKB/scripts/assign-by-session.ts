/**
 * Phan cong sao cho moi giao vien chi phuc vu lop cua MOT ca.
 *
 * Do tren thoi khoa bieu that: ca 10 giao vien khong co ngay nghi nao deu day CA HAI buoi.
 * Mot nguoi day vai lop hoc sang va vai lop hoc chieu thi khong co cach nao don lich lai —
 * ho buoc phai co mat ca hai buoi, va so buoi phai toi truong tang gap doi.
 *
 * Truong co 21 lop hoc sang va 9 lop hoc chieu. Chia giao vien cua tung mon thanh hai nhom
 * theo dung ty le nhu cau, thi khong ai phai chay hai ca. Day la cach phan cong thong thuong
 * o truong hoc hai ca, va no khong doi so tiet cua ai.
 *
 * Giao vien chu nhiem bi rang buoc truoc: ho phai theo ca cua lop minh chu nhiem.
 *
 * Chay kem --apply moi ghi de len file mau; khong co thi chi in ra xem truoc.
 */
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const apply = process.argv.includes('--apply');

const columnsOf = (sheet: ExcelJS.Worksheet, headerRow: number) => {
  const map: Record<string, number> = {};
  sheet.getRow(headerRow).eachCell((cell, column) => {
    map[String(cell.value ?? '').trim()] = column;
  });
  return map;
};

/** Chào cờ và sinh hoạt là việc của chủ nhiệm, gắn chặt với lớp — không chia lại. */
const HOMEROOM_DUTIES = ['CHAO_CO', 'SH_CUOI_TUAN'];

(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);

  // ------------------------------------------------------------ ca cua tung lop
  const clsSheet = book.getWorksheet('DM_Lop')!;
  const clsCol = columnsOf(clsSheet, 2);
  const sessionOfClass = new Map<string, string>();
  const homeroomOf = new Map<string, string>();

  for (let r = 3; r <= clsSheet.rowCount; r++) {
    const row = clsSheet.getRow(r);
    const name = String(row.getCell(clsCol['Lớp']).value ?? '').trim();
    if (!name) continue;
    sessionOfClass.set(name, String(row.getCell(clsCol['Buổi học']).value ?? '').trim());
    const gvcn = String(row.getCell(clsCol['GVCN Mã']).value ?? '').trim();
    if (gvcn) homeroomOf.set(gvcn, name);
  }

  // Dinh muc tung nguoi, de khong bao gio giao vuot tran
  const gvSheet = book.getWorksheet('DM_Giao_vien')!;
  const gvCol = columnsOf(gvSheet, 2);
  const quotaOf = new Map<string, number>();
  for (let r = 3; r <= gvSheet.rowCount; r++) {
    const code = String(gvSheet.getRow(r).getCell(gvCol['Mã GV']).value ?? '').trim();
    if (!code) continue;
    const quota = Number(gvSheet.getRow(r).getCell(gvCol['Định mức tuần']).value ?? 17);
    const reduction = Number(gvSheet.getRow(r).getCell(gvCol['Giảm trừ tuần']).value ?? 0);
    quotaOf.set(code, quota - reduction);
  }

  const morningClasses = [...sessionOfClass.values()].filter((s) => s === 'Sáng').length;
  console.log(`${sessionOfClass.size} lop — ${morningClasses} hoc sang, ${sessionOfClass.size - morningClasses} hoc chieu`);

  // ------------------------------------------------------------ phan cong hien tai
  const pc = book.getWorksheet('Phan_cong')!;
  const pcCol = columnsOf(pc, 2);

  interface Row {
    index: number;
    subject: string;
    className: string;
    session: string;
    periods: number;
    teacher: string;
  }

  const rows: Row[] = [];
  const nameOfTeacher = new Map<string, string>();
  for (let r = 3; r <= pc.rowCount; r++) {
    const row = pc.getRow(r);
    const subject = String(row.getCell(pcCol['Mã môn']).value ?? '').trim();
    const className = String(row.getCell(pcCol['Lớp']).value ?? '').trim();
    const teacher = String(row.getCell(pcCol['GV HK1 Mã']).value ?? '').trim();
    if (!subject || !className || !teacher) continue;

    nameOfTeacher.set(teacher, String(row.getCell(pcCol['GV HK1 Họ tên']).value ?? '').trim());
    rows.push({
      index: r,
      subject,
      className,
      session: sessionOfClass.get(className) ?? 'Sáng',
      periods: Number(row.getCell(pcCol['Tiết HK1']).value ?? 0),
      teacher,
    });
  }

  const before = new Set(
    rows
      .filter((row) => rows.some((other) => other.teacher === row.teacher && other.session !== row.session))
      .map((row) => row.teacher),
  );
  console.log(`Truoc: ${before.size} giao vien phai day ca hai buoi\n`);

  // ------------------------------------------------------------ chia ca
  // Chủ nhiệm bị neo theo ca của lớp mình. Những người còn lại được xếp vào ca nào ít việc
  // hơn so với nhu cầu, môn nào chia theo môn đó.
  const fixedSession = new Map<string, string>();
  for (const [teacher, className] of homeroomOf) {
    const session = sessionOfClass.get(className);
    if (session) fixedSession.set(teacher, session);
  }

  const bySubject = new Map<string, Row[]>();
  for (const row of rows) {
    if (HOMEROOM_DUTIES.includes(row.subject)) continue;
    if (!bySubject.has(row.subject)) bySubject.set(row.subject, []);
    bySubject.get(row.subject)!.push(row);
  }

  // Tai tinh tren TOAN BO cac mon: mot giao vien co the day hai mon, va tran ap tren tong
  const globalLoad = new Map<string, number>();
  for (const row of rows) {
    if (HOMEROOM_DUTIES.includes(row.subject)) continue;
    globalLoad.set(row.teacher, 0);
  }
  // Nhiem vu chu nhiem khong tinh vao tran, nhung van phai giu nguyen nguoi

  let moved = 0;
  for (const [subject, subjectRows] of bySubject) {
    const teachers = [...new Set(subjectRows.map((r) => r.teacher))];
    const demand = { Sáng: 0, Chiều: 0 } as Record<string, number>;
    for (const row of subjectRows) demand[row.session] = (demand[row.session] ?? 0) + row.periods;

    // Chia số người theo đúng tỷ lệ nhu cầu, ít nhất một người mỗi ca nếu ca đó có việc
    const total = demand['Sáng'] + demand['Chiều'];
    let morningCount = total > 0 ? Math.round((demand['Sáng'] / total) * teachers.length) : teachers.length;
    if (demand['Sáng'] > 0) morningCount = Math.max(1, morningCount);
    if (demand['Chiều'] > 0) morningCount = Math.min(teachers.length - 1, morningCount);

    // Người bị neo sẵn xếp trước, phần còn lại điền vào chỗ trống
    const morning: string[] = [];
    const afternoon: string[] = [];
    for (const teacher of teachers) {
      const fixed = fixedSession.get(teacher);
      if (fixed === 'Sáng') morning.push(teacher);
      else if (fixed === 'Chiều') afternoon.push(teacher);
    }
    for (const teacher of teachers) {
      if (morning.includes(teacher) || afternoon.includes(teacher)) continue;
      if (morning.length < morningCount) morning.push(teacher);
      else afternoon.push(teacher);
    }

    // Giao lai từng dòng cho người nhẹ nhất trong đúng ca của lớp.
    //
    // Trần định mức được ưu tiên hơn việc chia ca: vượt định mức là lỗi CHẶN, thời khóa biểu
    // không xếp được; còn dạy hai ca chỉ là một khoản phạt mềm. Nên khi cả ca đúng đã đầy,
    // dòng đó đi sang ca kia thay vì đẩy ai đó vượt trần.
    for (const row of [...subjectRows].sort((a, b) => b.periods - a.periods)) {
      const preferred = row.session === 'Sáng' ? morning : afternoon;
      const fallback = row.session === 'Sáng' ? afternoon : morning;

      const fits = (teacher: string) =>
        (globalLoad.get(teacher) ?? 0) + row.periods <= (quotaOf.get(teacher) ?? 17);

      const pick = (pool: string[]) =>
        pool
          .filter(fits)
          .sort((a, b) => (globalLoad.get(a) ?? 0) - (globalLoad.get(b) ?? 0))[0];

      const chosen = pick(preferred) ?? pick(fallback) ?? row.teacher;
      globalLoad.set(chosen, (globalLoad.get(chosen) ?? 0) + row.periods);
      if (chosen !== row.teacher) moved += 1;
      row.teacher = chosen;
    }
  }

  const after = new Set(
    rows
      .filter((row) => rows.some((other) => other.teacher === row.teacher && other.session !== row.session))
      .map((row) => row.teacher),
  );
  console.log(`Sau : ${after.size} giao vien phai day ca hai buoi`);
  console.log(`${moved} dong phan cong doi nguoi day.`);

  if (!apply) {
    console.log('\nXem truoc. Them --apply de ghi de len file mau.');
    return;
  }

  for (const row of rows) {
    const sheetRow = pc.getRow(row.index);
    sheetRow.getCell(pcCol['GV HK1 Mã']).value = row.teacher;
    sheetRow.getCell(pcCol['GV HK1 Họ tên']).value = nameOfTeacher.get(row.teacher) ?? '';
    sheetRow.getCell(pcCol['GV HK2 Mã']).value = row.teacher;
    sheetRow.getCell(pcCol['GV HK2 Họ tên']).value = nameOfTeacher.get(row.teacher) ?? '';
    sheetRow.commit();
  }
  await book.xlsx.writeFile(SOURCE);
  console.log('\nDa ghi lai file mau.');
})();
