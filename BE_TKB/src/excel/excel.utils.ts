import * as ExcelJS from 'exceljs';

export function normalizeKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function getCellText(cell: ExcelJS.Cell): string {
  return String(cell.text ?? '').trim();
}

export function getCellNumber(cell: ExcelJS.Cell): number | null {
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

export function buildAttachmentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9._-]/g, '-');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
    bottom: { style: 'thin' },
  };
}

export function applyTitleRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  columnCount: number,
): void {
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

export function applyHeaderRow(row: ExcelJS.Row): void {
  row.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = thinBorder();
  });
}

export function applyBodyRow(row: ExcelJS.Row): void {
  row.font = { name: 'Calibri', size: 11, color: { argb: 'FF111827' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.border = thinBorder();
  });
}

export function autoFitWorksheet(worksheet: ExcelJS.Worksheet, minimumWidth = 10): void {
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
