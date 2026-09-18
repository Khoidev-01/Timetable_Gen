const fs = require("fs");
const path = require("path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require("docx");

const output = path.join(__dirname, "bao-cao-he-thong-xep-thoi-khoa-bieu-thpt.docx");
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const CONTENT_WIDTH = 9070;
const thin = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const text = (value, options = {}) => new TextRun({ text: value, font: "Times New Roman", size: 26, ...options });

function p(value = "", options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: options.spacing || { line: 312, after: 0 },
    indent: options.noIndent ? undefined : { firstLine: 567 },
    keepNext: options.keepNext,
    pageBreakBefore: options.pageBreakBefore,
    children: [text(value, options.run || {})],
  });
}

function ref(value) {
  return p(value, { alignment: AlignmentType.LEFT, noIndent: true });
}

function rich(runs, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: options.spacing || { line: 312, after: 0 },
    indent: options.noIndent ? undefined : { firstLine: 567 },
    children: runs.map((r) => text(r.text, r)),
  });
}

function h1(value, pageBreakBefore = true) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    pageBreakBefore,
    spacing: { before: 240, after: 120, line: 312 },
    children: [text(value.toUpperCase(), { bold: true })],
  });
}

function h2(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80, line: 312 },
    children: [text(value, { bold: true })],
  });
}

function h3(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 120, after: 60, line: 312 },
    children: [text(value, { bold: true, italic: true })],
  });
}

function h4(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 100, after: 40, line: 312 },
    children: [text(value, { italic: true })],
  });
}

function bullet(value, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 0 },
    children: [text(value)],
  });
}

function numbered(value, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 0 },
    children: [text(value)],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(value, width, header = false, align = AlignmentType.JUSTIFIED) {
  const paragraphs = Array.isArray(value)
    ? value
    : [new Paragraph({
        alignment: header ? AlignmentType.CENTER : align,
        spacing: { line: 312, after: 0 },
        children: [text(String(value), { bold: header })],
      })];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: paragraphs,
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((v, i) => cell(v, widths[i], true, AlignmentType.CENTER)) }),
      ...rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, widths[i])) })),
    ],
  });
}

function labeledTable(label, headers, rows, widths) {
  // Tên bảng đặt dưới bảng, cùng kiểu với tên hình
  return [table(headers, rows, widths), caption(label)];
}

function caption(value) {
  return new Paragraph({
    style: "Caption",
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 100, line: 312 },
    children: [text(value, { bold: true, size: 24 })],
  });
}

function tableCaption(value) {
  return new Paragraph({
    style: "Caption",
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 80, after: 40, line: 312 },
    children: [text(value, { bold: true, size: 24 })],
  });
}

function placeholder(label, height = 2600) {
  return [
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH],
      rows: [new TableRow({
        height: { value: height, rule: "atLeast" },
        children: [new TableCell({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders,
          shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [text(`[PLACEHOLDER HÌNH ẢNH: ${label}]`, { bold: true, color: "666666" })],
          })],
        })],
      })],
    }),
    caption(label),
  ];
}

const IMAGE_DIMS = JSON.parse(fs.readFileSync(path.join(__dirname, "image-dims.json"), "utf8"));

/** Chiều cao theo đúng tỉ lệ ảnh gốc; kích thước tính bằng px của docx-js (96 dpi). */
function sized(rel, width) {
  const dims = IMAGE_DIMS[rel];
  if (!dims) throw new Error(`Thiếu kích thước ảnh: ${rel} (chạy lại bước tạo image-dims.json)`);
  return { width, height: Math.round((width * dims[1]) / dims[0]) };
}

function image(rel, type, label, width) {
  const { height } = sized(rel, width);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 100, after: 60 },
      children: [new ImageRun({
        type,
        data: fs.readFileSync(path.join(__dirname, rel)),
        transformation: { width, height },
        altText: { title: label, description: label, name: path.basename(rel) },
      })],
    }),
    caption(label),
  ];
}

function diagram(file, label, width = 640) {
  return image(`diagrams/${file}`, "png", label, width);
}

/** Ảnh chụp màn hình thật (JPEG) trong reports/screenshots/jpg. */
function figure(file, label, width = 620) {
  return image(`screenshots/jpg/${file}`, "jpg", label, width);
}

function codeBlock(lines) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      borders,
      shading: { fill: "F7F7F7", type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 180, right: 180 },
      children: lines.map((line) => new Paragraph({
        spacing: { after: 0 },
        children: [new TextRun({ text: line, font: "Consolas", size: 20 })],
      })),
    })] })],
  });
}

const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40, line: 312 }, children: [text("TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TRUNG", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220, line: 312 }, children: [text("KHOA KỸ THUẬT CÔNG NGHỆ", { bold: true })] }),
  ...placeholder("LOGO TRƯỜNG", 1450).slice(0, 1),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 100, line: 312 }, children: [text("BÁO CÁO ĐỀ TÀI NGHIÊN CỨU KHOA HỌC", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260, line: 312 }, children: [text("CHUYÊN NGÀNH CÔNG NGHỆ THÔNG TIN", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100, line: 312 }, children: [text("Đề tài:", { bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100, line: 312 }, children: [text("HỆ THỐNG XẾP THỜI KHÓA BIỂU THPT THÔNG MINH MIKITIMETABLE", { bold: true, color: "17365D" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300, line: 312 }, children: [text("Địa chỉ triển khai: https://gettimetable.cloud/", { bold: true, color: "0563C1" })] }),
  new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2800, 6270],
    rows: [
      ["Giảng viên hướng dẫn:", "ThS. Nguyễn Công Bằng"],
      ["Sinh viên thực hiện:", "[HỌ VÀ TÊN SINH VIÊN]"],
      ["Mã sinh viên:", "[MÃ SINH VIÊN]"],
      ["Lớp:", "[LỚP / KHÓA HỌC]"],
      ["Niên khóa:", "[NIÊN KHÓA]"],
    ].map((row) => new TableRow({ children: row.map((v, i) => new TableCell({
      width: { size: i === 0 ? 2800 : 6270, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [new Paragraph({ spacing: { line: 312, after: 0 }, children: [text(v, { bold: i === 0 })] })],
    })) })),
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 440, after: 80, line: 312 }, children: [text("[ĐỊA ĐIỂM], 2026")] }),
];

const body = [];
const buildBody = require("./report-content");
const content = buildBody({ h1, h2, h3, h4, p, rich, bullet, numbered, labeledTable, table, figure, diagram, codeBlock, ref, text, Paragraph, AlignmentType });
// Lời mở đầu và lời cảm ơn đứng trước mục lục
body.push(...content.preface);

body.push(
  h1("MỤC LỤC"),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 312, after: 0 }, children: [text("Lưu ý: trong Microsoft Word, chọn mục lục và nhấn F9 để cập nhật số trang.", { italic: true, color: "666666" })] }),
  new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
  h1("DANH MỤC HÌNH ẢNH"),
  ...[
    "Hình 1.1. Quy trình nghiệp vụ tổng quát", "Hình 1.2. Sơ đồ tác nhân và phạm vi hệ thống",
    "Hình 2.1. Pipeline thuật toán lai năm pha",
    "Hình 3.1. Sơ đồ use case quản trị viên", "Hình 3.2. Sơ đồ use case giáo viên và tổ trưởng chuyên môn",
    "Hình 3.3. Kiến trúc tổng thể MiKiTimetable", "Hình 3.4. ERD dữ liệu lõi và phân công",
    "Hình 3.5. ERD thời khóa biểu và dữ liệu vận hành", "Hình 3.6. ERD bổ sung: tổng hợp phân công, tài khoản và OTP",
    "Hình 3.7. Trình tự sinh và công bố thời khóa biểu",
    "Hình 4.1. Màn hình đăng nhập", "Hình 4.2. Bước nhập mã sáu số", "Hình 4.3. Tài khoản của tôi",
    "Hình 4.4. Trang tổng quan", "Hình 4.5. Tổng quan: tải giảng dạy và phòng", "Hình 4.6. Quản lý giáo viên",
    "Hình 4.7. Quản lý lớp học và phòng học", "Hình 4.8. Phân công chuyên môn", "Hình 4.9. Tổng hợp phân công",
    "Hình 4.10. Xếp thời khóa biểu", "Hình 4.11. Lưới thời khóa biểu theo lớp", "Hình 4.12. Tiết cố định",
    "Hình 4.13. Công bằng giữa các giáo viên", "Hình 4.14. Cấu hình ràng buộc", "Hình 4.15. Duyệt lịch bận",
    "Hình 4.16. Trợ lý AI", "Hình 4.17. Tổng quan cổng giáo viên", "Hình 4.18. Thời khóa biểu cá nhân",
    "Hình 4.19. Tổ trưởng nộp phân công", "Hình 4.20. Đề xuất đổi tiết", "Hình 4.21. Trang công khai qua mã QR",
    "Hình 4.22. Sơ đồ triển khai",
  ].map((x) => p(x, { noIndent: true })),
  h1("DANH MỤC BẢNG BIỂU"),
  ...[
    "Bảng 1.1. Các tác nhân của hệ thống", "Bảng 1.2. Yêu cầu chức năng chính", "Bảng 1.3. Yêu cầu phi chức năng",
    "Bảng 2.1. So sánh các nhóm phương pháp xếp lịch",
    "Bảng 3.1. Ma trận truy vết chức năng với mã nguồn", "Bảng 3.2. Công nghệ sử dụng",
    "Bảng 3.3. Nhóm ràng buộc cứng", "Bảng 3.4. Nhóm ràng buộc mềm",
    "Bảng 3.5. Các nhóm thực thể dữ liệu", "Bảng 3.6. Từ điển bảng cơ sở dữ liệu",
    "Bảng 4.1. Môi trường và công nghệ phát triển", "Bảng 4.2. Các phân hệ đã cài đặt",
    "Bảng 4.3. Kết quả benchmark bảy chiến lược", "Bảng 4.4. Kết quả xếp lịch bộ dữ liệu mẫu", "Bảng 4.5. Kiểm thử và kiểm soát chất lượng",
  ].map((x) => p(x, { noIndent: true })),
  h1("DANH MỤC TỪ VIẾT TẮT"),
  table(["Từ viết tắt", "Ý nghĩa"], [
    ["API", "Application Programming Interface – giao diện lập trình ứng dụng"], ["CSDL", "Cơ sở dữ liệu"],
    ["GDPT", "Giáo dục phổ thông"], ["GV / GVCN", "Giáo viên / giáo viên chủ nhiệm"],
    ["HC / SC", "Hard / Soft Constraint – ràng buộc cứng / mềm"], ["HĐTN-HN", "Hoạt động trải nghiệm, hướng nghiệp"],
    ["JWT", "JSON Web Token"], ["LT / TH", "Lý thuyết / thực hành"], ["OTP", "One-Time Password – mã dùng một lần"],
    ["PWA", "Progressive Web Application"], ["RBAC", "Role-Based Access Control – phân quyền theo vai trò"],
    ["SA", "Simulated Annealing – luyện kim mô phỏng"], ["TKB", "Thời khóa biểu"], ["TT / TP", "Tổ trưởng / tổ phó chuyên môn"],
    ["UI/UX", "Giao diện người dùng / trải nghiệm người dùng"], ["WebSocket", "Kênh kết nối hai chiều thời gian thực"],
  ], [2300, 6770]),
);

body.push(...content.body);

const doc = new Document({
  // Word hỏi "cập nhật trường?" khi mở: chọn Yes là mục lục có số trang
  features: { updateFields: true },
  creator: "MiKiTimetable",
  title: "Báo cáo hệ thống xếp thời khóa biểu THPT thông minh MiKiTimetable",
  description: "Báo cáo hệ thống MiKiTimetable, hình ảnh chụp từ hệ thống đang chạy ngày 17/9/2026.",
  styles: {
    default: {
      document: { run: { font: "Times New Roman", size: 26 }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 0 } } },
    },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 26, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120, line: 312 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 26, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 26, bold: true }, paragraph: { spacing: { before: 180, after: 80, line: 312 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 26, bold: true, italics: true }, paragraph: { spacing: { before: 120, after: 60, line: 312 }, outlineLevel: 2 } },
      { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 26, italics: true }, paragraph: { spacing: { before: 100, after: 40, line: 312 }, outlineLevel: 3 } },
      { id: "Caption", name: "Caption", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Times New Roman", size: 24, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 100, line: 312 } } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ] },
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } } },
      children: cover,
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 }, pageNumbers: { start: 1 } },
      },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" } },
        children: [text("MIKITIMETABLE – BÁO CÁO HỆ THỐNG XẾP THỜI KHÓA BIỂU THPT", { italic: true, color: "666666" })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text("Trang "), new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 26 })],
      })] }) },
      children: body,
    },
  ],
});

fs.mkdirSync(__dirname, { recursive: true });
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(output, buffer);
  process.stdout.write(output);
});
