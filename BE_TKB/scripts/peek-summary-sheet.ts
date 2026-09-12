import * as path from 'path';
import * as ExcelJS from 'exceljs';
const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);
  const sheet = book.getWorksheet('Tong_hop_GV')!;
  console.log(`${sheet.rowCount} dong, ${sheet.columnCount} cot`);
  for (const r of [2, 3, 4, sheet.rowCount]) {
    const cells: string[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (c) => {
      const v: any = c.value;
      cells.push(v && typeof v === 'object' && 'formula' in v ? `=${v.formula}` : String(v ?? ''));
    });
    console.log(`r${r}: ${cells.join(' | ')}`);
  }
})();
