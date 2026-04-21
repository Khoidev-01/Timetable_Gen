/**
 * Script tạo bộ dữ liệu mẫu dựa trên cấu trúc của dulieu.xlsx
 * Giữ nguyên format, chỉ giảm xuống 30 lớp theo yêu cầu:
 *   - Lớp 10: 10C1 → 10C10 (10 lớp)
 *   - Lớp 11: 11B1 → 11B9  (9 lớp)
 *   - Lớp 12: 12A1 → 12A11 (11 lớp)
 */
const ExcelJS = require('exceljs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', '..', 'dulieu.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');

// Classes to keep
const KEEP_CLASSES = new Set();
for (let i = 1; i <= 10; i++) KEEP_CLASSES.add(`10C${i}`);
for (let i = 1; i <= 9; i++)  KEEP_CLASSES.add(`11B${i}`);
for (let i = 1; i <= 11; i++) KEEP_CLASSES.add(`12A${i}`);

async function main() {
  console.log('📖 Reading source file:', INPUT_FILE);
  const src = new ExcelJS.Workbook();
  await src.xlsx.readFile(INPUT_FILE);

  const out = new ExcelJS.Workbook();
  out.creator = 'SampleDataGenerator';
  out.created = new Date();

  // ====== 1) Copy Huong_dan as-is ======
  copySheet(src, out, 'Huong_dan');

  // ====== 2) Copy Nguon_tham_khao as-is ======
  copySheet(src, out, 'Nguon_tham_khao');

  // ====== 3) Copy DM_Mon_GDPT2018 and remove Tiết/tuần columns ======
  copySheet(src, out, 'DM_Mon_GDPT2018');
  const wsMon = out.getWorksheet('DM_Mon_GDPT2018');
  if (wsMon) {
    try {
      // Unmerge the title row first
      if (wsMon.getCell('A1').isMerged) {
        wsMon.unmergeCells('A1:F1');
      }
    } catch (e) {}
    // Remove column 4 (Tổng tiết/năm) and 5 (Tiết/tuần)
    wsMon.spliceColumns(4, 2);
    try {
      wsMon.mergeCells('A1:D1');
    } catch (e) {}
  }

  // ====== 4) DM_Giao_vien - filter teachers referenced by kept classes ======
  const srcAssignments = src.getWorksheet('Phan_cong');
  const usedTeacherCodes = new Set();
  forDataRows(srcAssignments, (row) => {
    const cls = cellStr(row, 4);
    if (KEEP_CLASSES.has(cls)) {
      const gv1 = cellStr(row, 11);
      const gv2 = cellStr(row, 13);
      if (gv1) usedTeacherCodes.add(gv1);
      if (gv2) usedTeacherCodes.add(gv2);
    }
  });

  // Also include homeroom teachers for kept classes
  const srcClasses = src.getWorksheet('DM_Lop');
  forDataRows(srcClasses, (row) => {
    const cls = cellStr(row, 1);
    if (KEEP_CLASSES.has(cls)) {
      const hrCode = cellStr(row, 7);
      if (hrCode) usedTeacherCodes.add(hrCode);
    }
  });

  const srcTeachers = src.getWorksheet('DM_Giao_vien');
  const wsTeachers = out.addWorksheet('DM_Giao_vien');
  copyHeaderRows(srcTeachers, wsTeachers, 2);
  let teacherCount = 0;
  forDataRows(srcTeachers, (row) => {
    const code = cellStr(row, 1);
    if (code && usedTeacherCodes.has(code)) {
      copyRow(row, wsTeachers);
      teacherCount++;
    }
  });
  copyColumnWidths(srcTeachers, wsTeachers);
  console.log(`   Teachers: ${teacherCount} (from ${usedTeacherCodes.size} referenced)`);

  // ====== 5) DM_Lop - filter to 30 classes ======
  const wsClasses = out.addWorksheet('DM_Lop');
  copyHeaderRows(srcClasses, wsClasses, 2);
  let classCount = 0;
  forDataRows(srcClasses, (row) => {
    const cls = cellStr(row, 1);
    if (KEEP_CLASSES.has(cls)) {
      copyRow(row, wsClasses);
      classCount++;
    }
  });
  copyColumnWidths(srcClasses, wsClasses);
  console.log(`   Classes: ${classCount}`);

  // ====== 6) DM_To_hop - keep combos used by remaining classes ======
  const usedCombos = new Set();
  forDataRows(srcClasses, (row) => {
    const cls = cellStr(row, 1);
    if (KEEP_CLASSES.has(cls)) {
      const combo = cellStr(row, 5);
      if (combo) usedCombos.add(combo);
    }
  });

  const srcCombos = src.getWorksheet('DM_To_hop');
  const wsCombos = out.addWorksheet('DM_To_hop');
  copyHeaderRows(srcCombos, wsCombos, 2);
  let comboCount = 0;
  forDataRows(srcCombos, (row) => {
    const code = cellStr(row, 1);
    if (code && usedCombos.has(code)) {
      copyRow(row, wsCombos);
      comboCount++;
    }
  });
  copyColumnWidths(srcCombos, wsCombos);
  console.log(`   Combinations: ${comboCount}`);

  // ====== 7) Phan_cong - filter by kept classes, re-number STT ======
  const wsAssign = out.addWorksheet('Phan_cong');
  copyHeaderRows(srcAssignments, wsAssign, 2);
  let stt = 0;
  let totalHk1 = 0;
  forDataRows(srcAssignments, (row) => {
    const cls = cellStr(row, 4);
    if (KEEP_CLASSES.has(cls)) {
      stt++;
      const newRow = copyRow(row, wsAssign);
      newRow.getCell(1).value = stt; // Re-number STT
      totalHk1 += Number(row.getCell(9).value) || 0;
    }
  });
  copyColumnWidths(srcAssignments, wsAssign);
  console.log(`   Assignment rows: ${stt}`);
  console.log(`   Total periods (HK1): ${totalHk1}`);
  console.log(`   Avg periods/class (HK1): ${(totalHk1 / KEEP_CLASSES.size).toFixed(1)}`);

  // ====== 8) DM_Phong - copy as-is ======
  if (src.getWorksheet('DM_Phong')) {
    copySheet(src, out, 'DM_Phong');
  }

  // ====== 9) Tong_hop_GV - rebuild for kept teachers ======
  const srcSummary = src.getWorksheet('Tong_hop_GV');
  if (srcSummary) {
    const wsSummary = out.addWorksheet('Tong_hop_GV');
    copyHeaderRows(srcSummary, wsSummary, 2);
    forDataRows(srcSummary, (row) => {
      const code = cellStr(row, 1);
      if (code && usedTeacherCodes.has(code)) {
        copyRow(row, wsSummary);
      }
    });
    copyColumnWidths(srcSummary, wsSummary);
  }

  // Save
  await out.xlsx.writeFile(OUTPUT_FILE);
  console.log(`\n✅ File saved: ${OUTPUT_FILE}`);
}

// ===== HELPERS =====

function cellStr(row, col) {
  return String(row.getCell(col).value || '').trim();
}

function forDataRows(ws, fn) {
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // Skip empty rows
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, () => { hasValue = true; });
    if (hasValue) fn(row);
  }
}

function copySheet(srcWb, destWb, sheetName) {
  const srcWs = srcWb.getWorksheet(sheetName);
  if (!srcWs) return;
  const destWs = destWb.addWorksheet(sheetName);
  srcWs.eachRow({ includeEmpty: false }, (srcRow, rowNum) => {
    const destRow = destWs.getRow(rowNum);
    srcRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const destCell = destRow.getCell(colNum);
      destCell.value = cell.value;
      destCell.style = JSON.parse(JSON.stringify(cell.style || {}));
    });
    destRow.height = srcRow.height;
    destRow.commit();
  });
  copyColumnWidths(srcWs, destWs);
  // Copy merges
  if (srcWs._merges) {
    Object.values(srcWs._merges).forEach(merge => {
      try { destWs.mergeCells(merge); } catch (e) { /* skip */ }
    });
  }
}

function copyHeaderRows(srcWs, destWs, count) {
  for (let r = 1; r <= count; r++) {
    const srcRow = srcWs.getRow(r);
    const destRow = destWs.getRow(r);
    srcRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const destCell = destRow.getCell(colNum);
      destCell.value = cell.value;
      destCell.style = JSON.parse(JSON.stringify(cell.style || {}));
    });
    destRow.height = srcRow.height;
    destRow.commit();
  }
  // Copy merges for header rows
  if (srcWs._merges) {
    Object.values(srcWs._merges).forEach(merge => {
      try {
        const ref = typeof merge === 'string' ? merge : merge.model || merge;
        const match = String(ref).match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (match && parseInt(match[2]) <= count) {
          destWs.mergeCells(String(ref));
        }
      } catch (e) { /* skip */ }
    });
  }
}

function copyRow(srcRow, destWs) {
  const destRow = destWs.addRow([]);
  srcRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    const destCell = destRow.getCell(colNum);
    destCell.value = cell.value;
    destCell.style = JSON.parse(JSON.stringify(cell.style || {}));
  });
  destRow.height = srcRow.height;
  return destRow;
}

function copyColumnWidths(srcWs, destWs) {
  if (srcWs.columns) {
    srcWs.columns.forEach((col, idx) => {
      if (destWs.columns && destWs.columns[idx]) {
        destWs.columns[idx].width = col.width;
      } else {
        const destCol = destWs.getColumn(idx + 1);
        destCol.width = col.width;
      }
    });
  }
}

main().catch(console.error);
