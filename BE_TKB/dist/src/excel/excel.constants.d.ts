export declare const WORKBOOK_SHEET_NAMES: {
    readonly guide: "Huong_dan";
    readonly references: "Nguon_tham_khao";
    readonly subjects: "DM_Mon_GDPT2018";
    readonly teachers: "DM_Giao_vien";
    readonly classes: "DM_Lop";
    readonly combinations: "DM_To_hop";
    readonly assignments: "Phan_cong";
    readonly summary: "Tong_hop_GV";
};
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
export declare const SUBJECT_CATALOG: SubjectCatalogItem[];
export declare const GUIDE_ROWS: Array<[string, string]>;
export declare const REFERENCE_ROWS: Array<[string, string]>;
export declare const SHEET_ALIASES: Record<string, string[]>;
export declare const HEADER_ALIASES: {
    readonly teachers: {
        readonly code: readonly ["magv", "ma", "teachercode"];
        readonly fullName: readonly ["hoten", "hovaten", "giaovien", "tengiaovien"];
        readonly department: readonly ["tocm", "tochuyenmon", "to"];
        readonly majorSubject: readonly ["monchuyenmonchinh", "monchuyenmon"];
        readonly status: readonly ["trangthai"];
        readonly baseLoad: readonly ["dinhmuctuan", "dinhmucgoc"];
        readonly reduction: readonly ["giamtrutuan", "giamtru"];
        readonly effectiveLoad: readonly ["dinhmuchieuluc", "dinhmucthuchien", "dinhmucthucte"];
        readonly notes: readonly ["ghichu"];
    };
    readonly classes: {
        readonly name: readonly ["lop"];
        readonly gradeLevel: readonly ["khoi"];
        readonly studentCount: readonly ["siso"];
        readonly session: readonly ["buoihoc", "ca"];
        readonly combinationCode: readonly ["matohop"];
        readonly homeroomCode: readonly ["gvcnma"];
        readonly homeroomName: readonly ["gvcnhoten"];
        readonly notes: readonly ["ghichu"];
    };
    readonly combinations: {
        readonly code: readonly ["matohop"];
        readonly gradeLevel: readonly ["khoi"];
        readonly elective1: readonly ["montuchon1", "monluachon1"];
        readonly elective2: readonly ["montuchon2", "monluachon2"];
        readonly elective3: readonly ["montuchon3", "monluachon3"];
        readonly elective4: readonly ["montuchon4", "monluachon4"];
        readonly special1: readonly ["chuyende1", "chuyendehoctap1"];
        readonly special2: readonly ["chuyende2", "chuyendehoctap2"];
        readonly special3: readonly ["chuyende3", "chuyendehoctap3"];
        readonly notes: readonly ["ghichu"];
    };
    readonly assignments: {
        readonly order: readonly ["stt"];
        readonly schoolYear: readonly ["namhoc"];
        readonly gradeLevel: readonly ["khoi"];
        readonly className: readonly ["lop"];
        readonly combinationCode: readonly ["matohop"];
        readonly subjectCode: readonly ["mamon", "mamonhoc"];
        readonly subjectName: readonly ["tenmon", "tenmonhoc"];
        readonly programGroup: readonly ["nhomct", "nhomchuongtrinh"];
        readonly periodsHk1: readonly ["tiethk1", "sotiethk1"];
        readonly periodsHk2: readonly ["tiethk2", "sotiethk2"];
        readonly teacherHk1Code: readonly ["gvhk1ma"];
        readonly teacherHk1Name: readonly ["gvhk1hoten"];
        readonly teacherHk1Load: readonly ["gvhk1dinhmuc"];
        readonly teacherHk2Code: readonly ["gvhk2ma"];
        readonly teacherHk2Name: readonly ["gvhk2hoten"];
        readonly teacherHk2Load: readonly ["gvhk2dinhmuc"];
        readonly notes: readonly ["ghichu"];
    };
};
