import * as ExcelJS from 'exceljs';

async function main() {
    const filePath = 'D:\\Project\\Timetable\\Du_lieu_mau_GDPT2018_30lop.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    // 1. Add new teachers to DM_Giao_vien
    const gvSheet = wb.getWorksheet('DM_Giao_vien')!;
    let lastGVRow = 2;
    for (let i = 3; i <= 200; i++) {
        const code = String(gvSheet.getRow(i).getCell(1).value ?? '').trim();
        if (code.startsWith('GV')) lastGVRow = i;
    }
    console.log(`Last GV: row ${lastGVRow} = ${gvSheet.getRow(lastGVRow).getCell(1).value}`);

    const newTeachers = [
        { code: 'GV073', name: 'Nguyễn Văn Tùng', major: 'GDTC' },
        { code: 'GV074', name: 'Trần Minh Khôi', major: 'GDQP' },
    ];
    for (let t = 0; t < newTeachers.length; t++) {
        const r = lastGVRow + 1 + t;
        const row = gvSheet.getRow(r);
        row.getCell(1).value = newTeachers[t].code;
        row.getCell(2).value = newTeachers[t].name;
        row.getCell(5).value = 'Tổ Thể dục';
        row.getCell(6).value = newTeachers[t].major;
        row.getCell(7).value = 'Đang dạy';
        row.getCell(8).value = 17;
        row.getCell(9).value = 0;
        row.getCell(10).value = 17;
        row.commit();
        console.log(`Added ${newTeachers[t].code} (${newTeachers[t].name})`);
    }

    // 2. Reassign GDTC/GDQP in Phan_cong
    const pcSheet = wb.getWorksheet('Phan_cong')!;
    const reassignments: Record<string, { from: string; to: string; toName: string }> = {
        '12A3-GDTC': { from: 'GV059', to: 'GV073', toName: 'Nguyễn Văn Tùng' },
        '12A8-GDTC': { from: 'GV059', to: 'GV073', toName: 'Nguyễn Văn Tùng' },
        '12A4-GDTC': { from: 'GV060', to: 'GV073', toName: 'Nguyễn Văn Tùng' },
        '12A9-GDTC': { from: 'GV060', to: 'GV073', toName: 'Nguyễn Văn Tùng' },
        '12A3-GDQP': { from: 'GV064', to: 'GV074', toName: 'Trần Minh Khôi' },
        '12A6-GDQP': { from: 'GV064', to: 'GV074', toName: 'Trần Minh Khôi' },
        '12A9-GDQP': { from: 'GV064', to: 'GV074', toName: 'Trần Minh Khôi' },
        '12A1-GDQP': { from: 'GV065', to: 'GV074', toName: 'Trần Minh Khôi' },
        '12A4-GDQP': { from: 'GV065', to: 'GV074', toName: 'Trần Minh Khôi' },
        '12A7-GDQP': { from: 'GV065', to: 'GV074', toName: 'Trần Minh Khôi' },
    };

    let changed = 0;
    for (let i = 3; i <= pcSheet.rowCount; i++) {
        const row = pcSheet.getRow(i);
        const cls = String(row.getCell(4).value ?? '').trim();
        const subjectCode = String(row.getCell(6).value ?? '').trim().toUpperCase();
        const gvCode = String(row.getCell(11).value ?? '').trim();
        const key = `${cls}-${subjectCode}`;
        const r = reassignments[key];
        if (r && gvCode === r.from) {
            row.getCell(11).value = r.to;
            row.getCell(12).value = r.toName;
            if (String(row.getCell(13).value ?? '').trim() === r.from) {
                row.getCell(13).value = r.to;
                row.getCell(14).value = r.toName;
            }
            row.commit();
            console.log(`  ✅ ${cls} ${subjectCode}: ${r.from} → ${r.to}`);
            changed++;
        }
    }
    console.log(`\nTotal reassignments: ${changed}`);

    // 3. Save with streaming to avoid OOM
    console.log('Saving...');
    await wb.xlsx.writeFile(filePath);
    console.log('✅ Done!');
}

main().catch(console.error);
