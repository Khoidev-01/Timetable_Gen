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
  cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF1E40AF' } },
    left: { style: 'thin', color: { argb: 'FF1E40AF' } },
    right: { style: 'thin', color: { argb: 'FF1E40AF' } },
    bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
  };
  row.height = 32;
}

export function applyHeaderRow(row: ExcelJS.Row): void {
  row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.height = 26;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E40AF' } },
      left: { style: 'thin', color: { argb: 'FF1E40AF' } },
      right: { style: 'thin', color: { argb: 'FF1E40AF' } },
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });
}

// Track row index for zebra striping
let bodyRowIndex = 0;

export function resetBodyRowIndex(): void {
  bodyRowIndex = 0;
}

export function applyBodyRow(row: ExcelJS.Row): void {
  const isEven = bodyRowIndex % 2 === 0;
  bodyRowIndex++;
  row.font = { name: 'Calibri', size: 11 };
  row.alignment = { vertical: 'middle' };
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
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
