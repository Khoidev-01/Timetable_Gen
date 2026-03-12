"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeKey = normalizeKey;
exports.getCellText = getCellText;
exports.getCellNumber = getCellNumber;
exports.buildAttachmentDisposition = buildAttachmentDisposition;
exports.thinBorder = thinBorder;
exports.applyTitleRow = applyTitleRow;
exports.applyHeaderRow = applyHeaderRow;
exports.applyBodyRow = applyBodyRow;
exports.autoFitWorksheet = autoFitWorksheet;
function normalizeKey(value) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}
function getCellText(cell) {
    return String(cell.text ?? '').trim();
}
function getCellNumber(cell) {
    const raw = cell.value;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
    }
    const normalized = getCellText(cell).replace(/,/g, '.');
    if (!normalized) {
        return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
function buildAttachmentDisposition(fileName) {
    const asciiFallback = fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-zA-Z0-9._-]/g, '-');
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
function thinBorder() {
    return {
        top: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
    };
}
function applyTitleRow(worksheet, rowNumber, title, columnCount) {
    worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
    const row = worksheet.getRow(rowNumber);
    const cell = row.getCell(1);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = thinBorder();
    row.height = 24;
}
function applyHeaderRow(row) {
    row.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.height = 22;
    row.eachCell((cell) => {
        cell.border = thinBorder();
    });
}
function applyBodyRow(row) {
    row.font = { name: 'Calibri', size: 11, color: { argb: 'FF111827' } };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell((cell) => {
        cell.border = thinBorder();
    });
}
function autoFitWorksheet(worksheet, minimumWidth = 10) {
    worksheet.columns?.forEach((column) => {
        let maxLength = minimumWidth;
        if (column.eachCell) {
            column.eachCell({ includeEmpty: true }, (cell) => {
                const value = String(cell.value ?? '');
                maxLength = Math.max(maxLength, value.length + 2);
            });
        }
        column.width = Math.min(maxLength, 36);
    });
}
//# sourceMappingURL=excel.utils.js.map