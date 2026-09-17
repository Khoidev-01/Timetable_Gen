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
const thin = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
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

function cell(value, width, header = false, align = AlignmentType.LEFT) {
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
    shading: header ? { fill: "D9EAF7", type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: paragraphs,
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((v, i) => cell(v, widths[i], true, AlignmentType.CENTER)) }),
      ...rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, widths[i])) })),
    ],
  });
}

function labeledTable(label, headers, rows, widths) {
  return [tableCaption(label), table(headers, rows, widths)];
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

function diagram(file, label, width, height) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [new ImageRun({
        type: "png",
        data: fs.readFileSync(path.join(__dirname, "diagrams", file)),
        transformation: { width, height },
        altText: { title: label, description: label, name: file },
      })],
    }),
    caption(label),
  ];
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
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 312 }, children: [text("BẢN NHÁP – MỘT SỐ HÌNH ẢNH ĐANG ĐỂ PLACEHOLDER", { bold: true, italic: true, color: "C00000" })] }),
];

const body = [];

body.push(
  h1("LỜI MỞ ĐẦU", false),
  p("Lập thời khóa biểu ở trường trung học phổ thông là công việc phải đồng thời thỏa mãn định mức môn học, phân công chuyên môn, lịch bận giáo viên, phòng học, buổi học chính, tiết cố định và nhiều tiêu chí chất lượng. Khi quy mô dữ liệu tăng, cách làm thủ công trở nên khó kiểm chứng, mất nhiều thời gian điều chỉnh và dễ phát sinh xung đột dây chuyền."),
  p("Đề tài xây dựng MiKiTimetable, hệ thống web hỗ trợ quản lý dữ liệu nhà trường, tự động sinh nhiều phương án thời khóa biểu, đánh giá chất lượng, điều chỉnh thủ công có kiểm soát và công bố lịch cho giáo viên. Hệ thống hiện được triển khai tại https://gettimetable.cloud/. Phạm vi chức năng trong báo cáo được đối chiếu trực tiếp từ mã nguồn thực thi và lược đồ Prisma của dự án."),
  p("Báo cáo gồm năm chương, lần lượt trình bày bối cảnh đề tài, cơ sở lý thuyết, phân tích và thiết kế, xây dựng và đánh giá, cuối cùng là kết luận cùng hướng phát triển."),
  h1("LỜI CẢM ƠN"),
  p("Em xin chân thành cảm ơn ThS. Nguyễn Công Bằng đã hướng dẫn, góp ý và hỗ trợ em trong quá trình nghiên cứu, phân tích yêu cầu và hoàn thiện đề tài. Những nhận xét về phương pháp, cấu trúc báo cáo và khả năng ứng dụng thực tế là cơ sở quan trọng để em điều chỉnh sản phẩm theo hướng rõ ràng và có thể kiểm chứng."),
  p("Em cũng xin cảm ơn quý thầy cô Khoa Kỹ thuật Công nghệ, Trường Đại học Xây dựng Miền Trung đã trang bị kiến thức nền tảng về công nghệ phần mềm, cơ sở dữ liệu và phát triển ứng dụng web. Do giới hạn về thời gian và dữ liệu thử nghiệm, báo cáo khó tránh khỏi thiếu sót; em kính mong tiếp tục nhận được ý kiến góp ý để hệ thống được hoàn thiện hơn."),
  h1("MỤC LỤC"),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 312, after: 0 }, children: [text("Lưu ý: trong Microsoft Word, chọn mục lục và nhấn F9 để cập nhật số trang.", { italic: true, color: "666666" })] }),
  new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-4" }),
  h1("DANH MỤC HÌNH ẢNH"),
  ...[
    "Hình 1.1. Quy trình nghiệp vụ tổng quát", "Hình 1.2. Sơ đồ tác nhân và phạm vi hệ thống",
    "Hình 2.1. Pipeline thuật toán lai ba pha",
    "Hình 3.1. Sơ đồ use case quản trị viên", "Hình 3.2. Sơ đồ use case giáo viên",
    "Hình 3.3. Kiến trúc tổng thể MiKiTimetable", "Hình 3.4. ERD dữ liệu lõi và phân công",
    "Hình 3.5. ERD thời khóa biểu và dữ liệu vận hành", "Hình 3.6. Trình tự sinh và công bố thời khóa biểu",
    "Hình 4.1. Giao diện đăng nhập", "Hình 4.2. Dashboard quản trị",
    "Hình 4.3. Màn hình cấu hình dữ liệu và ràng buộc", "Hình 4.4. Màn hình thời khóa biểu và kéo-thả",
    "Hình 4.5. Màn hình benchmark và so sánh phương án", "Hình 4.6. Cổng giáo viên",
    "Hình 4.7. Trợ lý AI có guardrail", "Hình 4.8. Sơ đồ triển khai production",
  ].map((x) => p(x, { noIndent: true })),
  h1("DANH MỤC BẢNG BIỂU"),
  ...[
    "Bảng 1.1. Các tác nhân của hệ thống", "Bảng 1.2. Yêu cầu chức năng chính", "Bảng 1.3. Yêu cầu phi chức năng",
    "Bảng 2.1. So sánh các nhóm phương pháp xếp lịch",
    "Bảng 3.1. Ma trận truy vết chức năng với mã nguồn", "Bảng 3.2. Công nghệ sử dụng",
    "Bảng 3.3. Nhóm ràng buộc cứng", "Bảng 3.4. Nhóm ràng buộc mềm",
    "Bảng 3.5. Các nhóm thực thể dữ liệu", "Bảng 3.6. Từ điển bảng cơ sở dữ liệu",
    "Bảng 4.1. Môi trường và công nghệ phát triển", "Bảng 4.2. Các phân hệ đã cài đặt",
    "Bảng 4.3. Kết quả benchmark nội bộ", "Bảng 4.4. Kiểm thử và kiểm soát chất lượng",
  ].map((x) => p(x, { noIndent: true })),
  h1("DANH MỤC TỪ VIẾT TẮT"),
  table(["Từ viết tắt", "Ý nghĩa"], [
    ["API", "Application Programming Interface – giao diện lập trình ứng dụng"], ["CSDL", "Cơ sở dữ liệu"],
    ["GA", "Genetic Algorithm – giải thuật di truyền"], ["GDPT", "Giáo dục phổ thông"], ["GV", "Giáo viên"],
    ["HC", "Hard Constraint – ràng buộc cứng"], ["JWT", "JSON Web Token"], ["PWA", "Progressive Web Application"],
    ["RBAC", "Role-Based Access Control – phân quyền theo vai trò"], ["SC", "Soft Constraint – ràng buộc mềm"],
    ["TKB", "Thời khóa biểu"], ["UI/UX", "Giao diện người dùng / trải nghiệm người dùng"],
    ["WebSocket", "Kênh kết nối hai chiều thời gian thực"],
  ], [2300, 6770]),
);

body.push(
  h1("CHƯƠNG 1. GIỚI THIỆU ĐỀ TÀI"),
  h2("1.1. Tình hình thực tế"),
  p("Ở nhiều trường phổ thông, dữ liệu lập thời khóa biểu được tổng hợp từ bảng tính và biểu mẫu rời rạc. Người phụ trách phải ghép chương trình môn học, phân công chuyên môn, lịch bận giáo viên, khả năng sử dụng phòng và các tiết bắt buộc. Khi một điều kiện thay đổi, việc dò lại toàn bộ lịch để tránh trùng lớp, trùng giáo viên hoặc trùng phòng thường tốn nhiều công sức."),
  p("Phương pháp thủ công linh hoạt theo kinh nghiệm nhưng khó tái lập và khó định lượng chất lượng. Một điều chỉnh cục bộ có thể tạo xung đột ở vị trí khác; đồng thời các tiêu chí như tiết trống, số buổi đến trường và mức cân bằng tải dạy thường được đánh giá cảm tính."),
  h2("1.2. Mục tiêu và ý nghĩa của đề tài"),
  p("Mục tiêu của đề tài là xây dựng một hệ thống thống nhất từ dữ liệu đầu vào đến công bố và vận hành thời khóa biểu. MiKiTimetable không thay thế quyết định chuyên môn của nhà trường mà cung cấp dữ liệu, phương án và chỉ số để người quản trị ra quyết định có căn cứ."),
  bullet("Giảm thao tác tổng hợp và kiểm tra dữ liệu lặp lại."), bullet("Phát hiện xung đột trước khi công bố lịch."),
  bullet("Tạo nhiều phương án để so sánh thay vì phụ thuộc vào một kết quả duy nhất."),
  bullet("Hỗ trợ giáo viên đăng ký lịch bận, theo dõi lịch cá nhân và đề xuất đổi tiết."),
  h2("1.3. Đặc điểm và tính năng của hệ thống"),
  p("Hệ thống có hai cổng sử dụng chính cho quản trị viên và giáo viên. Dữ liệu được quản lý theo năm học, học kỳ, lớp, giáo viên, môn học, phòng học và phân công. Bộ xếp lịch chạy qua worker nền, phát tiến độ theo thời gian thực và lưu nhiều phương án để đánh giá."),
  bullet("Nhập, xuất dữ liệu Excel và hỗ trợ phân công tự động."), bullet("Cấu hình lịch bận, nguyện vọng, tiết cố định và trọng số ràng buộc."),
  bullet("Kéo-thả, khóa tiết, đổi tiết dây chuyền, hoàn tác và lưu lịch sử."), bullet("Công bố lịch, tạo liên kết công khai, lịch iCalendar và bản in/PDF."),
  bullet("Benchmark, phân tích công bằng, khai phá luật và trợ lý AI có guardrail."),
  h2("1.4. Lý do chọn đề tài"),
  p("Đề tài được lựa chọn vì bài toán thời khóa biểu vừa có giá trị thực tiễn đối với nhà trường vừa thể hiện rõ đặc trưng của tối ưu tổ hợp. Đây cũng là môi trường phù hợp để kết hợp kiến thức về cơ sở dữ liệu, kiến trúc web, xử lý nền, bảo mật, thiết kế trải nghiệm và thuật toán tìm kiếm."),
  h2("1.5. Phạm vi và đối tượng nghiên cứu"),
  p("Đối tượng nghiên cứu là quy trình xây dựng và vận hành thời khóa biểu tại trường THPT áp dụng Chương trình GDPT 2018 [1]. Phạm vi dữ liệu mẫu gồm 30 lớp thuộc ba khối 10, 11 và 12; khoảng 50–76 giáo viên tùy bộ thử nghiệm; khoảng 17 môn học; sáu ngày học và tối đa mười tiết mỗi ngày."),
  p("Đề tài tập trung vào lập lịch theo tuần, quản lý thay đổi sau công bố và các vai trò quản trị viên, giáo viên. Các nghiệp vụ tài chính, tuyển sinh, điểm số và quản lý học sinh không thuộc phạm vi."),
  h2("1.6. Kết cấu báo cáo"),
  p("Chương 1 giới thiệu bối cảnh, mục tiêu, phạm vi và đặc tả bài toán. Chương 2 trình bày cơ sở lý thuyết về tối ưu ràng buộc, heuristic và metaheuristic. Chương 3 phân tích yêu cầu, kiến trúc, dữ liệu và bảo mật. Chương 4 mô tả quá trình xây dựng, triển khai, kiểm thử và đánh giá. Chương 5 tổng kết kết quả, hạn chế và hướng phát triển."),
  h2("1.7. Vấn đề cần nghiên cứu và đóng góp của đề tài"),
  p("Vấn đề trọng tâm là tạo lịch hợp lệ trong không gian tìm kiếm lớn, đồng thời cân bằng nhiều mục tiêu mềm có thể xung đột. Đề tài cần nghiên cứu cách mô hình hóa ràng buộc, xây dựng lịch ban đầu, sửa vi phạm cục bộ, đánh giá chất lượng tăng dần và duy trì tính nhất quán khi người dùng chỉnh sửa lịch."),
  bullet("Pipeline lai ba pha kết hợp tiết cố định, heuristic có cấu trúc và tối ưu cục bộ."),
  bullet("Tách tính hợp lệ khỏi điểm chất lượng; bảo toàn slot khóa và lưu lịch sử thay đổi."),
  bullet("Tích hợp thuật toán vào sản phẩm web có queue, realtime, phân quyền và cơ chế công bố."),
  h2("1.8. Đặc tả bài toán"),
  h3("1.8.1. Dữ liệu vào và kết quả đầu ra"),
  p("Dữ liệu vào gồm học kỳ, lớp, môn, giáo viên, phòng, phân công, lịch bận, nguyện vọng, tiết cố định và trọng số. Kết quả đầu ra là một hoặc nhiều phương án thời khóa biểu gồm các slot ngày, tiết, lớp, môn, giáo viên, phòng, tuần áp dụng và trạng thái khóa."),
  ...placeholder("Hình 1.1. Quy trình nghiệp vụ tổng quát", 2300),
  h3("1.8.2. Tác nhân hệ thống"),
  ...labeledTable("Bảng 1.1. Các tác nhân của hệ thống", ["Tác nhân", "Vai trò", "Quyền chính"], [
    ["Quản trị viên", "Cán bộ xếp lịch", "Quản lý dữ liệu, chạy thuật toán, duyệt và công bố lịch"],
    ["Giáo viên", "Người sử dụng lịch cá nhân", "Xem lịch, đăng ký bận/nguyện vọng, đề xuất đổi tiết"],
    ["Worker thuật toán", "Tiến trình xử lý nền", "Sinh phương án, phát tiến độ và lưu kết quả"],
    ["Trợ lý AI", "Lớp hỗ trợ truy vấn", "Đọc dữ liệu qua công cụ giới hạn quyền và trả lời câu hỏi"],
  ], [1900, 2700, 4470]),
  ...placeholder("Hình 1.2. Sơ đồ tác nhân và phạm vi hệ thống", 2300),
  h3("1.8.3. Yêu cầu chức năng"),
  ...labeledTable("Bảng 1.2. Yêu cầu chức năng chính", ["Mã", "Nhóm", "Mô tả"], [
    ["FR-01", "Xác thực", "Đăng nhập bằng captcha, tài khoản và mật khẩu; phân quyền ADMIN/TEACHER."],
    ["FR-02", "Danh mục", "Quản lý năm học, học kỳ, lớp, giáo viên, môn và phòng."],
    ["FR-03", "Phân công", "Phân công giáo viên; nhập Excel; hỗ trợ auto-assign."],
    ["FR-04", "Ràng buộc", "Lịch bận, nguyện vọng, tiết cố định và trọng số."],
    ["FR-05", "Xếp lịch", "Pre-flight, job nền, tiến độ và nhiều phương án."],
    ["FR-06", "Tinh chỉnh", "Kéo-thả, khóa, đổi dây chuyền, lịch sử và hoàn tác."],
    ["FR-07", "Vận hành", "Công bố, nghỉ, dạy thay, đổi tiết, thông báo và lịch hiệu lực."],
    ["FR-08", "Phân tích", "Benchmark, chất lượng, công bằng, luật ẩn và trợ lý AI."],
  ], [1000, 1900, 6170]),
  h3("1.8.4. Yêu cầu phi chức năng"),
  ...labeledTable("Bảng 1.3. Yêu cầu phi chức năng", ["Nhóm", "Yêu cầu"], [
    ["Đúng đắn", "Không công bố lịch còn xung đột cứng; kiểm tra mọi thao tác di chuyển."],
    ["Hiệu năng", "Dùng index tăng dần và worker nền cho tác vụ tối ưu."],
    ["Bảo mật", "Băm mật khẩu, JWT, RBAC, captcha, rate limit và CORS."],
    ["Khả dụng", "Responsive, PWA, realtime và cơ chế fallback khi Redis không sẵn sàng."],
    ["Bảo trì", "Module hóa, DTO validation, migration và test tự động."],
  ], [2300, 6770]),
);

body.push(
  h1("CHƯƠNG 2. CƠ SỞ LÝ THUYẾT"),
  h2("2.1. Bài toán lập thời khóa biểu"),
  p("Bài toán lập thời khóa biểu ánh xạ các hoạt động học tập vào tập thời điểm và tài nguyên hữu hạn. Mỗi quyết định gán phải đồng thời xét lớp, giáo viên, môn học, phòng và thời gian. Khi số lượng thực thể tăng, số tổ hợp ứng viên tăng rất nhanh; vì vậy việc liệt kê toàn bộ phương án thường không khả thi."),
  p("Khảo sát của Lewis cho thấy các bài toán timetabling thường được giải bằng nhiều họ metaheuristic khác nhau và cách mô hình phải thích ứng với ràng buộc riêng của từng cơ sở [3]."),
  h2("2.2. Bài toán thỏa mãn và tối ưu ràng buộc"),
  p("Mô hình thỏa mãn ràng buộc gồm biến quyết định, miền giá trị và tập ràng buộc. Mục tiêu đầu tiên là tìm nghiệm khả thi thỏa tất cả ràng buộc cứng. Khi có hàm mục tiêu, bài toán mở rộng thành tối ưu ràng buộc để lựa chọn nghiệm có tổng phạt mềm nhỏ hơn. Tài liệu OR-Tools mô tả Constraint Programming là cách thu hẹp tập ứng viên bằng các ràng buộc và đặc biệt phù hợp với bài toán lập lịch [4]."),
  h2("2.3. Ràng buộc cứng và ràng buộc mềm"),
  p("Ràng buộc cứng biểu diễn điều kiện bắt buộc như không trùng lớp, giáo viên, phòng và đúng phân công. Ràng buộc mềm biểu diễn mức mong muốn như giảm tiết trống, phân bố môn hợp lý, ưu tiên nguyện vọng và cân bằng tải. Việc tách hai nhóm giúp tránh đánh đồng một lịch không hợp lệ với một lịch hợp lệ nhưng chất lượng chưa cao."),
  h2("2.4. Heuristic và metaheuristic"),
  p("Heuristic khai thác tri thức miền để tạo nghiệm nhanh, chẳng hạn ưu tiên môn có ít vị trí hợp lệ hoặc phòng chuyên dụng. Metaheuristic điều khiển quá trình tìm kiếm ở mức cao hơn, chấp nhận khám phá nhiều vùng nghiệm và không bảo đảm tối ưu toàn cục nhưng có khả năng tạo phương án tốt trong ngân sách thời gian hữu hạn."),
  ...labeledTable("Bảng 2.1. So sánh các nhóm phương pháp xếp lịch", ["Phương pháp", "Ưu điểm", "Hạn chế", "Vai trò trong đề tài"], [
    ["Greedy/heuristic", "Nhanh, dễ giải thích", "Dễ mắc kẹt ở lựa chọn sớm", "Tạo lịch ban đầu"],
    ["Hill climbing", "Cải thiện cục bộ hiệu quả", "Dễ rơi vào cực trị địa phương", "Sửa phạt trực tiếp"],
    ["Simulated annealing", "Cho phép bước lùi có kiểm soát", "Phụ thuộc lịch giảm nhiệt", "Thoát cực trị địa phương"],
    ["Tabu search", "Hạn chế lặp trạng thái", "Cần quản lý bộ nhớ tabu", "Đa dạng hóa tìm kiếm"],
    ["Multi-restart", "Giảm phụ thuộc nghiệm đầu", "Tăng thời gian tính toán", "Sinh nhiều ứng viên"],
  ], [1800, 2300, 2300, 2670]),
  h2("2.5. Thuật toán lai của đề tài"),
  p("MiKiTimetable kết hợp ba pha: đặt các tiết cố định, lấp đầy bằng heuristic có cấu trúc và tối ưu cục bộ. Multi-restart tạo các ứng viên độc lập; hệ thống đánh giá riêng vi phạm cứng và điểm phạt mềm trước khi lưu phương án."),
  ...placeholder("Hình 2.1. Pipeline thuật toán lai ba pha", 3000),
  codeBlock(["Input: học kỳ, phân công, lịch bận, ràng buộc, seed", "1. placeFixedSlots()", "2. greedyBlockScheduling()", "3. compactAndAssignRooms()", "4. targetedRepair + annealing + tabu", "5. evaluateHardConstraints(); evaluateSoftPenalties()", "6. saveCandidate(); compareVariants()"]),
  h2("2.6. Chấm điểm tăng dần và cấu trúc chỉ mục"),
  p("Thay vì quét toàn bộ lịch sau mỗi phép đổi, hệ thống duy trì chỉ mục theo lớp, giáo viên, phòng, ngày và môn. Một thao tác cục bộ chỉ cập nhật các thành phần liên quan, nhờ đó rút ngắn thời gian kiểm tra xung đột và tính lại điểm phạt."),
  h2("2.7. Kiến trúc web và công nghệ nền"),
  p("Kiến trúc client–server tách giao diện khỏi nghiệp vụ. REST API phục vụ các thao tác đồng bộ; WebSocket truyền tiến độ và thông báo thời gian thực; queue tách tác vụ tối ưu kéo dài khỏi vòng đời request. Cơ sở dữ liệu quan hệ bảo đảm toàn vẹn thực thể, còn ORM chuẩn hóa truy cập và migration."),
  h2("2.8. Kết luận chương 2"),
  p("Cơ sở lý thuyết cho thấy cần phối hợp mô hình ràng buộc với heuristic và metaheuristic. Các khái niệm này là nền tảng cho thiết kế dữ liệu, thuật toán và kiến trúc vận hành được trình bày ở các chương sau."),
);

body.push(
  h1("CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG"),
  h2("3.1. Mô hình use case"),
  p("Use case được đối chiếu trực tiếp từ route Next.js, lời gọi API trong giao diện và controller/service NestJS; các file Markdown không được dùng làm căn cứ xác nhận chức năng."),
  ...diagram("usecase-admin.png", "Hình 3.1. Sơ đồ use case quản trị viên", 620, 537),
  ...diagram("usecase-teacher.png", "Hình 3.2. Sơ đồ use case giáo viên", 620, 537),
  h3("3.1.1. Ma trận truy vết chức năng với mã nguồn"),
  ...labeledTable("Bảng 3.1. Ma trận truy vết chức năng với mã nguồn", ["Nhóm", "Backend", "Frontend"], [
    ["Xác thực, tài khoản", "auth; users controllers", "Login; admin/accounts; teacher/profile"],
    ["Danh mục", "system; resources; organization", "admin/classes; teachers; subjects"],
    ["Phân công, Excel", "assignments; excel; auto-assign", "admin/assignments"],
    ["Ràng buộc", "constraint-config; fixed-period", "admin/configuration; fixed-periods"],
    ["Sinh và tinh chỉnh", "algorithm; worker", "admin/timetable; Pareto; Variant; ChangeHistory"],
    ["Lịch bận, nghỉ", "busy-schedule; schedule", "admin/busy-schedule; absence; teacher/feedback"],
    ["Đổi tiết", "swap-request", "teacher/swaps; admin/swaps"],
    ["Phân tích, AI", "benchmark; fairness; mined-rules; ai", "benchmark; fairness; mined-rules; AssistantWidget"],
  ], [1800, 3500, 3770]),
  h2("3.2. Kiến trúc tổng thể"),
  p("MiKiTimetable được tổ chức theo ba tầng. Frontend Next.js đảm nhiệm giao diện và trạng thái người dùng. Backend NestJS cung cấp API, xác thực, nghiệp vụ và điều phối job. PostgreSQL lưu dữ liệu quan hệ; Redis hỗ trợ BullMQ và truyền trạng thái công việc."),
  ...placeholder("Hình 3.3. Kiến trúc tổng thể MiKiTimetable", 2700),
  ...labeledTable("Bảng 3.2. Công nghệ sử dụng", ["Tầng", "Công nghệ", "Trách nhiệm"], [
    ["Trình bày", "Next.js, React, Tailwind, dnd-kit", "Giao diện quản trị và giáo viên"],
    ["Ứng dụng", "NestJS, TypeScript, Socket.IO, BullMQ", "API, nghiệp vụ, realtime và worker"],
    ["Dữ liệu", "PostgreSQL, Prisma, Redis", "Quan hệ, migration, queue và cache"],
    ["Tích hợp", "ExcelJS, iCalendar, AI provider", "Nhập/xuất, lịch chia sẻ và trợ lý AI"],
  ], [1800, 3300, 3970]),
  h2("3.3. Mô hình hóa thời gian và dữ liệu lõi"),
  p("Mỗi slot gồm ngày, tiết, tuần, lớp, môn, giáo viên, phòng, trạng thái khóa và nguồn tạo. Ngày dùng miền 2–7; tiết dùng miền tuyệt đối 1–10. Các unique key tổ hợp bảo vệ lớp, giáo viên và phòng khỏi bị gán trùng cùng thời điểm."),
  h2("3.4. Thiết kế hệ thống ràng buộc"),
  ...labeledTable("Bảng 3.3. Nhóm ràng buộc cứng", ["Mã", "Ràng buộc", "Ý nghĩa"], [
    ["HC1", "Không trùng lớp", "Một lớp không học hai môn cùng thời điểm."], ["HC2", "Không trùng giáo viên", "Một giáo viên không dạy hai lớp cùng lúc."],
    ["HC3", "Không trùng phòng", "Một phòng không phục vụ hai lớp cùng lúc."], ["HC4", "Đúng phân công", "Slot dùng đúng giáo viên của lớp và môn."],
    ["HC5", "Thời gian hợp lệ", "Ngày, tiết và tuần thuộc phạm vi học kỳ."], ["HC6", "Phù hợp phòng", "Môn thực hành dùng đúng loại phòng."],
    ["HC7", "Lịch bận và khóa", "Không xếp vào thời điểm cấm; không di chuyển slot khóa."],
  ], [1000, 2800, 5270]),
  ...labeledTable("Bảng 3.4. Nhóm ràng buộc mềm", ["Nhóm", "Mục tiêu"], [
    ["Phân bố môn", "Tránh dồn môn và khoảng cách bất hợp lý."], ["Cấu trúc tiết", "Giảm tiết trống, ghép hợp lý môn hai tiết."],
    ["Khối lượng giáo viên", "Hạn chế tiết liên tục và số buổi đến trường."], ["Nguyện vọng", "Ưu tiên thời điểm mong muốn."],
    ["Ổn định", "Giảm thay đổi so với lịch đã công bố."], ["Công bằng", "Giảm chênh lệch gánh nặng giữa giáo viên."],
  ], [3500, 5570]),
  h2("3.5. Thiết kế cơ sở dữ liệu"),
  p("Lược đồ được dựng trực tiếp từ 20 model trong BE_TKB/prisma/schema.prisma."),
  ...labeledTable("Bảng 3.5. Các nhóm thực thể dữ liệu", ["Nhóm", "Thực thể", "Vai trò"], [
    ["Hệ thống", "AcademicYear, Semester, ConstraintSetting, FixedPeriodRule, CurriculumCombination", "Năm học, học kỳ và luật"],
    ["Tài nguyên", "Subject, Room", "Môn và phòng"], ["Nhân sự", "User, Teacher, TeacherConstraint", "Tài khoản, giáo viên và nguyện vọng"],
    ["Tổ chức", "Class, TeachingAssignment", "Lớp và phân công"], ["Kết quả", "GeneratedTimetable, TimetableSlot, TimetableChangeLog", "Phương án, slot và nhật ký"],
    ["Vận hành", "ScheduleOverlay, TeacherBusyRequest, SwapRequest", "Lịch hiệu lực, lịch bận và đổi tiết"],
    ["Hỗ trợ", "Notification, KnowledgeChunk", "Thông báo và tri thức AI"],
  ], [1700, 3500, 3870]),
  ...diagram("erd-core.png", "Hình 3.4. ERD dữ liệu lõi và phân công", 650, 439),
  ...diagram("erd-operations.png", "Hình 3.5. ERD thời khóa biểu và dữ liệu vận hành", 650, 488),
  h3("3.5.1. Từ điển bảng cơ sở dữ liệu"),
  ...labeledTable("Bảng 3.6. Từ điển bảng cơ sở dữ liệu", ["Model", "Khóa chính", "Khóa ngoại chính", "Chức năng"], [
    ["AcademicYear", "id", "—", "Năm học"], ["Semester", "id", "year_id", "Học kỳ"], ["Room", "id", "—", "Phòng"], ["Subject", "id", "—", "Môn"],
    ["User", "id", "teacher_profile_id", "Tài khoản"], ["Teacher", "id", "—", "Giáo viên"], ["TeacherConstraint", "id", "teacher_id", "BUSY/AVOID/PREFER"],
    ["Class", "id", "fixed_room_id, homeroom_teacher_id", "Lớp"], ["ConstraintSetting", "key", "—", "Trọng số ràng buộc"],
    ["FixedPeriodRule", "id", "—", "Tiết cố định"], ["CurriculumCombination", "id", "—", "Tổ hợp môn"],
    ["TeachingAssignment", "id", "semester_id, class_id, teacher_id, subject_id", "Phân công"],
    ["GeneratedTimetable", "id", "semester_id", "Phương án TKB"], ["TimetableSlot", "id", "timetable_id và các tài nguyên", "Ô lịch"],
    ["TimetableChangeLog", "id", "timetable_id", "Nhật ký thay đổi"], ["ScheduleOverlay", "id", "semester_id", "Lớp lịch hiệu lực"],
    ["TeacherBusyRequest", "id", "teacher_id, semester_id", "Yêu cầu lịch bận"], ["Notification", "id", "user_id logic", "Thông báo"],
    ["KnowledgeChunk", "id", "—", "Tri thức trợ lý AI"], ["SwapRequest", "id", "semester_id, requester, partner", "Yêu cầu đổi tiết"],
  ], [1700, 1400, 3000, 2970]),
  h2("3.6. Thiết kế luồng sinh và công bố lịch"),
  p("Controller kiểm tra quyền và tạo job; producer đưa job vào BullMQ; worker tải snapshot dữ liệu, chạy nhiều lần khởi tạo, phát tiến độ qua WebSocket và lưu phương án. Công bố là bước độc lập sau khi quản trị viên lựa chọn kết quả."),
  ...placeholder("Hình 3.6. Trình tự sinh và công bố thời khóa biểu", 2800),
  h2("3.7. Thiết kế bảo mật"),
  bullet("Mật khẩu băm bằng bcrypt; JWT và guard kiểm tra vai trò."), bullet("Captcha HMAC và rate limit bảo vệ endpoint đăng nhập."),
  bullet("DTO validation, Prisma transaction và cấu hình bí mật qua biến môi trường."), bullet("Công cụ của trợ lý AI dùng allowlist và kiểm tra quyền."),
  h2("3.8. Kết luận chương 3"),
  p("Thiết kế liên kết use case, kiến trúc module, ràng buộc và mô hình dữ liệu với chức năng thực tế trong mã nguồn. Đây là cơ sở trực tiếp cho quá trình xây dựng và triển khai."),
);

body.push(
  h1("CHƯƠNG 4. XÂY DỰNG, TRIỂN KHAI VÀ ĐÁNH GIÁ HỆ THỐNG"),
  h2("4.1. Môi trường và công nghệ phát triển"),
  ...labeledTable("Bảng 4.1. Môi trường và công nghệ phát triển", ["Thành phần", "Phiên bản/Thư viện", "Mục đích"], [
    ["Backend", "NestJS 11, TypeScript 5.7", "REST API, WebSocket, module nghiệp vụ"], ["Frontend", "Next.js 16.1.4, React 19.2.3", "App Router và giao diện"],
    ["CSDL", "PostgreSQL 17, Prisma 5.10", "Quan hệ, migration và ORM"], ["Queue", "BullMQ 5, Redis 7", "Job tối ưu nền"],
    ["UI", "Tailwind CSS 4, dnd-kit, Lucide", "Responsive và kéo-thả"], ["Kiểm thử", "Jest 30, Playwright 1.60", "Unit, integration và UI"],
  ], [1900, 3000, 4170]),
  h2("4.2. Cài đặt và khởi chạy"),
  h3("4.2.1. Khởi chạy bằng Docker Compose"),
  codeBlock(["Copy-Item .env.example .env", "docker compose up -d --build", "docker compose logs -f"]),
  h3("4.2.2. Chạy ở chế độ phát triển"),
  codeBlock(["# Backend", "cd BE_TKB", "npm install", "npx prisma generate", "npm run start:dev", "", "# Frontend", "cd FE_TKB", "npm install", "npm run dev"]),
  h2("4.3. Các phân hệ đã xây dựng"),
  ...labeledTable("Bảng 4.2. Các phân hệ đã cài đặt", ["Phân hệ", "Chức năng"], [
    ["Xác thực", "Captcha, JWT, phân quyền, đổi mật khẩu và tài khoản"], ["Danh mục", "Năm học, học kỳ, lớp, giáo viên, môn, phòng"],
    ["Phân công", "CRUD, Excel và auto-assign"], ["Xếp lịch", "Pre-flight, job nền, nhiều phương án, realtime"],
    ["Tinh chỉnh", "Kéo-thả, khóa, đổi dây chuyền, lịch sử, hoàn tác"], ["Lịch sống", "Nghỉ, dạy thay, đổi tiết và lịch hiệu lực"],
    ["Giáo viên", "Dashboard, lịch cá nhân, nguyện vọng và thông báo"], ["Phân tích và AI", "Benchmark, fairness, mined rules và trợ lý AI"],
  ], [2300, 6770]),
  h2("4.4. Cài đặt thuật toán xếp lịch"),
  p("Pha đầu đặt tiết cố định và slot khóa. Pha heuristic ưu tiên đơn vị khó xếp, kiểm tra lớp, giáo viên, phòng và buổi trước khi gán. Pha tối ưu cục bộ dùng hotspot sampling, hill climbing, simulated annealing và tabu memory. Các index được cập nhật tăng dần sau mỗi phép đổi."),
  h2("4.5. Giao diện và trải nghiệm người dùng"),
  p("Giao diện quản trị sử dụng thanh điều hướng bên trái; màn hình thời khóa biểu hiển thị lưới ngày–tiết, cho phép lọc theo lớp hoặc giáo viên, kéo-thả, khóa slot và xem vi phạm. Cổng giáo viên tập trung vào lịch cá nhân, lịch bận, nguyện vọng, đổi tiết và thông báo."),
  ...placeholder("Hình 4.1. Giao diện đăng nhập", 2200), ...placeholder("Hình 4.2. Dashboard quản trị", 2500),
  ...placeholder("Hình 4.3. Màn hình cấu hình dữ liệu và ràng buộc", 2500), ...placeholder("Hình 4.4. Màn hình thời khóa biểu và kéo-thả", 2800),
  ...placeholder("Hình 4.5. Màn hình benchmark và so sánh phương án", 2500), ...placeholder("Hình 4.6. Cổng giáo viên", 2400),
  ...placeholder("Hình 4.7. Trợ lý AI có guardrail", 2300),
  h2("4.6. Nhập và xuất dữ liệu"),
  p("Pipeline Excel chuẩn hóa tiêu đề và bí danh sheet, kiểm tra quan hệ tham chiếu rồi ghi dữ liệu trong transaction. Đầu ra hỗ trợ workbook thời khóa biểu, trang in có thể lưu PDF, tệp iCalendar và liên kết xem công khai."),
  h2("4.7. Kết quả đánh giá nội bộ"),
  p("Các số liệu dưới đây là kết quả nội bộ từ bộ dữ liệu mẫu và cần được chạy lại với seed, phần cứng và commit cố định trước khi sử dụng như kết quả thực nghiệm chính thức."),
  ...labeledTable("Bảng 4.3. Kết quả benchmark nội bộ", ["Chỉ số", "Đầu phiên", "Sau cải tiến", "Diễn giải"], [
    ["Điểm thô", "−4.982", "−3.532", "Tổng phạt giảm"], ["Phạt tránh được/tiết", "6,26", "4,87", "Chuẩn hóa theo số tiết"],
    ["Số slot", "956", "930", "Loại 26 tiết lễ kế thừa lặp"], ["GV không có ngày nghỉ", "3/76", "2/76", "Cải thiện phân bố lịch"],
    ["Tỷ lệ tải nặng/nhẹ", "8,8", "8,6", "Chênh lệch vẫn còn lớn"],
  ], [2250, 1400, 1600, 3820]),
  h2("4.8. Kiểm thử và kiểm soát chất lượng"),
  ...labeledTable("Bảng 4.4. Kiểm thử và kiểm soát chất lượng", ["Lớp kiểm tra", "Mục tiêu", "Ví dụ"], [
    ["Unit", "Hàm và rule độc lập", "Grid index, scorer, guardrail"], ["Service", "Nghiệp vụ và biên", "Algorithm, fairness, swap, Excel"],
    ["API", "Controller và quyền", "Algorithm controller, auth guard"], ["E2E/UI", "Luồng người dùng", "Đăng nhập, sinh và xem lịch"],
    ["CI", "Ngăn hồi quy", "Lint, build và test"],
  ], [2000, 2800, 4270]),
  h2("4.9. Triển khai hệ thống"),
  p("Frontend và backend được đóng gói bằng container và hiện phục vụ tại https://gettimetable.cloud/. Reverse proxy định tuyến HTTPS; PostgreSQL và Redis nằm trong mạng nội bộ; migration chạy trước khi ứng dụng nhận lưu lượng."),
  ...placeholder("Hình 4.8. Sơ đồ triển khai production", 2600),
  h2("4.10. Hạn chế"),
  bullet("Chất lượng phụ thuộc dữ liệu đầu vào, trọng số và ngân sách chạy."), bullet("Ngưỡng đánh giá mới hiệu chỉnh trên dữ liệu mẫu."),
  bullet("Một số mục tiêu mềm xung đột tự nhiên."), bullet("Ảnh giao diện và một số sơ đồ vẫn là placeholder."),
  h2("4.11. Kết luận chương 4"),
  p("MiKiTimetable đã triển khai chuỗi chức năng từ dữ liệu, xếp lịch, tinh chỉnh, công bố đến vận hành thay đổi. Kiến trúc queue và realtime tách tác vụ tối ưu khỏi giao diện, trong khi kiểm thử bao phủ các thành phần quan trọng của thuật toán và nghiệp vụ."),
);

body.push(
  h1("CHƯƠNG 5. KẾT LUẬN"),
  h2("5.1. Kết quả đạt được"),
  p("Đề tài đã xây dựng hệ thống xếp thời khóa biểu THPT theo hướng sản phẩm hoàn chỉnh. Hệ thống quản lý dữ liệu nguồn, mô hình hóa ràng buộc, tạo nhiều phương án, kiểm tra tính hợp lệ, đánh giá chất lượng, hỗ trợ điều chỉnh thủ công và quản lý lịch sau công bố."),
  p("Về kỹ thuật, kết quả chính gồm pipeline lai ba pha, index tăng dần, bảo toàn slot khóa, tách hard/soft constraint, worker có fallback, thao tác kéo-thả an toàn và lịch sử thay đổi. Kiến trúc NestJS–Next.js–PostgreSQL–Redis tạo nền tảng cho mở rộng."),
  h2("5.2. Hạn chế của đề tài"),
  p("Kết quả benchmark chưa được tái lập trên nhiều trường và nhiều cấu hình phần cứng. Bộ trọng số vẫn cần hiệu chỉnh theo chính sách từng đơn vị. Một số ảnh minh họa chưa được chụp từ môi trường sản xuất và dữ liệu thử nghiệm chưa phản ánh đầy đủ các tình huống ngoại lệ."),
  h2("5.3. Hướng phát triển"),
  numbered("Đánh giá trên nhiều bộ dữ liệu thực tế và công bố giao thức benchmark tái lập."),
  numbered("Mở rộng tối ưu đa mục tiêu và giải thích Pareto theo lớp, giáo viên và cơ sở vật chất."),
  numbered("Tăng cường kiểm thử tải, quan sát production, sao lưu và khôi phục."),
  numbered("Hoàn thiện phân quyền chi tiết, nhật ký kiểm toán và chính sách dữ liệu."),
  numbered("Mở rộng trợ lý AI theo nguyên tắc least privilege và bắt buộc trích dẫn nguồn nội bộ."),
  h2("5.4. Kết luận chung"),
  p("MiKiTimetable chứng minh khả năng kết hợp thuật toán tối ưu với quy trình nghiệp vụ và kiến trúc web hiện đại. Hệ thống chưa loại bỏ vai trò của người xếp lịch mà cung cấp công cụ để giảm thao tác lặp, phát hiện mâu thuẫn sớm và so sánh phương án bằng tiêu chí định lượng."),
  h1("TÀI LIỆU THAM KHẢO"),
  ref("[1] Bộ Giáo dục và Đào tạo (2018), Thông tư số 32/2018/TT-BGDĐT ban hành Chương trình giáo dục phổ thông; cập nhật bởi Thông tư số 13/2022/TT-BGDĐT."),
  ref("[2] Bộ Giáo dục và Đào tạo (2025), Thông tư số 05/2025/TT-BGDĐT quy định chế độ làm việc đối với giáo viên phổ thông, dự bị đại học."),
  ref("[3] Lewis, R. (2008), A survey of metaheuristic-based techniques for University Timetabling problems, OR Spectrum, 30, 167–190. https://doi.org/10.1007/s00291-007-0097-0."),
  ref("[4] Google for Developers, Constraint Optimization, https://developers.google.com/optimization/cp (truy cập tháng 9/2026)."),
  ref("[5] NestJS Documentation, https://docs.nestjs.com/ (truy cập tháng 9/2026)."),
  ref("[6] Next.js Documentation, https://nextjs.org/docs (truy cập tháng 9/2026)."),
  ref("[7] Prisma Documentation, https://www.prisma.io/docs (truy cập tháng 9/2026)."),
  ref("[8] PostgreSQL Documentation, https://www.postgresql.org/docs/ (truy cập tháng 9/2026)."),
  ref("[9] Redis Documentation, https://redis.io/docs/ (truy cập tháng 9/2026)."),
  ref("[10] MiKiTimetable, mã nguồn BE_TKB/src và FE_TKB/app, phiên bản làm việc ngày 16/09/2026."),
  ref("[11] MiKiTimetable, lược đồ dữ liệu BE_TKB/prisma/schema.prisma, phiên bản làm việc ngày 16/09/2026."),
  ref("[12] MiKiTimetable, https://gettimetable.cloud/ (truy cập ngày 16/09/2026)."),
);

const doc = new Document({
  creator: "MiKiTimetable",
  title: "Báo cáo hệ thống xếp thời khóa biểu THPT thông minh MiKiTimetable",
  description: "Bản nháp báo cáo tham khảo tài liệu mẫu, hình ảnh để placeholder.",
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
