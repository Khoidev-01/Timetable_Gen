import * as ExcelJS from 'exceljs';

async function main() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('D:\\Project\\Timetable\\Du_lieu_mau_GDPT2018_30lop.xlsx');

    console.log('=== ALL SHEET NAMES ===');
    wb.worksheets.forEach(ws => console.log(`  "${ws.name}"`));

    // Find GiaoVien sheet
    const gvSheet = wb.worksheets.find(ws =>
        ws.name.toLowerCase().includes('giao') ||
        ws.name.toLowerCase().includes('giáo')
    );
    if (gvSheet) {
        console.log(`\n=== GV Sheet: "${gvSheet.name}" ===`);
        for (let i = 1; i <= Math.min(10, gvSheet.rowCount); i++) {
            const row = gvSheet.getRow(i);
            const values: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell, col) => {
                if (col <= 15) values.push(String(cell.value ?? ''));
            });
            console.log(`  Row ${i}: ${values.join(' | ')}`);
        }
    }

    // Specifically look at the Phan Cong sheet — find GV column
    const pcSheet = wb.worksheets.find(ws =>
        ws.name.toLowerCase().includes('phan') ||
        ws.name.toLowerCase().includes('phân')
    );
    if (pcSheet) {
        console.log(`\n=== PC Sheet Headers: "${pcSheet.name}" ===`);
        const headerRow = pcSheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
            headers.push(`Col${col}: ${String(cell.value ?? '')}`);
        });
        console.log(`  ${headers.join(' | ')}`);

        // Count total periods per class in Excel
        console.log('\n=== TOTAL PERIODS PER CLASS (from Excel) ===');
        const classTotals = new Map<string, number>();
        for (let i = 2; i <= pcSheet.rowCount; i++) {
            const row = pcSheet.getRow(i);
            const className = String(row.getCell(4).value ?? '').trim();
            const totalPeriods = Number(row.getCell(10).value) || 0;
            if (className && totalPeriods) {
                classTotals.set(className, (classTotals.get(className) || 0) + totalPeriods);
            }
        }
        for (const [cls, total] of [...classTotals.entries()].sort()) {
            const isMorning = cls.startsWith('10') || cls.startsWith('12');
            const maxSlots = isMorning ? 26 : 27;
            const marker = total > maxSlots ? `⚠ THIẾU ${total - maxSlots}` : '✅';
            console.log(`  ${cls.padEnd(8)} ${total} tiết/tuần  (max main-session=${maxSlots})  ${marker}`);
        }
    }
}

main().catch(console.error);
