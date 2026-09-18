import {
  buildDemands,
  checkSubmission,
  completeAssignments,
  departmentOfSubject,
  PlanClass,
  PlanTeacher,
  subjectsOfDepartment,
} from './department-plan';

const teacher = (code: string, major: string, department: string, capacity = 17, position = 'GV'): PlanTeacher => ({
  code, name: code, major, department, position, capacity, teachableGrades: [10, 11, 12],
});

const TEACHERS: PlanTeacher[] = [
  teacher('T1', 'TOAN', 'Tổ Toán', 13),
  teacher('T2', 'TOAN', 'Tổ Toán', 14, 'TT'),
  teacher('L1', 'LY', 'Tổ Lý - Tin', 17, 'TT'),
  teacher('I1', 'TIN', 'Tổ Lý - Tin'),
  teacher('H1', 'HOA', 'Tổ Hóa - Sinh', 17, 'TT'),
  teacher('S1', 'SINH', 'Tổ Hóa - Sinh'),
  teacher('SU', 'LS', 'Tổ Sử - Địa', 17, 'TT'),
  teacher('DI', 'DIA', 'Tổ Sử - Địa'),
  teacher('GK', 'GDKT', 'Tổ Sử - Địa'),
  teacher('V1', 'VAN', 'Tổ Văn', 17, 'TT'),
  teacher('A1', 'ANH', 'Tổ Anh', 17, 'TT'),
  teacher('TC', 'GDTC', 'Tổ Thể chất', 17, 'TT'),
  teacher('QP', 'GDQP', 'Tổ Thể chất'),
];
const CLASSES: PlanClass[] = [
  { id: 'c1', name: '10A1', grade: 10, session: 0, combinationCode: 'TN2', homeroomTeacherCode: 'T1' },
];
const COMBOS = [{ code: 'TN2', grade: 10, electives: ['LY', 'HOA', 'TIN', 'CNCN'] }];

describe('department-plan', () => {
  it('moi lop 29 tiet day va 2 hoat dong tap the, lay tu bang chuong trinh', () => {
    const demands = buildDemands(CLASSES, COMBOS);
    const teaching = demands.filter((d) => !['CHAO_CO', 'SH_CUOI_TUAN'].includes(d.subjectCode));
    expect(teaching.reduce((n, d) => n + d.theory + d.practice, 0)).toBe(29);
    expect(demands.find((d) => d.subjectCode === 'LY')).toMatchObject({ theory: 1, practice: 2 });
    expect(demands.filter((d) => ['CHAO_CO', 'SH_CUOI_TUAN'].includes(d.subjectCode))).toHaveLength(2);
  });

  it('to nhan them mon kiem nhiem; HDTN va chao co khong thuoc to nao', () => {
    expect(subjectsOfDepartment('Tổ Lý - Tin', TEACHERS).sort()).toEqual(['CNCN', 'LY', 'TIN']);
    expect(subjectsOfDepartment('Tổ Sử - Địa', TEACHERS).sort()).toEqual(['DIA', 'GDDP', 'GDKT', 'LS']);
    expect(departmentOfSubject('CNNN', TEACHERS)).toBe('Tổ Hóa - Sinh');
    expect(departmentOfSubject('HDTN', TEACHERS)).toBeNull();
  });

  it('bai nop: bao ma sai, sai chuyen mon, dong thieu', () => {
    const demands = buildDemands(CLASSES, COMBOS);
    const issues = checkSubmission('Tổ Lý - Tin', [
      { className: '10A1', subjectCode: 'LY', hk1TeacherCode: 'L1', hk2TeacherCode: '' },
      { className: '10A1', subjectCode: 'CNCN', hk1TeacherCode: 'H1', hk2TeacherCode: '' },
      { className: '10A1', subjectCode: 'TIN', hk1TeacherCode: 'XX', hk2TeacherCode: '' },
    ], demands, TEACHERS);
    expect(issues.filter((i) => i.level === 'ERROR').map((i) => i.teacherCode).sort()).toEqual(['H1', 'XX']);
    expect(issues.some((i) => i.level === 'WARNING')).toBe(false);

    const missing = checkSubmission('Tổ Lý - Tin', [{ className: '10A1', subjectCode: 'LY', hk1TeacherCode: 'L1', hk2TeacherCode: '' }], demands, TEACHERS);
    expect(missing.filter((i) => i.level === 'WARNING').map((i) => i.subjectCode).sort()).toEqual(['CNCN', 'TIN']);
  });

  it('giu dung phan cong to truong, GVCN nhan HDTN + chao co, phan con lai tu dien', () => {
    const demands = buildDemands(CLASSES, COMBOS);
    const result = completeAssignments({
      classes: CLASSES,
      teachers: TEACHERS,
      demands,
      submissions: [
        // To truong Toan giao Toan 10A1 cho T2 (khong phai GVCN) - phai giu nguyen
        { department: 'Tổ Toán', rows: [{ className: '10A1', subjectCode: 'TOAN', hk1TeacherCode: 'T2', hk2TeacherCode: '' }] },
        // To Ly - Tin giao sai chuyen mon cho CNCN - bo qua, tu dien lai
        { department: 'Tổ Lý - Tin', rows: [{ className: '10A1', subjectCode: 'CNCN', hk1TeacherCode: 'H1', hk2TeacherCode: 'H1' }] },
      ],
    });
    const of = (s: string) => result.assignments.find((a) => a.subjectCode === s)!;
    expect(of('TOAN')).toMatchObject({ hk1TeacherCode: 'T2', hk2TeacherCode: 'T2', source: 'DEPARTMENT' });
    expect(of('HDTN')).toMatchObject({ hk1TeacherCode: 'T1', source: 'HOMEROOM' });
    expect(of('CHAO_CO')).toMatchObject({ hk1TeacherCode: 'T1', source: 'HOMEROOM' });
    expect(['LY', 'TIN']).toContain(TEACHERS.find((t) => t.code === of('CNCN').hk1TeacherCode)!.major);
    expect(of('GDDP').source).toBe('AUTO');
    expect(['LS', 'DIA']).toContain(TEACHERS.find((t) => t.code === of('GDDP').hk1TeacherCode)!.major);
    expect(result.issues.filter((i) => i.level === 'ERROR')).toEqual([]);
    expect(result.stats.unassigned).toBe(0);
  });

  it('tu dien chia deu: nguoi chua co lop nao khong bi bo quen', () => {
    const many: PlanClass[] = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `10A${i + 1}`, grade: 10, session: 0, combinationCode: 'TN2', homeroomTeacherCode: null }));
    const english = [teacher('A1', 'ANH', 'Tổ Anh'), teacher('A2', 'ANH', 'Tổ Anh'), teacher('A3', 'ANH', 'Tổ Anh')];
    const staff = [...TEACHERS.filter((t) => t.major !== 'ANH'), ...english];
    const result = completeAssignments({ classes: many, teachers: staff, demands: buildDemands(many, COMBOS), submissions: [] });
    const loads = english.map((t) => result.loads[0].get(t.code) ?? 0);
    // 6 lop x 3 tiet = 18 tiet chia cho 3 nguoi: moi nguoi 2 lop
    expect(loads).toEqual([6, 6, 6]);
  });

  it('tu dien giu moi giao vien mot buoi: lop chieu khong keo giao vien buoi sang', () => {
    // 4 lop sang + 2 lop chieu, 3 giao vien Anh: hai nguoi sang, mot nguoi chieu
    const mixed: PlanClass[] = [
      ...[1, 2, 3, 4].map((i) => ({ id: `s${i}`, name: `10A${i}`, grade: 10, session: 0, combinationCode: 'TN2', homeroomTeacherCode: null })),
      ...[1, 2].map((i) => ({ id: `c${i}`, name: `11B${i}`, grade: 11, session: 1, combinationCode: 'TN2', homeroomTeacherCode: null })),
    ];
    const combos = [...COMBOS, { code: 'TN2', grade: 11, electives: ['LY', 'HOA', 'TIN', 'CNCN'] }];
    const english = [teacher('A1', 'ANH', 'Tổ Anh'), teacher('A2', 'ANH', 'Tổ Anh'), teacher('A3', 'ANH', 'Tổ Anh')];
    const staff = [...TEACHERS.filter((t) => t.major !== 'ANH'), ...english];
    const result = completeAssignments({ classes: mixed, teachers: staff, demands: buildDemands(mixed, combos), submissions: [] });
    const sessionsOf = (code: string) => new Set(result.assignments.filter((a) => a.subjectCode === 'ANH' && a.hk1TeacherCode === code).map((a) => a.session));
    for (const t of english) expect(sessionsOf(t.code).size).toBeLessThanOrEqual(1);
    expect(result.assignments.filter((a) => a.subjectCode === 'ANH').every((a) => a.hk1TeacherCode)).toBe(true);
  });

  it('khong ai du cho thi bao loi, khong nhan vuot dinh muc', () => {
    const tiny = TEACHERS.map((t) => (t.major === 'TOAN' ? { ...t, capacity: 2 } : t));
    const result = completeAssignments({ classes: CLASSES, teachers: tiny, demands: buildDemands(CLASSES, COMBOS), submissions: [] });
    // GVCN T1 van nhan HDTN 3 tiet vuot dinh muc 2 -> loi dinh muc; Toan khong ai nhan -> loi
    expect(result.issues.some((i) => i.level === 'ERROR' && i.subjectCode === 'TOAN')).toBe(true);
    expect(result.issues.some((i) => i.level === 'ERROR' && i.teacherCode === 'T1')).toBe(true);
  });

  it('không nhận giáo viên ngoài khối được phép dạy', () => {
    const grade10 = { ...teacher('A10', 'ANH', 'Tổ Anh'), teachableGrades: [10] };
    const grade11 = { ...teacher('A11', 'ANH', 'Tổ Anh'), teachableGrades: [11] };
    const staff = [...TEACHERS.filter((t) => t.major !== 'ANH'), grade10, grade11];
    const demands = buildDemands(CLASSES, COMBOS);

    const submitted = checkSubmission('Tổ Anh', [
      { className: '10A1', subjectCode: 'ANH', hk1TeacherCode: 'A11', hk2TeacherCode: '' },
    ], demands, staff);
    expect(submitted.some((issue) => issue.level === 'ERROR' && issue.teacherCode === 'A11')).toBe(true);

    const result = completeAssignments({ classes: CLASSES, teachers: staff, demands, submissions: [] });
    expect(result.assignments.find((assignment) => assignment.subjectCode === 'ANH')?.hk1TeacherCode).toBe('A10');
  });
});
