import * as ExcelJS from 'exceljs';

async function main() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('D:\\Project\\Timetable\\Du_lieu_mau_GDPT2018_30lop.xlsx');

    const pcSheet = wb.getWorksheet('Phan_cong')!;

    // Headers from row 2
    const headerRow = pcSheet.getRow(2);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
        headers.push(`Col${col}: ${String(cell.value ?? '')}`);
    });
    console.log('Row 2 Headers:', headers.join(' | '));

    // Find GDTC/GDQP rows by col 6 (Mã môn)
    console.log('\n=== GDTC/GDQP ROWS ===');
    let count = 0;
    for (let i = 3; i <= pcSheet.rowCount; i++) {
        const row = pcSheet.getRow(i);
        const subjectCode = String(row.getCell(6).value ?? '').trim().toUpperCase();
        if (subjectCode.includes('GDTC') || subjectCode.includes('GDQP')) {
            const cls = String(row.getCell(4).value ?? '');
            const subj = String(row.getCell(7).value ?? '');
            const periods = String(row.getCell(9).value ?? '');
            const gvCode = String(row.getCell(11).value ?? '');
            const gvName = String(row.getCell(12).value ?? '');
            console.log(`  ${cls.padEnd(6)} ${subjectCode.padEnd(8)} ${subj.padEnd(20)} ${periods}tiết  GV:${gvCode} ${gvName}`);
            count++;
        }
    }
    console.log(`\nTotal GDTC/GDQP rows: ${count}`);

    // Count per teacher
    console.log('\n=== PER-TEACHER GDTC/GDQP LOAD ===');
    const teacherLoad = new Map<string, { name: string; classes: string[]; total: number }>();
    for (let i = 3; i <= pcSheet.rowCount; i++) {
        const row = pcSheet.getRow(i);
        const subjectCode = String(row.getCell(6).value ?? '').trim().toUpperCase();
        if (subjectCode.includes('GDTC') || subjectCode.includes('GDQP')) {
            const gvCode = String(row.getCell(11).value ?? '').trim();
            const gvName = String(row.getCell(12).value ?? '').trim();
            const cls = String(row.getCell(4).value ?? '').trim();
            const periods = Number(row.getCell(9).value) || 0;
            if (!teacherLoad.has(gvCode)) teacherLoad.set(gvCode, { name: gvName, classes: [], total: 0 });
            teacherLoad.get(gvCode)!.classes.push(cls);
            teacherLoad.get(gvCode)!.total += periods;
        }
    }
    for (const [code, data] of teacherLoad) {
        console.log(`  ${code} (${data.name}): ${data.total} tiết, ${data.classes.length} lớp → ${data.classes.join(', ')}`);
    }
}

main().catch(console.error);
