import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';

async function main() {
  // Backup original
  copyFileSync('D:/NCKH/dulieu.xlsx', 'D:/NCKH/dulieu_backup.xlsx');
  
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('D:/NCKH/dulieu.xlsx');
  
  const ws = wb.getWorksheet('DM_Giao_vien');
  if (!ws) { console.log('Sheet DM_Giao_vien not found!'); return; }

  // Find the last row with data
  let lastRow = 0;
  ws.eachRow((row, rn) => {
    const code = String(row.getCell(1).value ?? '').trim();
    if (code.startsWith('GV')) lastRow = rn;
  });
  console.log('Last GV row:', lastRow);

  // Read header format from existing row
  const templateRow = ws.getRow(3); // GV001 row
  
  // New teachers to add
  const newTeachers = [
    // More HDTN teachers (currently 6 teachers for 42 classes × 3 periods = 126 slots, need 8+)
    ['GV073', 'Nguyễn Văn Hưng', '', '0912345001', 'Tổ Hoạt động', 'HDTN', 'Đang dạy', 17, 0, 17, ''],
    ['GV074', 'Trần Thị Hoa', '', '0912345002', 'Tổ Hoạt động', 'HDTN', 'Đang dạy', 17, 0, 17, ''],
    
    // More TIN teachers (currently 4 teachers for 42 classes × 2 periods = 84 slots, need 6)
    ['GV075', 'Lê Minh Đức', '', '0912345003', 'Tổ Tin học', 'TIN', 'Đang dạy', 17, 0, 17, ''],
    ['GV076', 'Phạm Quốc Tuấn', '', '0912345004', 'Tổ Tin học', 'TIN', 'Đang dạy', 17, 0, 17, ''],
    
    // More GDTC teachers (9 classes per teacher, need to reduce)
    ['GV077', 'Đỗ Văn Thắng', '', '0912345005', 'Tổ Thể chất', 'GDTC', 'Đang dạy', 17, 0, 17, ''],
    
    // More GDQP teacher
    ['GV078', 'Lê Quốc Khánh', '', '0912345006', 'Tổ QP-AN', 'GDQP', 'Đang dạy', 17, 0, 17, ''],
    
    // More LS teachers (9 classes per teacher = 18/wk)
    ['GV079', 'Ngô Thị Linh', '', '0912345007', 'Tổ Lịch sử', 'LS', 'Đang dạy', 17, 0, 17, ''],
    
    // More DIA teacher
    ['GV080', 'Đặng Minh Tuấn', '', '0912345008', 'Tổ Địa lý', 'DIA', 'Đang dạy', 17, 0, 17, ''],
    
    // More GDKT teacher  
    ['GV081', 'Trần Thị Hạnh', '', '0912345009', 'Tổ GDKT&PL', 'GDKT', 'Đang dạy', 17, 0, 17, ''],
    
    // More SINH teacher
    ['GV082', 'Phạm Văn Kiên', '', '0912345010', 'Tổ Sinh học', 'SINH', 'Đang dạy', 17, 0, 17, ''],
    
    // More CN teachers
    ['GV083', 'Hoàng Thị Mai', '', '0912345011', 'Tổ Công nghệ', 'CNCN', 'Đang dạy', 17, 0, 17, ''],
    
    // More MT teacher
    ['GV084', 'Vũ Minh Thành', '', '0912345012', 'Tổ Nghệ thuật', 'MT', 'Đang dạy', 17, 0, 17, ''],
  ];

  for (let i = 0; i < newTeachers.length; i++) {
    const rowNum = lastRow + 1 + i;
    const row = ws.getRow(rowNum);
    const [code, name, gvcn, phone, dept, subj, status, base, reduce, effective, notes] = newTeachers[i];
    row.getCell(1).value = code;
    row.getCell(2).value = name;
    row.getCell(3).value = gvcn;
    row.getCell(4).value = phone;
    row.getCell(5).value = dept;
    row.getCell(6).value = subj;
    row.getCell(7).value = status;
    row.getCell(8).value = base;
    row.getCell(9).value = reduce;
    row.getCell(10).value = effective;
    row.getCell(11).value = notes;
    
    // Copy formatting from template
    for (let c = 1; c <= 11; c++) {
      const tCell = templateRow.getCell(c);
      const nCell = row.getCell(c);
      if (tCell.font) nCell.font = { ...tCell.font };
      if (tCell.alignment) nCell.alignment = { ...tCell.alignment };
      if (tCell.border) nCell.border = { ...tCell.border };
    }
    row.commit();
    console.log(`Added: ${code} - ${name} (${subj})`);
  }

  await wb.xlsx.writeFile('D:/NCKH/dulieu.xlsx');
  console.log('\nDone! Added', newTeachers.length, 'new teachers to dulieu.xlsx');
  console.log('Backup saved as dulieu_backup.xlsx');
}

main().catch(console.error);
