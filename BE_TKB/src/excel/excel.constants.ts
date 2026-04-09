export const WORKBOOK_SHEET_NAMES = {
  guide: 'Huong_dan',
  references: 'Nguon_tham_khao',
  subjects: 'DM_Mon_GDPT2018',
  teachers: 'DM_Giao_vien',
  classes: 'DM_Lop',
  combinations: 'DM_To_hop',
  assignments: 'Phan_cong',
  summary: 'Tong_hop_GV',
} as const;

export type WorkbookSheetKey = keyof typeof WORKBOOK_SHEET_NAMES;

export interface SubjectCatalogItem {
  code: string;
  name: string;
  group: string;
  note?: string;
  aliases?: string[];
  isSpecial?: boolean;
  isPractice?: boolean;
}

export const SUBJECT_CATALOG: SubjectCatalogItem[] = [
  { code: 'TOAN', name: 'Toán', group: 'Bắt buộc', aliases: ['TOANHOC', 'MATH'] },
  { code: 'VAN', name: 'Ngữ văn', group: 'Bắt buộc', aliases: ['NGUVAN', 'NV'] },
  { code: 'ANH', name: 'Tiếng Anh', group: 'Bắt buộc', aliases: ['TA', 'TIENGANH', 'NGOAINGU1'] },
  { code: 'LS', name: 'Lịch sử', group: 'Bắt buộc', aliases: ['LICHSU', 'SU'] },
  { code: 'GDTC', name: 'Giáo dục thể chất', group: 'Bắt buộc', aliases: ['THEDUC', 'THECHAT'] },
  { code: 'GDQP', name: 'Giáo dục quốc phòng và an ninh', group: 'Bắt buộc', aliases: ['GDQPAN', 'QPAN'] },
  { code: 'HDTN', name: 'Hoạt động trải nghiệm hướng nghiệp', group: 'Bắt buộc', aliases: ['HDTNHN'] },
  { code: 'GDDP', name: 'Giáo dục địa phương', group: 'Bắt buộc' },
  { code: 'LY', name: 'Vật lý', group: 'Lựa chọn', aliases: ['VL', 'VATLY'] },
  { code: 'HOA', name: 'Hóa học', group: 'Lựa chọn', aliases: ['HOAHOC', 'HH'] },
  { code: 'SINH', name: 'Sinh học', group: 'Lựa chọn', aliases: ['SH', 'SINHHOC'] },
  { code: 'DIA', name: 'Địa lý', group: 'Lựa chọn', aliases: ['DL', 'DIALI'] },
  { code: 'GDKT', name: 'Giáo dục kinh tế và pháp luật', group: 'Lựa chọn', aliases: ['GDKTPL', 'KTPL'] },
  { code: 'CN', name: 'Công nghệ', group: 'Lựa chọn', aliases: ['CONGNGHE'] },
  { code: 'TIN', name: 'Tin học', group: 'Lựa chọn', aliases: ['TH', 'TINHOC'] },
  { code: 'MT', name: 'Mỹ thuật', group: 'Lựa chọn', aliases: ['MYTHUAT', 'AMTHUAT'] },
  {
    code: 'CHAO_CO',
    name: 'Chào cờ',
    group: 'Hoạt động tập thể',
    aliases: ['CHAOCO'],
    isSpecial: true,
  },
  {
    code: 'SH_CUOI_TUAN',
    name: 'Sinh hoạt cuối tuần',
    group: 'Hoạt động tập thể',
    aliases: ['SHCN', 'SINHHOATCUOITUAN'],
    isSpecial: true,
  },
];

export const GUIDE_ROWS: Array<[string, string]> = [
  ['Mục đích', 'Dùng file này để nhập dữ liệu giáo viên, lớp, tổ hợp và phân công giảng dạy theo năm học.'],
  ['Phạm vi import', 'Hệ thống chỉ đọc 4 sheet: DM_Giao_vien, DM_Lop, DM_To_hop, Phan_cong.'],
  ['Năm học', 'Mỗi lần import sẽ áp dụng cho 2 học kỳ của năm học đang chọn.'],
  ['Tiết HK1/HK2', 'Nhập số tiết mỗi tuần của học kỳ 1 và học kỳ 2 cho từng dòng phân công.'],
  ['Mã giáo viên', 'Mã giáo viên phải duy nhất. Nếu đã tồn tại, hệ thống sẽ cập nhật theo file mới.'],
  ['Lớp và tổ hợp', 'Lớp được upsert theo tên lớp. Tổ hợp được thay thế toàn bộ theo file import.'],
  ['Cảnh báo', 'Nếu file có lỗi validation, hệ thống sẽ rollback toàn bộ và không ghi một phần dữ liệu.'],
];

export const REFERENCE_ROWS: Array<[string, string]> = [
  ['Thông tư 32/2018/TT-BGDĐT', 'Chương trình giáo dục phổ thông 2018'],
  ['Thông tư 13/2022/TT-BGDĐT', 'Điều chỉnh chương trình GDPT, trong đó Lịch sử là nội dung bắt buộc ở THPT'],
  ['Công văn 5512/BGDĐT-GDTrH', 'Hướng dẫn xây dựng và tổ chức thực hiện kế hoạch giáo dục của nhà trường'],
  ['Thông tư 05/2025/TT-BGDĐT', 'Chế độ làm việc đối với giáo viên phổ thông và giáo viên dự bị đại học'],
];

export const SHEET_ALIASES: Record<string, string[]> = {
  [WORKBOOK_SHEET_NAMES.teachers]: ['dmgiaovien', 'danhmucgiaovien', 'giaovien'],
  [WORKBOOK_SHEET_NAMES.classes]: ['dmlop', 'danhmuclop', 'lop'],
  [WORKBOOK_SHEET_NAMES.combinations]: ['dmtohop', 'danhmuctohop', 'tohop'],
  [WORKBOOK_SHEET_NAMES.assignments]: [
    'phancong',
    'bangphanconggiangdaymonhocgiaovienthpt',
    'bangphanconggiangday',
  ],
};

export const HEADER_ALIASES = {
  teachers: {
    code: ['magv', 'mgv', 'ma', 'teachercode'],
    fullName: ['hoten', 'htn', 'hovaten', 'giaovien', 'tengiaovien'],
    department: ['tocm', 'tcm', 'tochuyenmon', 'to'],
    majorSubject: ['monchuyenmonchinh', 'mnchuynmnchnh', 'monchuyenmon'],
    status: ['trangthai', 'trngthi'],
    baseLoad: ['dinhmuctuan', 'nhmctun', 'dinhmucgoc'],
    reduction: ['giamtrutuan', 'gimtrtun', 'giamtru'],
    effectiveLoad: ['dinhmuchieuluc', 'nhmchiulc', 'dinhmucthuchien', 'dinhmucthucte'],
    notes: ['ghichu', 'ghich'],
  },
  classes: {
    name: ['lop', 'lp'],
    gradeLevel: ['khoi', 'khi'],
    studentCount: ['siso', 'ss'],
    session: ['buoihoc', 'buihc', 'ca'],
    combinationCode: ['matohop', 'mthp'],
    homeroomCode: ['gvcnma', 'gvcnm'],
    homeroomName: ['gvcnhoten', 'gvcnhtn'],
    notes: ['ghichu', 'ghich'],
  },
  combinations: {
    code: ['matohop', 'mthp'],
    gradeLevel: ['khoi', 'khi'],
    elective1: ['montuchon1', 'monluachon1', 'mn1'],
    elective2: ['montuchon2', 'monluachon2', 'mn2'],
    elective3: ['montuchon3', 'monluachon3', 'mn3'],
    elective4: ['montuchon4', 'monluachon4', 'mn4'],
    special1: ['chuyende1', 'chuyendehoctap1', 'chuyn1'],
    special2: ['chuyende2', 'chuyendehoctap2', 'chuyn2'],
    special3: ['chuyende3', 'chuyendehoctap3', 'chuyn3'],
    notes: ['ghichu', 'ghich'],
  },
  assignments: {
    order: ['stt'],
    schoolYear: ['namhoc', 'nmhc'],
    gradeLevel: ['khoi', 'khi'],
    className: ['lop', 'lp'],
    combinationCode: ['matohop', 'mthp'],
    subjectCode: ['mamon', 'mmn', 'mamonhoc'],
    subjectName: ['tenmon', 'tnmn', 'tenmonhoc'],
    programGroup: ['nhomct', 'nhmct', 'nhomchuongtrinh'],
    periodsHk1: ['tiethk1', 'tithk1', 'sotiethk1'],
    periodsHk2: ['tiethk2', 'tithk2', 'sotiethk2'],
    teacherHk1Code: ['gvhk1ma', 'gvhk1m'],
    teacherHk1Name: ['gvhk1hoten', 'gvhk1htn'],
    teacherHk1Load: ['gvhk1dinhmuc', 'gvhk1nhmc'],
    teacherHk2Code: ['gvhk2ma', 'gvhk2m'],
    teacherHk2Name: ['gvhk2hoten', 'gvhk2htn'],
    teacherHk2Load: ['gvhk2dinhmuc', 'gvhk2nhmc'],
    notes: ['ghichu', 'ghich'],
  },
} as const;
