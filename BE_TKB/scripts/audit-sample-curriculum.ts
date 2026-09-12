import * as path from 'path';
import * as ExcelJS from 'exceljs';
const SOURCE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
(async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);
  const pc = book.getWorksheet('Phan_cong')!;
  const col: Record<string, number> = {};
  pc.getRow(2).eachCell((c, i) => { col[String(c.value ?? '').trim()] = i; });

  // Tiet moi tuan theo mon, gom theo lop
  const perClass = new Map<string, Map<string, number>>();
  for (let r = 3; r <= pc.rowCount; r++) {
    const cls = String(pc.getRow(r).getCell(col['Lớp']).value ?? '').trim();
    const subject = String(pc.getRow(r).getCell(col['Mã môn']).value ?? '').trim();
    const periods = Number(pc.getRow(r).getCell(col['Tiết HK1']).value ?? 0);
    if (!cls || !subject) continue;
    if (!perClass.has(cls)) perClass.set(cls, new Map());
    const m = perClass.get(cls)!;
    m.set(subject, (m.get(subject) ?? 0) + periods);
  }

  // Mau phan bo: cac lop giong nhau thi gom lai
  const patterns = new Map<string, string[]>();
  for (const [cls, subjects] of perClass) {
    const key = [...subjects].sort().map(([s, n]) => `${s}:${n}`).join(' ');
    if (!patterns.has(key)) patterns.set(key, []);
    patterns.get(key)!.push(cls);
  }

  console.log(`${perClass.size} lop, ${patterns.size} kieu phan bo khac nhau\n`);
  let i = 0;
  for (const [key, classes] of patterns) {
    i++;
    const total = key.split(' ').reduce((sum, part) => sum + Number(part.split(':')[1]), 0);
    console.log(`Kieu ${i} (${classes.length} lop: ${classes.slice(0, 4).join(', ')}${classes.length > 4 ? '...' : ''}) — TONG ${total} tiet/tuan`);
    console.log('  ' + key.split(' ').join('  '));
  }
})();
