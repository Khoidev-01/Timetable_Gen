const ExcelJS = require('exceljs');
const path = require('path');

// ===== TEACHERS (50 GV) =====
const teachers = [
  // Tổ Toán (8)
  { code:'GV001', name:'Nguyễn Văn An',     dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV002', name:'Trần Thị Bích',     dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV003', name:'Lê Văn Cường',      dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV004', name:'Phạm Thị Dung',     dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV005', name:'Hoàng Văn Đức',     dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV006', name:'Ngô Thị Hoa',       dept:'Toán',  major:'TOAN', base:17, red:0 },
  { code:'GV007', name:'Vũ Văn Hùng',       dept:'Toán',  major:'TOAN', base:17, red:2, note:'Tổ trưởng' },
  { code:'GV008', name:'Đỗ Thị Lan',        dept:'Toán',  major:'TOAN', base:17, red:0 },
  // Tổ Ngữ văn (6)
  { code:'GV009', name:'Nguyễn Thị Mai',     dept:'Ngữ văn', major:'VAN', base:17, red:0 },
  { code:'GV010', name:'Trần Văn Nam',       dept:'Ngữ văn', major:'VAN', base:17, red:0 },
  { code:'GV011', name:'Lê Thị Oanh',        dept:'Ngữ văn', major:'VAN', base:17, red:2, note:'Tổ trưởng' },
  { code:'GV012', name:'Phạm Văn Phúc',      dept:'Ngữ văn', major:'VAN', base:17, red:0 },
  { code:'GV013', name:'Hoàng Thị Quỳnh',    dept:'Ngữ văn', major:'VAN', base:17, red:0 },
  { code:'GV014', name:'Ngô Văn Sơn',        dept:'Ngữ văn', major:'VAN', base:17, red:0 },
  // Tổ Tiếng Anh (6)
  { code:'GV015', name:'Vũ Thị Tâm',         dept:'Ngoại ngữ', major:'ANH', base:17, red:0 },
  { code:'GV016', name:'Đỗ Văn Thắng',       dept:'Ngoại ngữ', major:'ANH', base:17, red:0 },
  { code:'GV017', name:'Nguyễn Thị Uyên',    dept:'Ngoại ngữ', major:'ANH', base:17, red:0 },
  { code:'GV018', name:'Trần Văn Vinh',      dept:'Ngoại ngữ', major:'ANH', base:17, red:0 },
  { code:'GV019', name:'Lê Thị Xuân',        dept:'Ngoại ngữ', major:'ANH', base:17, red:2, note:'Tổ trưởng' },
  { code:'GV020', name:'Phạm Văn Yên',       dept:'Ngoại ngữ', major:'ANH', base:17, red:0 },
  // Tổ Vật lý (4)
  { code:'GV021', name:'Hoàng Văn Bảo',      dept:'Vật lý', major:'LY', base:17, red:0 },
  { code:'GV022', name:'Ngô Thị Châm',       dept:'Vật lý', major:'LY', base:17, red:0 },
  { code:'GV023', name:'Vũ Văn Dũng',        dept:'Vật lý', major:'LY', base:17, red:2, note:'Tổ trưởng' },
  { code:'GV024', name:'Đặng Thị Hằng',      dept:'Vật lý', major:'LY', base:17, red:0 },
  // Tổ Hóa học (3)
  { code:'GV025', name:'Đỗ Thị Giang',       dept:'Hóa học', major:'HOA', base:17, red:0 },
  { code:'GV026', name:'Nguyễn Văn Hải',     dept:'Hóa học', major:'HOA', base:17, red:2, note:'Tổ trưởng' },
  { code:'GV027', name:'Trần Thị Kim',       dept:'Hóa học', major:'HOA', base:17, red:0 },
  // Tổ Sinh học (2)
  { code:'GV028', name:'Lê Văn Long',        dept:'Sinh học', major:'SINH', base:17, red:0 },
  { code:'GV029', name:'Phạm Thị Minh',      dept:'Sinh học', major:'SINH', base:17, red:2, note:'Tổ trưởng' },
  // Tổ Lịch sử (3)
  { code:'GV030', name:'Hoàng Văn Nghĩa',    dept:'Lịch sử', major:'LS', base:17, red:0 },
  { code:'GV031', name:'Ngô Thị Phương',     dept:'Lịch sử', major:'LS', base:17, red:0 },
  { code:'GV032', name:'Vũ Văn Quang',       dept:'Lịch sử', major:'LS', base:17, red:2, note:'Tổ trưởng' },
  // Tổ Địa lý (3)
  { code:'GV033', name:'Đỗ Thị Thanh',       dept:'Địa lý', major:'DIA', base:17, red:0 },
  { code:'GV034', name:'Nguyễn Văn Toàn',    dept:'Địa lý', major:'DIA', base:17, red:0 },
  { code:'GV035', name:'Trần Thị Vân',       dept:'Địa lý', major:'DIA', base:17, red:2, note:'Tổ trưởng' },
  // Tổ Tin học (3)
  { code:'GV036', name:'Lê Văn Tuấn',        dept:'Tin học', major:'TIN', base:17, red:0 },
  { code:'GV037', name:'Phạm Thị Hiền',      dept:'Tin học', major:'TIN', base:17, red:0 },
  { code:'GV038', name:'Hoàng Văn Tú',       dept:'Tin học', major:'TIN', base:17, red:2, note:'Tổ trưởng' },
  // Tổ GDTC (4)
  { code:'GV039', name:'Ngô Văn Thành',      dept:'GDTC', major:'GDTC', base:17, red:0 },
  { code:'GV040', name:'Vũ Thị Ngọc',        dept:'GDTC', major:'GDTC', base:17, red:0 },
  { code:'GV041', name:'Đỗ Văn Khoa',        dept:'GDTC', major:'GDTC', base:17, red:0 },
  { code:'GV042', name:'Nguyễn Thị Linh',    dept:'GDTC', major:'GDTC', base:17, red:2, note:'Tổ trưởng' },
  // Tổ GDQP (2)
  { code:'GV043', name:'Trần Văn Mạnh',      dept:'GDQP', major:'GDQP', base:17, red:0 },
  { code:'GV044', name:'Lê Văn Trung',       dept:'GDQP', major:'GDQP', base:17, red:0 },
  // Tổ GDKT&PL (2)
  { code:'GV045', name:'Phạm Thị Nhung',     dept:'GDKT&PL', major:'GDKT', base:17, red:0 },
  { code:'GV046', name:'Hoàng Văn Đạt',      dept:'GDKT&PL', major:'GDKT', base:17, red:0 },
  // Tổ Công nghệ (2)
  { code:'GV047', name:'Ngô Thị Thảo',       dept:'Công nghệ', major:'CN', base:17, red:0 },
  { code:'GV048', name:'Vũ Văn Kiên',        dept:'Công nghệ', major:'CN', base:17, red:0 },
  // Phó hiệu trưởng (dạy ít)
  { code:'GV049', name:'Đỗ Văn Hưng',        dept:'Toán', major:'TOAN', base:17, red:13, note:'Phó HT' },
  { code:'GV050', name:'Nguyễn Thị Hạnh',    dept:'Ngữ văn', major:'VAN', base:17, red:13, note:'Phó HT' },
];

// ===== CLASSES =====
const classes = [];
for (let i = 1; i <= 10; i++) classes.push({ name:`10C${i}`, grade:10, students: 40 + Math.floor(Math.random()*6) });
for (let i = 1; i <= 9; i++)  classes.push({ name:`11B${i}`, grade:11, students: 38 + Math.floor(Math.random()*7) });
for (let i = 1; i <= 11; i++) classes.push({ name:`12A${i}`, grade:12, students: 36 + Math.floor(Math.random()*9) });

// ===== COMBINATIONS =====
const combinations = [
  // Khối 10: chọn 4 từ 8 môn lựa chọn
  { code:'TH10A', grade:10, e:['LY','HOA','SINH','TIN'],  s:['CD_LY','CD_HOA','CD_SINH'] },
  { code:'TH10B', grade:10, e:['LY','HOA','SINH','CN'],   s:['CD_LY','CD_HOA','CD_SINH'] },
  { code:'TH10C', grade:10, e:['LS','DIA','GDKT','TIN'],  s:['CD_LS','CD_DIA','CD_GDKT'] },
  { code:'TH10D', grade:10, e:['LY','HOA','LS','DIA'],    s:['CD_LY','CD_HOA','CD_LS'] },
  // Khối 11: LS bắt buộc (TT13/2022), chọn 4 từ 7 còn lại
  { code:'TH11A', grade:11, e:['LY','HOA','SINH','TIN'],  s:['CD_LY','CD_HOA','CD_SINH'] },
  { code:'TH11B', grade:11, e:['LY','HOA','DIA','TIN'],   s:['CD_LY','CD_HOA','CD_DIA'] },
  { code:'TH11C', grade:11, e:['DIA','GDKT','CN','TIN'],  s:['CD_DIA','CD_GDKT','CD_CN'] },
  { code:'TH11D', grade:11, e:['LY','SINH','DIA','GDKT'], s:['CD_LY','CD_SINH','CD_DIA'] },
  // Khối 12: tương tự khối 11
  { code:'TH12A', grade:12, e:['LY','HOA','SINH','TIN'],  s:['CD_LY','CD_HOA','CD_SINH'] },
  { code:'TH12B', grade:12, e:['LY','HOA','DIA','TIN'],   s:['CD_LY','CD_HOA','CD_DIA'] },
  { code:'TH12C', grade:12, e:['DIA','GDKT','CN','TIN'],  s:['CD_DIA','CD_GDKT','CD_CN'] },
  { code:'TH12D', grade:12, e:['LY','SINH','DIA','GDKT'], s:['CD_LY','CD_SINH','CD_DIA'] },
];

// Assign combinations to classes
const comboAssign = {
  '10C1':'TH10A','10C2':'TH10A','10C3':'TH10A',
  '10C4':'TH10B','10C5':'TH10B','10C6':'TH10B',
  '10C7':'TH10C','10C8':'TH10C',
  '10C9':'TH10D','10C10':'TH10D',
  '11B1':'TH11A','11B2':'TH11A','11B3':'TH11A',
  '11B4':'TH11B','11B5':'TH11B','11B6':'TH11B',
  '11B7':'TH11C','11B8':'TH11C',
  '11B9':'TH11D',
  '12A1':'TH12A','12A2':'TH12A','12A3':'TH12A',
  '12A4':'TH12B','12A5':'TH12B','12A6':'TH12B',
  '12A7':'TH12C','12A8':'TH12C','12A9':'TH12C',
  '12A10':'TH12D','12A11':'TH12D',
};

// Homeroom teacher assignment (30 classes -> 30 teachers)
const homeroomMap = {};
const homeroomTeachers = [
  'GV001','GV002','GV003','GV004','GV005','GV006','GV008','GV009','GV010',
  'GV012','GV013','GV014','GV015','GV016','GV017','GV018','GV020',
  'GV021','GV022','GV024','GV025','GV027','GV028','GV030','GV031',
  'GV033','GV034','GV036','GV037','GV039',
];
classes.forEach((c, i) => { homeroomMap[c.name] = homeroomTeachers[i]; });

// ===== SUBJECT CATALOG =====
const SUBJECTS = {
  TOAN: 'Toán', VAN: 'Ngữ văn', ANH: 'Tiếng Anh',
  LS: 'Lịch sử', GDTC: 'Giáo dục thể chất', GDQP: 'Giáo dục quốc phòng và an ninh',
  HDTN: 'Hoạt động trải nghiệm hướng nghiệp', GDDP: 'Giáo dục địa phương',
  LY: 'Vật lý', HOA: 'Hóa học', SINH: 'Sinh học',
  DIA: 'Địa lý', GDKT: 'Giáo dục kinh tế và pháp luật',
  CN: 'Công nghệ', TIN: 'Tin học',
  CHAO_CO: 'Chào cờ', SH_CUOI_TUAN: 'Sinh hoạt cuối tuần',
};

// ===== CURRICULUM: Số tiết/tuần theo môn và khối =====
// Bắt buộc cho tất cả các khối
const mandatoryAll = [
  { code:'TOAN', hk1:4, hk2:4, group:'Bắt buộc' },
  { code:'VAN',  hk1:3, hk2:3, group:'Bắt buộc' },
  { code:'ANH',  hk1:3, hk2:3, group:'Bắt buộc' },
  { code:'GDTC', hk1:2, hk2:2, group:'Bắt buộc' },
  { code:'GDQP', hk1:1, hk2:1, group:'Bắt buộc' },
  { code:'HDTN', hk1:1, hk2:1, group:'Bắt buộc' },
  { code:'GDDP', hk1:1, hk2:1, group:'Bắt buộc' },
  { code:'CHAO_CO',     hk1:1, hk2:1, group:'Hoạt động tập thể' },
  { code:'SH_CUOI_TUAN',hk1:1, hk2:1, group:'Hoạt động tập thể' },
];

// LS bắt buộc cho khối 11, 12 theo TT13/2022
const mandatoryLS = { code:'LS', hk1:2, hk2:2, group:'Bắt buộc' };

// Môn lựa chọn: 2 tiết/tuần; Chuyên đề: 1 tiết/tuần
const ELECTIVE_PERIODS = { hk1:2, hk2:2 };
const SPECIAL_PERIODS  = { hk1:1, hk2:1 };

// ===== TEACHER ASSIGNMENT POOLS (by subject code) =====
const teacherPools = {
  TOAN: ['GV001','GV002','GV003','GV004','GV005','GV006','GV007','GV008','GV049'],
  VAN:  ['GV009','GV010','GV011','GV012','GV013','GV014','GV050'],
  ANH:  ['GV015','GV016','GV017','GV018','GV019','GV020'],
  LY:   ['GV021','GV022','GV023','GV024'],
  HOA:  ['GV025','GV026','GV027'],
  SINH: ['GV028','GV029'],
  LS:   ['GV030','GV031','GV032'],
  DIA:  ['GV033','GV034','GV035'],
  TIN:  ['GV036','GV037','GV038'],
  GDTC: ['GV039','GV040','GV041','GV042'],
  GDQP: ['GV043','GV044'],
  GDKT: ['GV045','GV046'],
  CN:   ['GV047','GV048'],
  HDTN: ['GV009','GV012','GV030','GV033','GV045'], // Various teachers
  GDDP: ['GV030','GV031','GV033','GV034','GV035'], // LS/DIA teachers
};

// Round-robin counter per pool
const poolCounters = {};
function getTeacher(subjectCode) {
  // For CHAO_CO / SH_CUOI_TUAN, return null (handled separately with homeroom)
  if (subjectCode === 'CHAO_CO' || subjectCode === 'SH_CUOI_TUAN') return null;
  const pool = teacherPools[subjectCode];
  if (!pool) return teacherPools.HDTN[0]; // fallback
  if (!poolCounters[subjectCode]) poolCounters[subjectCode] = 0;
  const idx = poolCounters[subjectCode] % pool.length;
  poolCounters[subjectCode]++;
  return pool[idx];
}

function getTeacherObj(code) {
  return teachers.find(t => t.code === code);
}

// ===== GENERATE ASSIGNMENTS =====
function generateAssignments() {
  const rows = [];
  let stt = 0;

  for (const cls of classes) {
    const combo = combinations.find(c => c.code === comboAssign[cls.name]);
    const comboCode = combo ? combo.code : '';
    const homeroomCode = homeroomMap[cls.name];

    // 1) Mandatory subjects for all
    for (const subj of mandatoryAll) {
      stt++;
      let teacherCode;
      if (subj.code === 'CHAO_CO' || subj.code === 'SH_CUOI_TUAN') {
        teacherCode = homeroomCode; // homeroom teacher
      } else {
        teacherCode = getTeacher(subj.code);
      }
      const t = getTeacherObj(teacherCode);
      rows.push({
        stt, year:'2025-2026', grade:cls.grade, className:cls.name, comboCode,
        subjectCode:subj.code, subjectName:SUBJECTS[subj.code], group:subj.group,
        hk1:subj.hk1, hk2:subj.hk2,
        t1Code:teacherCode, t1Name:t?.name||'', t1Load:t?(t.base-t.red):17,
        t2Code:teacherCode, t2Name:t?.name||'', t2Load:t?(t.base-t.red):17,
      });
    }

    // 2) LS mandatory for grade 11, 12
    if (cls.grade >= 11) {
      stt++;
      const tc = getTeacher('LS');
      const t = getTeacherObj(tc);
      rows.push({
        stt, year:'2025-2026', grade:cls.grade, className:cls.name, comboCode,
        subjectCode:'LS', subjectName:SUBJECTS.LS, group:'Bắt buộc',
        hk1:2, hk2:2,
        t1Code:tc, t1Name:t?.name||'', t1Load:t?(t.base-t.red):17,
        t2Code:tc, t2Name:t?.name||'', t2Load:t?(t.base-t.red):17,
      });
    }

    // 3) Elective subjects from combination
    if (combo) {
      for (const elCode of combo.e) {
        // For grade 11/12, LS is already added as mandatory, skip in electives
        if ((cls.grade >= 11) && elCode === 'LS') continue;
        stt++;
        const tc = getTeacher(elCode);
        const t = getTeacherObj(tc);
        rows.push({
          stt, year:'2025-2026', grade:cls.grade, className:cls.name, comboCode,
          subjectCode:elCode, subjectName:SUBJECTS[elCode], group:'Lựa chọn',
          hk1:ELECTIVE_PERIODS.hk1, hk2:ELECTIVE_PERIODS.hk2,
          t1Code:tc, t1Name:t?.name||'', t1Load:t?(t.base-t.red):17,
          t2Code:tc, t2Name:t?.name||'', t2Load:t?(t.base-t.red):17,
        });
      }

      // 4) Chuyên đề (special topics)
      for (const spCode of combo.s) {
        stt++;
        // CD_LY -> base subject LY
        const baseCode = spCode.replace('CD_', '');
        const tc = getTeacher(baseCode);
        const t = getTeacherObj(tc);
        rows.push({
          stt, year:'2025-2026', grade:cls.grade, className:cls.name, comboCode,
          subjectCode:spCode, subjectName:`Chuyên đề ${SUBJECTS[baseCode]}`,
          group:'Chuyên đề học tập',
          hk1:SPECIAL_PERIODS.hk1, hk2:SPECIAL_PERIODS.hk2,
          t1Code:tc, t1Name:t?.name||'', t1Load:t?(t.base-t.red):17,
          t2Code:tc, t2Name:t?.name||'', t2Load:t?(t.base-t.red):17,
        });
      }
    }
  }
  return rows;
}

// ===== BUILD EXCEL =====
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SampleDataGenerator';

  // --- Sheet 1: DM_Giao_vien ---
  const ws1 = wb.addWorksheet('DM_Giao_vien');
  ws1.columns = [
    { header:'Mã_GV', key:'code', width:14 },
    { header:'Họ_tên', key:'fullName', width:26 },
    { header:'Tổ_CM', key:'department', width:18 },
    { header:'Môn_chuyên_môn_chính', key:'majorSubject', width:22 },
    { header:'Trạng_thái', key:'status', width:14 },
    { header:'Định_mức_tuần', key:'baseLoad', width:14 },
    { header:'Giảm_trừ_tuần', key:'reduction', width:14 },
    { header:'Định_mức_hiệu_lực', key:'effectiveLoad', width:16 },
    { header:'Ghi_chú', key:'notes', width:24 },
  ];
  applyTitle(ws1, 1, 'Danh mục giáo viên', 9);
  applyHeader(ws1.getRow(2));
  for (const t of teachers) {
    const row = ws1.addRow({
      code: t.code, fullName: t.name, department: t.dept,
      majorSubject: t.major, status: 'Đang dạy',
      baseLoad: t.base, reduction: t.red, effectiveLoad: t.base - t.red,
      notes: t.note || '',
    });
    applyBody(row);
  }

  // --- Sheet 2: DM_Lop ---
  const ws2 = wb.addWorksheet('DM_Lop');
  ws2.columns = [
    { header:'Lớp', key:'name', width:14 },
    { header:'Khối', key:'gradeLevel', width:10 },
    { header:'Sĩ_số', key:'studentCount', width:10 },
    { header:'Buổi_học', key:'sessionLabel', width:12 },
    { header:'Mã_tổ_hợp', key:'combinationCode', width:14 },
    { header:'GVCN_Mã', key:'homeroomCode', width:14 },
    { header:'GVCN_Họ_tên', key:'homeroomName', width:26 },
    { header:'Ghi_chú', key:'notes', width:20 },
  ];
  applyTitle(ws2, 1, 'Danh mục lớp', 8);
  applyHeader(ws2.getRow(2));
  for (const c of classes) {
    const hrCode = homeroomMap[c.name];
    const hr = getTeacherObj(hrCode);
    const row = ws2.addRow({
      name:c.name, gradeLevel:c.grade, studentCount:c.students,
      sessionLabel:'Sáng', combinationCode:comboAssign[c.name]||'',
      homeroomCode:hrCode, homeroomName:hr?.name||'', notes:'',
    });
    applyBody(row);
  }

  // --- Sheet 3: DM_To_hop ---
  const ws3 = wb.addWorksheet('DM_To_hop');
  ws3.columns = [
    { header:'Mã_tổ_hợp', key:'code', width:14 },
    { header:'Khối', key:'gradeLevel', width:10 },
    { header:'Môn_tự_chọn_1', key:'elective1', width:14 },
    { header:'Môn_tự_chọn_2', key:'elective2', width:14 },
    { header:'Môn_tự_chọn_3', key:'elective3', width:14 },
    { header:'Môn_tự_chọn_4', key:'elective4', width:14 },
    { header:'Chuyên_đề_1', key:'special1', width:14 },
    { header:'Chuyên_đề_2', key:'special2', width:14 },
    { header:'Chuyên_đề_3', key:'special3', width:14 },
    { header:'Ghi_chú', key:'notes', width:20 },
  ];
  applyTitle(ws3, 1, 'Danh mục tổ hợp môn học', 10);
  applyHeader(ws3.getRow(2));
  for (const cm of combinations) {
    const row = ws3.addRow({
      code:cm.code, gradeLevel:cm.grade,
      elective1:cm.e[0], elective2:cm.e[1], elective3:cm.e[2], elective4:cm.e[3],
      special1:cm.s[0], special2:cm.s[1], special3:cm.s[2], notes:'',
    });
    applyBody(row);
  }

  // --- Sheet 4: Phan_cong ---
  const assignments = generateAssignments();
  const ws4 = wb.addWorksheet('Phan_cong');
  ws4.columns = [
    { header:'STT', key:'order', width:8 },
    { header:'Năm_học', key:'schoolYear', width:14 },
    { header:'Khối', key:'gradeLevel', width:8 },
    { header:'Lớp', key:'className', width:12 },
    { header:'Mã_tổ_hợp', key:'combinationCode', width:14 },
    { header:'Mã_môn', key:'subjectCode', width:16 },
    { header:'Tên_môn', key:'subjectName', width:30 },
    { header:'Nhóm_CT', key:'programGroup', width:20 },
    { header:'Tiết_HK1', key:'periodsHk1', width:10 },
    { header:'Tiết_HK2', key:'periodsHk2', width:10 },
    { header:'GV_HK1_Mã', key:'teacherHk1Code', width:14 },
    { header:'GV_HK1_Họ_tên', key:'teacherHk1Name', width:24 },
    { header:'GV_HK1_Định_mức', key:'teacherHk1Load', width:16 },
    { header:'GV_HK2_Mã', key:'teacherHk2Code', width:14 },
    { header:'GV_HK2_Họ_tên', key:'teacherHk2Name', width:24 },
    { header:'GV_HK2_Định_mức', key:'teacherHk2Load', width:16 },
    { header:'Ghi_chú', key:'notes', width:20 },
  ];
  applyTitle(ws4, 1, 'Bảng phân công giảng dạy theo năm học', 17);
  applyHeader(ws4.getRow(2));
  for (const a of assignments) {
    const row = ws4.addRow({
      order:a.stt, schoolYear:a.year, gradeLevel:a.grade,
      className:a.className, combinationCode:a.comboCode,
      subjectCode:a.subjectCode, subjectName:a.subjectName,
      programGroup:a.group, periodsHk1:a.hk1, periodsHk2:a.hk2,
      teacherHk1Code:a.t1Code, teacherHk1Name:a.t1Name, teacherHk1Load:a.t1Load,
      teacherHk2Code:a.t2Code, teacherHk2Name:a.t2Name, teacherHk2Load:a.t2Load,
      notes:'',
    });
    applyBody(row);
  }

  // Save
  const outPath = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`✅ File saved: ${outPath}`);
  console.log(`   Teachers: ${teachers.length}`);
  console.log(`   Classes: ${classes.length}`);
  console.log(`   Combinations: ${combinations.length}`);
  console.log(`   Assignment rows: ${assignments.length}`);

  // Stats
  const totalPeriodsHk1 = assignments.reduce((s,a) => s+a.hk1, 0);
  console.log(`   Total periods (HK1): ${totalPeriodsHk1}`);
  console.log(`   Avg periods/class (HK1): ${(totalPeriodsHk1/classes.length).toFixed(1)}`);
}

// ===== STYLING HELPERS =====
function applyTitle(ws, rowNum, title, colCount) {
  ws.mergeCells(rowNum, 1, rowNum, colCount);
  const cell = ws.getRow(rowNum).getCell(1);
  cell.value = title;
  cell.font = { name:'Calibri', size:14, bold:true, color:{argb:'FF0F172A'} };
  cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE2E8F0'} };
  cell.alignment = { horizontal:'left', vertical:'middle' };
  ws.getRow(rowNum).height = 24;
}

function applyHeader(row) {
  row.font = { name:'Calibri', bold:true, color:{argb:'FFFFFFFF'} };
  row.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1D4ED8'} };
  row.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
  row.height = 22;
  row.eachCell(c => { c.border = thinBorder(); });
}

function applyBody(row) {
  row.font = { name:'Calibri', size:11, color:{argb:'FF111827'} };
  row.alignment = { vertical:'middle', wrapText:true };
  row.eachCell(c => { c.border = thinBorder(); });
}

function thinBorder() {
  return { top:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'}, bottom:{style:'thin'} };
}

main().catch(console.error);
