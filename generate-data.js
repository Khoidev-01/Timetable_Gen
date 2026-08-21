/**
 * ============================================================
 * Script tạo file Excel dữ liệu chuẩn cho hệ thống xếp TKB
 * Theo chương trình GDPT 2018 - Cấp THPT
 * ============================================================
 *
 * Cấu trúc trường:
 *   - 3 tầng, mỗi tầng 15 phòng (101-115, 201-215, 301-315)
 *   - Khối 10: 10C1 → 10C14 (Sáng)   → Phòng 201-214
 *   - Khối 11: 11B1 → 11B14 (Chiều)  → Phòng 101-114
 *   - Khối 12: 12A1 → 12A14 (Sáng)   → Phòng 101-114
 *   - Tầng 3:  Lab Lý(301), Lab Hóa(302), Lab Sinh(303),
 *              Lab dự phòng(304,305), Phòng Tin(314,315)
 *
 * Số tiết/tuần theo GDPT 2018 (35 tuần/năm):
 *   Bắt buộc: Toán 4, Văn 3, Anh 3, Sử 1.5, GDTC 2, GDQP 1,
 *             HDTN 3, GDDP 1
 *   Lựa chọn (4 môn, mỗi môn 2t/tuần): Lý, Hóa, Sinh, Địa,
 *             GDKT, CN, Tin, Mỹ thuật
 *   Chuyên đề (3 cụm × 35 tiết/năm ≈ 1t/tuần mỗi cụm)
 *
 * Lưu ý:
 *   - Lý, Hóa, Sinh, Tin có chia tiết thực hành và lý thuyết
 *   - GDQP, GDTC học khác buổi, tại sân bãi
 */

const ExcelJS = require('./BE_TKB/node_modules/exceljs');
const path = require('path');

// ============================================================
// 1. SUBJECT CATALOG (khớp SUBJECT_CATALOG trong excel.constants.ts)
// ============================================================
const SUBJECTS = [
  { code: 'TOAN', name: 'Toán', group: 'Bắt buộc' },
  { code: 'VAN', name: 'Ngữ văn', group: 'Bắt buộc' },
  { code: 'ANH', name: 'Tiếng Anh', group: 'Bắt buộc' },
  { code: 'LS', name: 'Lịch sử', group: 'Bắt buộc' },
  { code: 'GDTC', name: 'Giáo dục thể chất', group: 'Bắt buộc' },
  { code: 'GDQP', name: 'Giáo dục quốc phòng và an ninh', group: 'Bắt buộc' },
  { code: 'HDTN', name: 'Hoạt động trải nghiệm hướng nghiệp', group: 'Bắt buộc' },
  { code: 'GDDP', name: 'Giáo dục địa phương', group: 'Bắt buộc' },
  { code: 'LY', name: 'Vật lý', group: 'Lựa chọn' },
  { code: 'HOA', name: 'Hóa học', group: 'Lựa chọn' },
  { code: 'SINH', name: 'Sinh học', group: 'Lựa chọn' },
  { code: 'DIA', name: 'Địa lý', group: 'Lựa chọn' },
  { code: 'GDKT', name: 'Giáo dục kinh tế và pháp luật', group: 'Lựa chọn' },
  { code: 'CN', name: 'Công nghệ', group: 'Lựa chọn' },
  { code: 'TIN', name: 'Tin học', group: 'Lựa chọn' },
  { code: 'MT', name: 'Mỹ thuật', group: 'Lựa chọn' },
  { code: 'CHAO_CO', name: 'Chào cờ', group: 'Hoạt động tập thể', isSpecial: true },
  { code: 'SH_CUOI_TUAN', name: 'Sinh hoạt cuối tuần', group: 'Hoạt động tập thể', isSpecial: true },
];

// ============================================================
// 2. PERIOD DISTRIBUTION (số tiết/tuần) theo GDPT 2018
// ============================================================
// Bắt buộc cho tất cả HS:
//   Toán:  Lớp 10→ 4t (3LT+1 hoặc 4LT), Lớp 11→ 4t, Lớp 12→ 4t  (105 tiết/năm ÷ 35 = 3t/tuần → nhưng thực tế trường thường xếp 4)
//   Văn:   3t/tuần (105/35=3)
//   Anh:   3t/tuần (105/35=3)
//   Sử:    2t/tuần (70/35=2) - từ TT13/2022 bắt buộc
//   GDTC:  2t/tuần (70/35=2) - học sân bãi, khác buổi
//   GDQP:  1t/tuần (35/35=1) - học sân bãi, khác buổi
//   HDTN:  3t/tuần (105/35=3)
//   GDDP:  1t/tuần (35/35=1)
//
// Lựa chọn (4 môn × 2t/tuần = 8t):
//   Lý/Hóa/Sinh/Địa/GDKT/CN/Tin/MT → mỗi môn 2t/tuần (70/35=2)
//   Có chia LT và TH cho: Lý(1LT+1TH), Hóa(1LT+1TH), Sinh(1LT+1TH), Tin(1LT+1TH)
//
// Chuyên đề (3 cụm × 1t = 3t):
//   35 tiết/năm mỗi cụm ≈ 1t/tuần
//
// Hoạt động tập thể:
//   Chào cờ: 1t/tuần, Sinh hoạt cuối tuần: 1t/tuần
//
// TỔNG: ~29 tiết/tuần (buổi chính) + GDTC/GDQP khác buổi

// Tiết bắt buộc cho MỖI lớp (không phụ thuộc tổ hợp)
const MANDATORY_PERIODS = {
  TOAN:         { hk1: 4, hk2: 4, type: 'Bắt buộc' },
  VAN:          { hk1: 3, hk2: 3, type: 'Bắt buộc' },
  ANH:          { hk1: 3, hk2: 3, type: 'Bắt buộc' },
  LS:           { hk1: 2, hk2: 2, type: 'Bắt buộc' },
  GDTC:         { hk1: 2, hk2: 2, type: 'Bắt buộc', notes: 'Học khác buổi - Sân bãi' },
  GDQP:         { hk1: 1, hk2: 1, type: 'Bắt buộc', notes: 'Học khác buổi - Sân bãi' },
  HDTN:         { hk1: 3, hk2: 3, type: 'Bắt buộc' },
  GDDP:         { hk1: 1, hk2: 1, type: 'Bắt buộc' },
  CHAO_CO:      { hk1: 1, hk2: 1, type: 'Hoạt động tập thể' },
  SH_CUOI_TUAN: { hk1: 1, hk2: 1, type: 'Hoạt động tập thể' },
};

// Tiết lựa chọn (2t/tuần mỗi môn)
// Môn có thực hành: Lý, Hóa, Sinh, Tin → chia 1LT + 1TH
const ELECTIVE_PERIODS = {
  LY:   { hk1_lt: 1, hk1_th: 1, hk2_lt: 1, hk2_th: 1, hasLab: true },
  HOA:  { hk1_lt: 1, hk1_th: 1, hk2_lt: 1, hk2_th: 1, hasLab: true },
  SINH: { hk1_lt: 1, hk1_th: 1, hk2_lt: 1, hk2_th: 1, hasLab: true },
  TIN:  { hk1_lt: 1, hk1_th: 1, hk2_lt: 1, hk2_th: 1, hasLab: true },
  DIA:  { hk1_lt: 2, hk1_th: 0, hk2_lt: 2, hk2_th: 0, hasLab: false },
  GDKT: { hk1_lt: 2, hk1_th: 0, hk2_lt: 2, hk2_th: 0, hasLab: false },
  CN:   { hk1_lt: 2, hk1_th: 0, hk2_lt: 2, hk2_th: 0, hasLab: false },
  MT:   { hk1_lt: 2, hk1_th: 0, hk2_lt: 2, hk2_th: 0, hasLab: false },
};

// ============================================================
// 3. CURRICULUM COMBINATIONS (tổ hợp lựa chọn)
//    Mỗi tổ hợp gồm 4 môn lựa chọn + 3 chuyên đề
// ============================================================
const COMBINATIONS = [
  // Tổ hợp KHTN nặng
  { code: 'TN1', electives: ['LY', 'HOA', 'SINH', 'TIN'], specials: ['CD_LY', 'CD_HOA', 'CD_SINH'] },
  { code: 'TN2', electives: ['LY', 'HOA', 'TIN', 'CN'], specials: ['CD_LY', 'CD_HOA', 'CD_TIN'] },
  { code: 'TN3', electives: ['LY', 'HOA', 'SINH', 'CN'], specials: ['CD_LY', 'CD_HOA', 'CD_SINH'] },
  // Tổ hợp KHXH nặng
  { code: 'XH1', electives: ['DIA', 'GDKT', 'CN', 'TIN'], specials: ['CD_DIA', 'CD_GDKT', 'CD_TIN'] },
  { code: 'XH2', electives: ['DIA', 'GDKT', 'MT', 'TIN'], specials: ['CD_DIA', 'CD_GDKT', 'CD_TIN'] },
  // Tổ hợp Hỗn hợp
  { code: 'HH1', electives: ['LY', 'HOA', 'DIA', 'TIN'], specials: ['CD_LY', 'CD_HOA', 'CD_TIN'] },
  { code: 'HH2', electives: ['HOA', 'SINH', 'DIA', 'GDKT'], specials: ['CD_HOA', 'CD_SINH', 'CD_DIA'] },
  { code: 'HH3', electives: ['LY', 'SINH', 'TIN', 'MT'], specials: ['CD_LY', 'CD_SINH', 'CD_TIN'] },
];

// Phân bổ tổ hợp cho các lớp (mỗi khối 14 lớp)
// Lớp 1-4: TN1, Lớp 5-6: TN2, Lớp 7: TN3, Lớp 8-9: XH1,
// Lớp 10: XH2, Lớp 11-12: HH1, Lớp 13: HH2, Lớp 14: HH3
const CLASS_COMBINATION_MAP = [
  'TN1', 'TN1', 'TN1', 'TN1',  // 1-4
  'TN2', 'TN2',                  // 5-6
  'TN3',                          // 7
  'XH1', 'XH1',                  // 8-9
  'XH2',                          // 10
  'HH1', 'HH1',                  // 11-12
  'HH2',                          // 13
  'HH3',                          // 14
];

// ============================================================
// 4. CLASSES DEFINITION
// ============================================================
function generateClasses() {
  const classes = [];
  for (let i = 1; i <= 14; i++) {
    classes.push({
      name: `10C${i}`,
      gradeLevel: 10,
      studentCount: 38 + Math.floor(Math.random() * 7), // 38-44
      session: 'Sáng',
      combinationCode: CLASS_COMBINATION_MAP[i - 1],
      roomName: `${200 + i}`,
    });
  }
  for (let i = 1; i <= 14; i++) {
    classes.push({
      name: `11B${i}`,
      gradeLevel: 11,
      studentCount: 36 + Math.floor(Math.random() * 9), // 36-44
      session: 'Chiều',
      combinationCode: CLASS_COMBINATION_MAP[i - 1],
      roomName: `${100 + i}`,
    });
  }
  for (let i = 1; i <= 14; i++) {
    classes.push({
      name: `12A${i}`,
      gradeLevel: 12,
      studentCount: 35 + Math.floor(Math.random() * 10), // 35-44
      session: 'Sáng',
      combinationCode: CLASS_COMBINATION_MAP[i - 1],
      roomName: `${100 + i}`,
    });
  }
  return classes;
}

// ============================================================
// 5. ROOMS DEFINITION
// ============================================================
function generateRooms() {
  const rooms = [];

  // Tầng 1: 101-115
  for (let i = 1; i <= 14; i++) {
    rooms.push({
      name: `${100 + i}`,
      type: 'CLASSROOM',
      floor: 1,
      capacity: 45,
      notes: `Phòng học chính: Sáng-12A${i}, Chiều-11B${i}`,
    });
  }
  rooms.push({ name: '115', type: 'CLASSROOM', floor: 1, capacity: 45, notes: 'Phòng trống' });

  // Tầng 2: 201-215
  for (let i = 1; i <= 14; i++) {
    rooms.push({
      name: `${200 + i}`,
      type: 'CLASSROOM',
      floor: 2,
      capacity: 45,
      notes: `Phòng học chính: 10C${i}`,
    });
  }
  rooms.push({ name: '215', type: 'CLASSROOM', floor: 2, capacity: 45, notes: 'Phòng trống' });

  // Tầng 3: Labs + Phòng tin + Phòng trống
  rooms.push({ name: '301', type: 'LAB_PHYSICS', floor: 3, capacity: 40, notes: 'Phòng thí nghiệm Vật lý' });
  rooms.push({ name: '302', type: 'LAB_CHEM', floor: 3, capacity: 40, notes: 'Phòng thí nghiệm Hóa học' });
  rooms.push({ name: '303', type: 'LAB_BIO', floor: 3, capacity: 40, notes: 'Phòng thí nghiệm Sinh học' });
  rooms.push({ name: '304', type: 'MULTI_PURPOSE', floor: 3, capacity: 40, notes: 'Phòng lab dự phòng' });
  rooms.push({ name: '305', type: 'MULTI_PURPOSE', floor: 3, capacity: 40, notes: 'Phòng lab dự phòng' });
  for (let i = 6; i <= 13; i++) {
    rooms.push({
      name: `${300 + i}`,
      type: 'CLASSROOM',
      floor: 3,
      capacity: 45,
      notes: 'Phòng học thường - không xếp lớp cố định',
    });
  }
  rooms.push({ name: '314', type: 'LAB_IT', floor: 3, capacity: 40, notes: 'Phòng máy tính 1' });
  rooms.push({ name: '315', type: 'LAB_IT', floor: 3, capacity: 40, notes: 'Phòng máy tính 2' });

  // Sân bãi cho GDTC, GDQP
  rooms.push({ name: 'SAN_BANH', type: 'YARD', floor: 0, capacity: 200, notes: 'Sân bóng đá / bóng rổ' });
  rooms.push({ name: 'SAN_TDTT', type: 'YARD', floor: 0, capacity: 200, notes: 'Sân thể dục thể thao' });

  return rooms;
}

// ============================================================
// 6. TEACHERS DEFINITION
// ============================================================
function generateTeachers() {
  const teachers = [];
  let counter = 1;
  const pad = (n) => String(n).padStart(3, '0');

  // Tên GV tiếng Việt mẫu
  const ho = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const dem = ['Văn', 'Thị', 'Hoàng', 'Minh', 'Thanh', 'Quốc', 'Xuân', 'Thu', 'Ngọc', 'Bảo'];
  const ten = ['An', 'Bình', 'Chi', 'Dung', 'Em', 'Phúc', 'Giang', 'Hà', 'Khanh', 'Lan',
               'Mai', 'Nga', 'Oanh', 'Phương', 'Quỳnh', 'Trang', 'Uyên', 'Vân', 'Yến', 'Thảo',
               'Hùng', 'Tuấn', 'Đức', 'Nam', 'Toàn', 'Hải', 'Long', 'Sơn', 'Tùng', 'Vinh'];

  const randomName = () => {
    const h = ho[Math.floor(Math.random() * ho.length)];
    const d = dem[Math.floor(Math.random() * dem.length)];
    const t = ten[Math.floor(Math.random() * ten.length)];
    return `${h} ${d} ${t}`;
  };

  // Hàm tạo nhóm GV theo tổ chuyên môn
  const addTeachers = (prefix, department, majorSubject, count, baseLoad = 17, reduction = 0) => {
    for (let i = 0; i < count; i++) {
      teachers.push({
        code: `GV${pad(counter)}`,
        fullName: randomName(),
        department,
        majorSubject,
        status: 'Đang dạy',
        baseLoad,
        reduction,
        effectiveLoad: baseLoad - reduction,
        notes: '',
      });
      counter++;
    }
  };

  // Dựa trên 42 lớp, mỗi lớp ~29 tiết/tuần buổi chính + GD thể chất/quốc phòng khác buổi
  // Tính số GV cần thiết cho mỗi tổ:

  // Toán: 42 lớp × 4t = 168t → 168/17 ≈ 10 GV
  addTeachers('TOAN', 'Tổ Toán', 'TOAN', 10);
  // 1 GV tổ trưởng giảm trừ
  teachers[teachers.length - 1].reduction = 3;
  teachers[teachers.length - 1].effectiveLoad = 14;
  teachers[teachers.length - 1].notes = 'Tổ trưởng Toán';

  // Văn: 42 × 3 = 126t → 126/17 ≈ 8 GV
  addTeachers('VAN', 'Tổ Ngữ văn', 'VAN', 8);
  teachers[teachers.length - 1].reduction = 3;
  teachers[teachers.length - 1].effectiveLoad = 14;
  teachers[teachers.length - 1].notes = 'Tổ trưởng Ngữ văn';

  // Anh: 42 × 3 = 126t → 8 GV
  addTeachers('ANH', 'Tổ Ngoại ngữ', 'ANH', 8);
  teachers[teachers.length - 1].reduction = 3;
  teachers[teachers.length - 1].effectiveLoad = 14;
  teachers[teachers.length - 1].notes = 'Tổ trưởng Ngoại ngữ';

  // Lý: Tùy tổ hợp, ước tính ~30 lớp chọn Lý × 2t = 60t → 60/17 ≈ 4 GV
  addTeachers('LY', 'Tổ Vật lý', 'LY', 5);
  teachers[teachers.length - 1].reduction = 3;
  teachers[teachers.length - 1].effectiveLoad = 14;
  teachers[teachers.length - 1].notes = 'Tổ trưởng Vật lý';

  // Hóa: ~32 lớp × 2t = 64t → 4 GV
  addTeachers('HOA', 'Tổ Hóa học', 'HOA', 5);
  teachers[teachers.length - 1].reduction = 3;
  teachers[teachers.length - 1].effectiveLoad = 14;
  teachers[teachers.length - 1].notes = 'Tổ trưởng Hóa học';

  // Sinh: ~20 lớp × 2t = 40t → 3 GV
  addTeachers('SINH', 'Tổ Sinh học', 'SINH', 3);

  // Sử: 42 × 2 = 84t → 84/17 ≈ 5 GV
  addTeachers('LS', 'Tổ Lịch sử', 'LS', 5);

  // Địa: ~14 lớp × 2t = 28t → 2 GV
  addTeachers('DIA', 'Tổ Địa lý', 'DIA', 3);

  // GDKT: ~14 lớp × 2t = 28t → 2 GV
  addTeachers('GDKT', 'Tổ GDKT&PL', 'GDKT', 2);

  // Tin: tùy tổ hợp ~28 lớp × 2t = 56t → 4 GV
  addTeachers('TIN', 'Tổ Tin học', 'TIN', 4);

  // Công nghệ: ~14 lớp × 2t = 28t → 2 GV
  addTeachers('CN', 'Tổ Công nghệ', 'CN', 3);

  // Mỹ thuật: ~6 lớp × 2t = 12t → 1 GV
  addTeachers('MT', 'Tổ Nghệ thuật', 'MT', 2);

  // GDTC: 42 × 2 = 84t → 5 GV
  addTeachers('GDTC', 'Tổ Thể chất', 'GDTC', 5);

  // GDQP: 42 × 1 = 42t → 3 GV
  addTeachers('GDQP', 'Tổ QP-AN', 'GDQP', 3);

  // HDTN + GDDP: thường do GVCN hoặc GV kiêm nhiệm → 6 GV
  addTeachers('HDTN', 'Tổ Hoạt động', 'HDTN', 6);

  // Tổng: ~82 GV
  return teachers;
}

// ============================================================
// 7. TEACHING ASSIGNMENTS
// ============================================================
function generateAssignments(classes, teachers, schoolYear) {
  const assignments = [];
  let order = 1;

  // Index GV theo môn chuyên môn
  const teachersBySubject = {};
  teachers.forEach(t => {
    if (!teachersBySubject[t.majorSubject]) teachersBySubject[t.majorSubject] = [];
    teachersBySubject[t.majorSubject].push(t);
  });

  // Bộ đếm phân công cho mỗi GV (round-robin)
  const teacherCounters = {};
  Object.keys(teachersBySubject).forEach(subj => { teacherCounters[subj] = 0; });

  const getNextTeacher = (subjectCode) => {
    // Cho HDTN, GDDP dùng GV HDTN
    let lookup = subjectCode;
    if (subjectCode === 'GDDP') lookup = 'HDTN';
    if (subjectCode === 'CHAO_CO' || subjectCode === 'SH_CUOI_TUAN') lookup = 'HDTN';

    const pool = teachersBySubject[lookup];
    if (!pool || pool.length === 0) {
      // fallback
      return teachers[0];
    }
    const idx = teacherCounters[lookup] % pool.length;
    teacherCounters[lookup]++;
    return pool[idx];
  };

  // Tìm tổ hợp
  const getCombination = (code) => COMBINATIONS.find(c => c.code === code);

  for (const cls of classes) {
    const combo = getCombination(cls.combinationCode);

    // --- Môn bắt buộc ---
    for (const [subjectCode, periods] of Object.entries(MANDATORY_PERIODS)) {
      const teacher = getNextTeacher(subjectCode);
      assignments.push({
        order: order++,
        schoolYear,
        gradeLevel: cls.gradeLevel,
        className: cls.name,
        combinationCode: cls.combinationCode,
        subjectCode,
        subjectName: SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode,
        programGroup: periods.type,
        periodsHk1: periods.hk1,
        periodsHk2: periods.hk2,
        teacherHk1Code: teacher.code,
        teacherHk1Name: teacher.fullName,
        teacherHk2Code: teacher.code,
        teacherHk2Name: teacher.fullName,
        notes: periods.notes || '',
      });
    }

    // --- Môn lựa chọn (4 môn theo tổ hợp) ---
    if (combo) {
      for (const electiveCode of combo.electives) {
        const elective = ELECTIVE_PERIODS[electiveCode];
        if (!elective) continue;

        const teacher = getNextTeacher(electiveCode);

        // Tiết lý thuyết
        if (elective.hk1_lt > 0 || elective.hk2_lt > 0) {
          assignments.push({
            order: order++,
            schoolYear,
            gradeLevel: cls.gradeLevel,
            className: cls.name,
            combinationCode: cls.combinationCode,
            subjectCode: electiveCode,
            subjectName: SUBJECTS.find(s => s.code === electiveCode)?.name || electiveCode,
            programGroup: 'Lựa chọn',
            periodsHk1: elective.hk1_lt,
            periodsHk2: elective.hk2_lt,
            teacherHk1Code: teacher.code,
            teacherHk1Name: teacher.fullName,
            teacherHk2Code: teacher.code,
            teacherHk2Name: teacher.fullName,
            notes: elective.hasLab ? 'Lý thuyết' : '',
          });
        }

        // Tiết thực hành (nếu có)
        if (elective.hasLab && (elective.hk1_th > 0 || elective.hk2_th > 0)) {
          // Thực hành dùng cùng GV
          assignments.push({
            order: order++,
            schoolYear,
            gradeLevel: cls.gradeLevel,
            className: cls.name,
            combinationCode: cls.combinationCode,
            subjectCode: electiveCode,
            subjectName: `${SUBJECTS.find(s => s.code === electiveCode)?.name || electiveCode} (TH)`,
            programGroup: 'Lựa chọn - Thực hành',
            periodsHk1: elective.hk1_th,
            periodsHk2: elective.hk2_th,
            teacherHk1Code: teacher.code,
            teacherHk1Name: teacher.fullName,
            teacherHk2Code: teacher.code,
            teacherHk2Name: teacher.fullName,
            notes: `Thực hành - Phòng lab`,
          });
        }
      }

      // --- Chuyên đề học tập (3 cụm × 1t/tuần) ---
      for (const specialCode of combo.specials) {
        // CD_LY → base code: LY
        const baseCode = specialCode.replace('CD_', '');
        const teacher = getNextTeacher(baseCode);

        assignments.push({
          order: order++,
          schoolYear,
          gradeLevel: cls.gradeLevel,
          className: cls.name,
          combinationCode: cls.combinationCode,
          subjectCode: specialCode,
          subjectName: `Chuyên đề ${SUBJECTS.find(s => s.code === baseCode)?.name || baseCode}`,
          programGroup: 'Chuyên đề học tập',
          periodsHk1: 1,
          periodsHk2: 1,
          teacherHk1Code: teacher.code,
          teacherHk1Name: teacher.fullName,
          teacherHk2Code: teacher.code,
          teacherHk2Name: teacher.fullName,
          notes: '',
        });
      }
    }
  }

  return assignments;
}

// ============================================================
// 8. STYLING HELPERS
// ============================================================
const COLORS = {
  headerBg: '1F4E79',
  headerFont: 'FFFFFF',
  titleBg: '2E75B6',
  titleFont: 'FFFFFF',
  altRowBg: 'F2F7FB',
  borderColor: 'B4C6E7',
  labBg: 'FFF2CC',
  yardBg: 'E2EFDA',
};

function applyTitleRow(worksheet, rowNum, text, colCount) {
  worksheet.mergeCells(rowNum, 1, rowNum, colCount);
  const row = worksheet.getRow(rowNum);
  row.getCell(1).value = text;
  row.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.titleFont } };
  row.getCell(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: COLORS.titleBg },
  };
  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 30;
}

function applyHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.headerFont } };
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: COLORS.headerBg },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: COLORS.borderColor } },
    };
  });
  row.height = 24;
}

function applyBodyRow(row, isAlt = false) {
  row.eachCell((cell) => {
    cell.font = { size: 11 };
    if (isAlt) {
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: COLORS.altRowBg },
      };
    }
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    };
    cell.alignment = { vertical: 'middle' };
  });
}

/**
 * Helper: Set up a sheet with title row 1 + header row 2.
 * ExcelJS worksheet.columns writes headers to row 1, which gets
 * overwritten by applyTitleRow. This function explicitly writes
 * header values to row 2 so the import scanner can find them.
 */
function setupSheet(worksheet, columnDefs, title) {
  // Set column keys and widths (header goes to row 1 internally)
  worksheet.columns = columnDefs.map(c => ({ key: c.key, width: c.width }));

  // Write title to row 1 (merged)
  applyTitleRow(worksheet, 1, title, columnDefs.length);

  // Explicitly write header values to row 2
  const headerRow = worksheet.getRow(2);
  columnDefs.forEach((col, idx) => {
    headerRow.getCell(idx + 1).value = col.header;
  });
  applyHeaderRow(headerRow);
}

// ============================================================
// 9. BUILD WORKBOOK
// ============================================================
async function buildWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity - NCKH TKB';
  workbook.created = new Date();

  const schoolYear = '2025-2026';
  const classes = generateClasses();
  const rooms = generateRooms();
  const teachers = generateTeachers();
  const assignments = generateAssignments(classes, teachers, schoolYear);

  // ---- Sheet 1: Hướng dẫn ----
  const guideSheet = workbook.addWorksheet('Huong_dan', { views: [{ state: 'frozen', ySplit: 2 }] });
  guideSheet.columns = [
    { header: 'Mục', key: 'section', width: 28 },
    { header: 'Nội dung', key: 'content', width: 100 },
  ];
  applyTitleRow(guideSheet, 1, 'Hướng dẫn sử dụng workbook phân công giảng dạy GDPT 2018', 2);
  applyHeaderRow(guideSheet.getRow(2));
  const guideRows = [
    ['Mục đích', 'Dùng file này để nhập dữ liệu giáo viên, lớp, tổ hợp và phân công giảng dạy theo năm học.'],
    ['Phạm vi import', 'Hệ thống chỉ đọc 4 sheet: DM_Giao_vien, DM_Lop, DM_To_hop, Phan_cong.'],
    ['Năm học', `Dữ liệu trong file này thuộc năm học ${schoolYear}.`],
    ['Tiết HK1/HK2', 'Nhập số tiết mỗi tuần (không phải tổng cả kỳ) của HK1 và HK2 cho từng dòng phân công.'],
    ['Mã giáo viên', 'Mã giáo viên phải duy nhất. Nếu đã tồn tại, hệ thống sẽ cập nhật theo file mới.'],
    ['42 lớp', 'Khối 10: 10C1-10C14 (Sáng), Khối 11: 11B1-11B14 (Chiều), Khối 12: 12A1-12A14 (Sáng).'],
    ['Phòng học', 'Tầng 1: 12A chiếm 101-114 sáng, 11B chiếm 101-114 chiều. Tầng 2: 10C chiếm 201-214. Tầng 3: Lab & Tin.'],
    ['Thực hành', 'Lý, Hóa, Sinh có tiết TH tại phòng lab tầng 3. Tin học TH tại phòng 314/315.'],
    ['GDTC / GDQP', 'Giáo dục thể chất và Quốc phòng - An ninh học khác buổi, tại sân bãi.'],
    ['Công nghệ', 'Chọn 1 trong 2: "Thiết kế và công nghệ" hoặc "Công nghệ trồng trọt". File này dùng mã chung CN.'],
    ['Cảnh báo', 'Nếu file có lỗi validation, hệ thống sẽ rollback toàn bộ và không ghi một phần dữ liệu.'],
  ];
  guideRows.forEach((r, i) => { const row = guideSheet.addRow(r); applyBodyRow(row, i % 2 === 1); });

  // ---- Sheet 2: Nguồn tham khảo ----
  const refSheet = workbook.addWorksheet('Nguon_tham_khao', { views: [{ state: 'frozen', ySplit: 2 }] });
  refSheet.columns = [
    { header: 'Văn bản', key: 'document', width: 36 },
    { header: 'Nội dung', key: 'content', width: 100 },
  ];
  applyTitleRow(refSheet, 1, 'Nguồn tham khảo và căn cứ pháp lý', 2);
  applyHeaderRow(refSheet.getRow(2));
  const refRows = [
    ['Thông tư 32/2018/TT-BGDĐT', 'Chương trình giáo dục phổ thông 2018 - Quy định khung chương trình tổng thể'],
    ['Thông tư 13/2022/TT-BGDĐT', 'Điều chỉnh chương trình GDPT, trong đó Lịch sử là nội dung bắt buộc ở THPT (2t/tuần)'],
    ['Công văn 5512/BGDĐT-GDTrH', 'Hướng dẫn xây dựng và tổ chức thực hiện kế hoạch giáo dục của nhà trường'],
    ['Thông tư 05/2025/TT-BGDĐT', 'Chế độ làm việc đối với giáo viên phổ thông: định mức 17 tiết/tuần'],
    ['GDPT 2018 - Khung tiết', 'Toán 105t, Văn 105t, Anh 105t, Lý/Hóa/Sinh/Tin/... 70t, GDTC 70t, GDQP 35t, HDTN 105t, GDDP 35t mỗi năm'],
  ];
  refRows.forEach((r, i) => { const row = refSheet.addRow(r); applyBodyRow(row, i % 2 === 1); });

  // ---- Sheet 3: DM_Mon_GDPT2018 ----
  const subjectSheet = workbook.addWorksheet('DM_Mon_GDPT2018', { views: [{ state: 'frozen', ySplit: 2 }] });
  subjectSheet.columns = [
    { header: 'Mã_môn', key: 'code', width: 18 },
    { header: 'Tên_môn', key: 'name', width: 42 },
    { header: 'Nhóm_CT', key: 'group', width: 24 },
    { header: 'Số_tiết/năm', key: 'periodsPerYear', width: 14 },
    { header: 'Số_tiết/tuần', key: 'periodsPerWeek', width: 14 },
    { header: 'Ghi_chú', key: 'note', width: 50 },
  ];
  applyTitleRow(subjectSheet, 1, 'Danh mục môn học chuẩn GDPT 2018 - Cấp THPT', 6);
  applyHeaderRow(subjectSheet.getRow(2));

  const subjectData = [
    { code: 'TOAN', name: 'Toán', group: 'Bắt buộc', perYear: 140, perWeek: 4, note: 'Tất cả HS' },
    { code: 'VAN', name: 'Ngữ văn', group: 'Bắt buộc', perYear: 105, perWeek: 3, note: 'Tất cả HS' },
    { code: 'ANH', name: 'Tiếng Anh', group: 'Bắt buộc', perYear: 105, perWeek: 3, note: 'Ngoại ngữ 1' },
    { code: 'LS', name: 'Lịch sử', group: 'Bắt buộc', perYear: 70, perWeek: 2, note: 'Bắt buộc từ TT13/2022' },
    { code: 'GDTC', name: 'Giáo dục thể chất', group: 'Bắt buộc', perYear: 70, perWeek: 2, note: 'Học sân bãi, khác buổi' },
    { code: 'GDQP', name: 'GD Quốc phòng và An ninh', group: 'Bắt buộc', perYear: 35, perWeek: 1, note: 'Học sân bãi, khác buổi' },
    { code: 'HDTN', name: 'HĐ Trải nghiệm - Hướng nghiệp', group: 'Bắt buộc', perYear: 105, perWeek: 3, note: '' },
    { code: 'GDDP', name: 'Giáo dục địa phương', group: 'Bắt buộc', perYear: 35, perWeek: 1, note: '' },
    { code: 'LY', name: 'Vật lý', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '1LT + 1TH (phòng lab)' },
    { code: 'HOA', name: 'Hóa học', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '1LT + 1TH (phòng lab)' },
    { code: 'SINH', name: 'Sinh học', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '1LT + 1TH (phòng lab)' },
    { code: 'DIA', name: 'Địa lý', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '' },
    { code: 'GDKT', name: 'GD Kinh tế và Pháp luật', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '' },
    { code: 'CN', name: 'Công nghệ', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: 'Thiết kế & CN / CN trồng trọt' },
    { code: 'TIN', name: 'Tin học', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '1LT + 1TH (phòng máy tính)' },
    { code: 'MT', name: 'Mỹ thuật', group: 'Lựa chọn', perYear: 70, perWeek: 2, note: '' },
    { code: 'CHAO_CO', name: 'Chào cờ', group: 'Hoạt động tập thể', perYear: 35, perWeek: 1, note: 'Đầu tuần' },
    { code: 'SH_CUOI_TUAN', name: 'Sinh hoạt cuối tuần', group: 'Hoạt động tập thể', perYear: 35, perWeek: 1, note: 'Cuối tuần' },
  ];
  subjectData.forEach((s, i) => {
    const row = subjectSheet.addRow({
      code: s.code, name: s.name, group: s.group,
      periodsPerYear: s.perYear, periodsPerWeek: s.perWeek,
      note: s.note,
    });
    applyBodyRow(row, i % 2 === 1);
  });

  // ---- Sheet 4: DM_Giao_vien ----
  const teacherSheet = workbook.addWorksheet('DM_Giao_vien', { views: [{ state: 'frozen', ySplit: 2 }] });
  setupSheet(teacherSheet, [
    { header: 'Mã GV', key: 'code', width: 12 },
    { header: 'Họ tên', key: 'fullName', width: 28 },
    { header: 'Tổ CM', key: 'department', width: 20 },
    { header: 'Môn chuyên môn chính', key: 'majorSubject', width: 22 },
    { header: 'Trạng thái', key: 'status', width: 14 },
    { header: 'Định mức tuần', key: 'baseLoad', width: 14 },
    { header: 'Giảm trừ tuần', key: 'reduction', width: 14 },
    { header: 'Định mức hiệu lực', key: 'effectiveLoad', width: 16 },
    { header: 'Ghi chú', key: 'notes', width: 30 },
  ], `Danh mục giáo viên - Năm học ${schoolYear}`);
  teachers.forEach((t, i) => {
    const row = teacherSheet.addRow(t);
    applyBodyRow(row, i % 2 === 1);
  });

  // ---- Sheet 5: DM_Lop ----
  const classSheet = workbook.addWorksheet('DM_Lop', { views: [{ state: 'frozen', ySplit: 2 }] });
  setupSheet(classSheet, [
    { header: 'Lớp', key: 'name', width: 12 },
    { header: 'Khối', key: 'gradeLevel', width: 8 },
    { header: 'Sĩ số', key: 'studentCount', width: 10 },
    { header: 'Buổi học', key: 'session', width: 12 },
    { header: 'Mã tổ hợp', key: 'combinationCode', width: 14 },
    { header: 'Phòng chính', key: 'roomName', width: 14 },
    { header: 'GVCN Mã', key: 'homeroomCode', width: 12 },
    { header: 'GVCN Họ tên', key: 'homeroomName', width: 28 },
    { header: 'Ghi chú', key: 'notes', width: 36 },
  ], `Danh mục lớp - Năm học ${schoolYear}`);

  // Phân GVCN cho lớp (lấy từ pool GV, mỗi GV CN 1 lớp)
  let gvcnIndex = 0;
  classes.forEach((cls, i) => {
    const gvcn = teachers[gvcnIndex % teachers.length];
    gvcnIndex++;
    const notes =
      cls.gradeLevel === 10 ? `Tầng 2 - Phòng ${cls.roomName}` :
      cls.gradeLevel === 11 ? `Tầng 1 - Phòng ${cls.roomName} (buổi chiều)` :
      `Tầng 1 - Phòng ${cls.roomName} (buổi sáng)`;

    const row = classSheet.addRow({
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      studentCount: cls.studentCount,
      session: cls.session,
      combinationCode: cls.combinationCode,
      roomName: cls.roomName,
      homeroomCode: gvcn.code,
      homeroomName: gvcn.fullName,
      notes,
    });
    applyBodyRow(row, i % 2 === 1);
  });

  // ---- Sheet 6: DM_To_hop ----
  const comboSheet = workbook.addWorksheet('DM_To_hop', { views: [{ state: 'frozen', ySplit: 2 }] });
  setupSheet(comboSheet, [
    { header: 'Mã tổ hợp', key: 'code', width: 14 },
    { header: 'Khối', key: 'gradeLevel', width: 8 },
    { header: 'Môn tự chọn 1', key: 'elective1', width: 16 },
    { header: 'Môn tự chọn 2', key: 'elective2', width: 16 },
    { header: 'Môn tự chọn 3', key: 'elective3', width: 16 },
    { header: 'Môn tự chọn 4', key: 'elective4', width: 16 },
    { header: 'Chuyên đề 1', key: 'special1', width: 16 },
    { header: 'Chuyên đề 2', key: 'special2', width: 16 },
    { header: 'Chuyên đề 3', key: 'special3', width: 16 },
    { header: 'Ghi chú', key: 'notes', width: 30 },
  ], 'Danh mục tổ hợp môn học - Áp dụng cả 3 khối');

  // Mỗi tổ hợp dùng cho 3 khối
  let comboIdx = 0;
  for (const grade of [10, 11, 12]) {
    COMBINATIONS.forEach((combo, i) => {
      const comboNote =
        combo.code.startsWith('TN') ? 'Tự nhiên' :
        combo.code.startsWith('XH') ? 'Xã hội' : 'Hỗn hợp';
      const row = comboSheet.addRow({
        code: combo.code,
        gradeLevel: grade,
        elective1: combo.electives[0],
        elective2: combo.electives[1],
        elective3: combo.electives[2],
        elective4: combo.electives[3],
        special1: combo.specials[0],
        special2: combo.specials[1],
        special3: combo.specials[2],
        notes: comboNote,
      });
      applyBodyRow(row, comboIdx % 2 === 1);
      comboIdx++;
    });
  }

  // ---- Sheet 7: Phan_cong ----
  const assignSheet = workbook.addWorksheet('Phan_cong', { views: [{ state: 'frozen', ySplit: 2, xSplit: 4 }] });
  setupSheet(assignSheet, [
    { header: 'STT', key: 'order', width: 8 },
    { header: 'Năm học', key: 'schoolYear', width: 14 },
    { header: 'Khối', key: 'gradeLevel', width: 8 },
    { header: 'Lớp', key: 'className', width: 12 },
    { header: 'Mã tổ hợp', key: 'combinationCode', width: 14 },
    { header: 'Mã môn', key: 'subjectCode', width: 16 },
    { header: 'Tên môn', key: 'subjectName', width: 36 },
    { header: 'Nhóm CT', key: 'programGroup', width: 22 },
    { header: 'Tiết HK1', key: 'periodsHk1', width: 10 },
    { header: 'Tiết HK2', key: 'periodsHk2', width: 10 },
    { header: 'GV HK1 Mã', key: 'teacherHk1Code', width: 12 },
    { header: 'GV HK1 Họ tên', key: 'teacherHk1Name', width: 26 },
    { header: 'GV HK2 Mã', key: 'teacherHk2Code', width: 12 },
    { header: 'GV HK2 Họ tên', key: 'teacherHk2Name', width: 26 },
    { header: 'Ghi chú', key: 'notes', width: 30 },
  ], `Bảng phân công giảng dạy - Năm học ${schoolYear}`);
  assignments.forEach((a, i) => {
    const row = assignSheet.addRow(a);
    applyBodyRow(row, i % 2 === 1);
  });

  // ---- Sheet 8: DM_Phong (Sheet bổ sung - Phòng học) ----
  const roomSheet = workbook.addWorksheet('DM_Phong', { views: [{ state: 'frozen', ySplit: 2 }] });
  setupSheet(roomSheet, [
    { header: 'Tên phòng', key: 'name', width: 14 },
    { header: 'Loại', key: 'type', width: 18 },
    { header: 'Tầng', key: 'floor', width: 8 },
    { header: 'Sức chứa', key: 'capacity', width: 12 },
    { header: 'Ghi chú', key: 'notes', width: 50 },
  ], 'Danh mục phòng học - 3 tầng × 15 phòng + Sân bãi');

  const roomTypeLabels = {
    CLASSROOM: 'Phòng học',
    LAB_PHYSICS: 'Lab Vật lý',
    LAB_CHEM: 'Lab Hóa học',
    LAB_BIO: 'Lab Sinh học',
    LAB_IT: 'Phòng Tin học',
    YARD: 'Sân bãi',
    MULTI_PURPOSE: 'Đa năng',
  };
  rooms.forEach((r, i) => {
    const row = roomSheet.addRow({
      name: r.name,
      type: roomTypeLabels[r.type] || r.type,
      floor: r.floor,
      capacity: r.capacity,
      notes: r.notes,
    });
    applyBodyRow(row, i % 2 === 1);

    // Tô màu cho phòng lab
    if (r.type.startsWith('LAB')) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labBg } };
      });
    }
    if (r.type === 'YARD') {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.yardBg } };
      });
    }
  });

  // ---- Sheet 9: Thống kê tổng hợp ----
  const summarySheet = workbook.addWorksheet('Tong_hop_GV', { views: [{ state: 'frozen', ySplit: 2 }] });
  summarySheet.columns = [
    { header: 'Mã_GV', key: 'code', width: 12 },
    { header: 'Họ_tên', key: 'fullName', width: 28 },
    { header: 'Tổ_CM', key: 'department', width: 20 },
    { header: 'Định_mức_tuần', key: 'baseLoad', width: 14 },
    { header: 'Giảm_trừ_tuần', key: 'reduction', width: 14 },
    { header: 'Định_mức_hiệu_lực', key: 'effectiveLoad', width: 16 },
    { header: 'Tổng_tiết_HK1', key: 'totalHk1', width: 14 },
    { header: 'Tổng_tiết_HK2', key: 'totalHk2', width: 14 },
    { header: 'Chênh_HK1', key: 'deltaHk1', width: 12 },
    { header: 'Chênh_HK2', key: 'deltaHk2', width: 12 },
    { header: 'Số_lớp_HK1', key: 'classesHk1', width: 12 },
    { header: 'Ghi_chú', key: 'notes', width: 30 },
  ];
  applyTitleRow(summarySheet, 1, `Tổng hợp tải giảng dạy theo giáo viên - ${schoolYear}`, 12);
  applyHeaderRow(summarySheet.getRow(2));

  // Tính tổng tiết cho mỗi GV
  const teacherLoad = {};
  teachers.forEach(t => {
    teacherLoad[t.code] = { hk1: 0, hk2: 0, classesHk1: 0 };
  });
  assignments.forEach(a => {
    if (a.teacherHk1Code && teacherLoad[a.teacherHk1Code]) {
      teacherLoad[a.teacherHk1Code].hk1 += a.periodsHk1;
      teacherLoad[a.teacherHk1Code].classesHk1++;
    }
    if (a.teacherHk2Code && teacherLoad[a.teacherHk2Code]) {
      teacherLoad[a.teacherHk2Code].hk2 += a.periodsHk2;
    }
  });

  teachers.forEach((t, i) => {
    const load = teacherLoad[t.code] || { hk1: 0, hk2: 0, classesHk1: 0 };
    const row = summarySheet.addRow({
      code: t.code,
      fullName: t.fullName,
      department: t.department,
      baseLoad: t.baseLoad,
      reduction: t.reduction,
      effectiveLoad: t.effectiveLoad,
      totalHk1: load.hk1,
      totalHk2: load.hk2,
      deltaHk1: load.hk1 - t.effectiveLoad,
      deltaHk2: load.hk2 - t.effectiveLoad,
      classesHk1: load.classesHk1,
      notes: t.notes,
    });
    applyBodyRow(row, i % 2 === 1);

    // Tô đỏ nếu vượt tải
    if (load.hk1 > t.effectiveLoad + 4) {
      row.getCell('deltaHk1').font = { color: { argb: 'FF0000' }, bold: true, size: 11 };
    }
    if (load.hk2 > t.effectiveLoad + 4) {
      row.getCell('deltaHk2').font = { color: { argb: 'FF0000' }, bold: true, size: 11 };
    }
  });

  // ---- EXPORT ----
  const outputPath = path.join(__dirname, `phan-cong-gdpt2018-${schoolYear}.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`\n✅ Đã tạo file Excel thành công!`);
  console.log(`   📁 ${outputPath}`);
  console.log(`\n📊 Thống kê:`);
  console.log(`   - Giáo viên: ${teachers.length}`);
  console.log(`   - Lớp:       ${classes.length} (K10: 14, K11: 14, K12: 14)`);
  console.log(`   - Phòng:     ${rooms.length} (3 tầng + sân bãi)`);
  console.log(`   - Tổ hợp:    ${COMBINATIONS.length} × 3 khối = ${COMBINATIONS.length * 3}`);
  console.log(`   - Phân công: ${assignments.length} dòng`);
  console.log(`\n📋 Các sheet:`);
  console.log(`   1. Huong_dan          - Hướng dẫn sử dụng`);
  console.log(`   2. Nguon_tham_khao    - Căn cứ pháp lý GDPT 2018`);
  console.log(`   3. DM_Mon_GDPT2018    - Danh mục 18 môn học`);
  console.log(`   4. DM_Giao_vien       - ${teachers.length} giáo viên`);
  console.log(`   5. DM_Lop             - ${classes.length} lớp (3 khối)`);
  console.log(`   6. DM_To_hop          - ${COMBINATIONS.length * 3} tổ hợp môn`);
  console.log(`   7. Phan_cong          - ${assignments.length} dòng phân công`);
  console.log(`   8. DM_Phong           - ${rooms.length} phòng`);
  console.log(`   9. Tong_hop_GV        - Thống kê tải GV`);
}

buildWorkbook().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
