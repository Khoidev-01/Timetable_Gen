import { ConstraintService, TimeSlot } from './constraint.service';

const ROOMS = [
    { id: 1, name: '101', type: 'CLASSROOM', floor: 1 },
    { id: 2, name: '314', type: 'LAB_IT', floor: 3 },
    { id: 3, name: 'San', type: 'YARD', floor: 0 },
];

const CLASSES = [
    { id: 'C1', fixed_room: { id: 1, floor: 1 } },
    { id: 'C2', fixed_room: { id: 1, floor: 1 } },
    { id: 'C3', fixed_room: null },
];

const SUBJECTS = [
    { id: 1, code: 'TOAN', name: 'Toan', is_practice: false, is_special: false },
    { id: 2, code: 'TIN', name: 'Tin hoc', is_practice: true, is_special: false },
    { id: 3, code: 'GDTC', name: 'The duc', is_practice: false, is_special: false },
];

const TEACHERS = [
    { id: 'T1', code: 'GV001', max_periods_per_week: 3, mobility_weight: 10, constraints: [] },
    {
        id: 'T2',
        code: 'GV002',
        max_periods_per_week: 17,
        mobility_weight: 10,
        constraints: [{ day_of_week: 3, period: 2, session: 0, type: 'BUSY' }],
    },
    {
        id: 'T3',
        code: 'GV003',
        max_periods_per_week: 17,
        mobility_weight: 10,
        // session 2 nghĩa là cả ngày: một tiết bận ở cả buổi sáng lẫn buổi chiều
        constraints: [{ day_of_week: 4, period: 3, session: 2, type: 'BUSY' }],
    },
];

const ASSIGNMENTS = [{ class_id: 'C1', subject_id: 1, total_periods: 3 }];

function slot(partial: Partial<TimeSlot>): TimeSlot {
    return {
        classId: 'C1',
        subjectId: 1,
        teacherId: 'T1',
        day: 2,
        period: 1,
        ...partial,
    };
}

/** No admin overrides: the solver scores with the weights it ships with. */
function defaultSettings(): any {
    return { effective: async () => ({ weights: {}, disabledHard: new Set<string>() }) };
}

describe('ConstraintService', () => {
    let service: ConstraintService;

    beforeEach(async () => {
        const prisma: any = {
            room: { findMany: jest.fn().mockResolvedValue(ROOMS) },
            subject: { findMany: jest.fn().mockResolvedValue(SUBJECTS) },
            teacher: { findMany: jest.fn().mockResolvedValue(TEACHERS) },
            teachingAssignment: { findMany: jest.fn().mockResolvedValue(ASSIGNMENTS) },
            fixedPeriodRule: { findMany: jest.fn().mockResolvedValue([]) },
            class: { findMany: jest.fn().mockResolvedValue(CLASSES) },
        };

        service = new ConstraintService(prisma, defaultSettings());
        await service.initialize('semester-1');
    });

    describe('lỗi cứng không được triệt tiêu lẫn nhau', () => {
        /**
         * Gặp thật khi chạy luồng đổi tiết trên dữ liệu thật: hai tiết cùng lớp trùng giờ
         * làm `periods[i+1] - periods[i] - 1` ra -1, và khoảng trống âm đó triệt tiêu đúng
         * một lỗi trùng giờ. Tổng về 0, nên một thời khóa biểu SAI tự báo là hợp lệ.
         */
        it('hai tiết cùng lớp trùng giờ không tạo ra khoảng trống âm', () => {
            const clash: TimeSlot[] = [
                { id: 'a', day: 2, period: 1, classId: 'C1', subjectId: 1, teacherId: 'T1' },
                { id: 'b', day: 2, period: 1, classId: 'C1', subjectId: 2, teacherId: 'T2' },
            ];
            expect(service.checkClassGaps(clash)).toBe(0);
        });

        it('thời khóa biểu có lớp trùng giờ KHÔNG được báo là hợp lệ', () => {
            // Ca tối giản tái hiện đúng lỗi: chỉ hai tiết, trùng giờ.
            // Trước khi vá: trùng giờ +1, khoảng trống -1, tổng 0 -> báo HỢP LỆ.
            const broken: TimeSlot[] = [
                { id: 'a', day: 2, period: 1, classId: 'C1', subjectId: 1, teacherId: 'T1' },
                { id: 'b', day: 2, period: 1, classId: 'C1', subjectId: 2, teacherId: 'T2' },
            ];
            const fitness = service.getFitnessDetails(broken);

            expect(fitness.hardViolations).toBeGreaterThan(0);
            expect(fitness.isValid).toBe(false);
        });

        it('vẫn đếm đúng khoảng trống thật', () => {
            const withGap: TimeSlot[] = [
                { id: 'a', day: 2, period: 1, classId: 'C1', subjectId: 1, teacherId: 'T1' },
                { id: 'b', day: 2, period: 4, classId: 'C1', subjectId: 2, teacherId: 'T2' },
            ];
            // Tiết 2 và 3 trống
            expect(service.checkClassGaps(withGap)).toBe(2);
        });
    });

    describe('checkClassGaps', () => {
        it('reports no gap for a contiguous morning', () => {
            const schedule = [1, 2, 3].map(period => slot({ period }));
            expect(service.checkClassGaps(schedule)).toBe(0);
        });

        it('counts every empty period between two taught periods', () => {
            const schedule = [1, 2, 5].map(period => slot({ period }));
            expect(service.checkClassGaps(schedule)).toBe(2);
        });

        it('does not treat the lunch break as a gap', () => {
            const schedule = [slot({ period: 5 }), slot({ period: 6 })];
            expect(service.checkClassGaps(schedule)).toBe(0);
        });

        it('keeps classes independent of each other', () => {
            const schedule = [
                slot({ classId: 'C1', period: 1 }),
                slot({ classId: 'C2', period: 3 }),
            ];
            expect(service.checkClassGaps(schedule)).toBe(0);
        });
    });

    describe('checkMissingPeriods', () => {
        it('counts periods the schedule is short of', () => {
            const schedule = [1, 2].map(period => slot({ period }));
            expect(service.checkMissingPeriods(schedule)).toBe(1);
        });

        it('returns zero once the assignment is fully placed', () => {
            const schedule = [1, 2, 3].map(period => slot({ period }));
            expect(service.checkMissingPeriods(schedule)).toBe(0);
        });

        it('does not reward placing more periods than assigned', () => {
            const schedule = [1, 2, 3, 4].map(period => slot({ period }));
            expect(service.checkMissingPeriods(schedule)).toBe(0);
        });

        it('sums several assignments of one subject before comparing', async () => {
            // Toán split into a theory block and a chuyên đề block for the same class
            const prisma: any = {
                room: { findMany: jest.fn().mockResolvedValue(ROOMS) },
                subject: { findMany: jest.fn().mockResolvedValue(SUBJECTS) },
                teacher: { findMany: jest.fn().mockResolvedValue(TEACHERS) },
                teachingAssignment: {
                    findMany: jest.fn().mockResolvedValue([
                        { class_id: 'C1', subject_id: 1, total_periods: 3 },
                        { class_id: 'C1', subject_id: 1, total_periods: 1 },
                    ]),
                },
                fixedPeriodRule: { findMany: jest.fn().mockResolvedValue([]) },
                class: { findMany: jest.fn().mockResolvedValue(CLASSES) },
            };
            const split = new ConstraintService(prisma, defaultSettings());
            await split.initialize('semester-1');

            // 3 placed against a real demand of 4 - the theory block must not absorb
            // the chuyên đề requirement
            const schedule = [1, 2, 3].map(period => slot({ period }));
            expect(split.checkMissingPeriods(schedule)).toBe(1);
        });
    });

    describe('checkTeacherWeeklyLimit', () => {
        it('counts periods beyond the configured quota', () => {
            const schedule = [1, 2, 3, 4, 5].map(period => slot({ period, teacherId: 'T1' }));
            expect(service.checkTeacherWeeklyLimit(schedule)).toBe(2);
        });

        it('accepts a load exactly at the quota', () => {
            const schedule = [1, 2, 3].map(period => slot({ period, teacherId: 'T1' }));
            expect(service.checkTeacherWeeklyLimit(schedule)).toBe(0);
        });
    });

    describe('checkRoomTypeCapacity', () => {
        it('flags two practice classes competing for the single IT lab', () => {
            const schedule = [
                slot({ classId: 'C1', subjectId: 2 }),
                slot({ classId: 'C2', subjectId: 2 }),
            ];
            expect(service.checkRoomTypeCapacity(schedule)).toBe(1);
        });

        it('allows the same lab to be reused at a different period', () => {
            const schedule = [
                slot({ classId: 'C1', subjectId: 2, period: 1 }),
                slot({ classId: 'C2', subjectId: 2, period: 2 }),
            ];
            expect(service.checkRoomTypeCapacity(schedule)).toBe(0);
        });

        it('ignores theory subjects that stay in the class room', () => {
            const schedule = [
                slot({ classId: 'C1', subjectId: 1 }),
                slot({ classId: 'C2', subjectId: 1 }),
            ];
            expect(service.checkRoomTypeCapacity(schedule)).toBe(0);
        });
    });

    describe('room conflicts', () => {
        // No assignments, so the missing-period rule stays out of the way and the
        // violation count reflects room handling alone
        let rooms: ConstraintService;

        beforeEach(async () => {
            const prisma: any = {
                room: { findMany: jest.fn().mockResolvedValue(ROOMS) },
                subject: { findMany: jest.fn().mockResolvedValue(SUBJECTS) },
                teacher: { findMany: jest.fn().mockResolvedValue(TEACHERS) },
                teachingAssignment: { findMany: jest.fn().mockResolvedValue([]) },
                fixedPeriodRule: { findMany: jest.fn().mockResolvedValue([]) },
                class: { findMany: jest.fn().mockResolvedValue(CLASSES) },
            };
            rooms = new ConstraintService(prisma, defaultSettings());
            await rooms.initialize('semester-1');
        });

        it('does not treat periods without a room as clashing with each other', () => {
            const schedule = [
                slot({ classId: 'C1', teacherId: 'T1', roomId: undefined }),
                slot({ classId: 'C2', teacherId: 'T2', roomId: undefined }),
                slot({ classId: 'C3', teacherId: 'T3', roomId: undefined }),
            ];
            expect(rooms.checkHardConstraints(schedule)).toBe(0);
            expect(rooms.getFitnessDetails(schedule).hardViolations).toBe(0);
        });

        it('still flags two classes sharing a real room', () => {
            const schedule = [
                slot({ classId: 'C1', teacherId: 'T1', roomId: 1 }),
                slot({ classId: 'C2', teacherId: 'T2', roomId: 1 }),
            ];
            expect(rooms.checkHardConstraints(schedule)).toBe(1);
        });

        it('agrees between the batch check and the detailed breakdown', () => {
            const schedule = [
                slot({ classId: 'C1', teacherId: 'T1', roomId: undefined, period: 1 }),
                slot({ classId: 'C2', teacherId: 'T2', roomId: undefined, period: 1 }),
                slot({ classId: 'C3', teacherId: 'T3', roomId: 1, period: 2 }),
            ];
            expect(rooms.checkHardConstraints(schedule))
                .toBe(rooms.getFitnessDetails(schedule).hardViolations);
        });
    });

    describe('xếp hạng chất lượng', () => {
        /**
         * Hai câu hỏi phải tách hẳn nhau. Trộn chúng lại thì một thời khóa biểu hoàn toàn
         * hợp lệ bị gán nhãn xấu và không ai dám dùng, hoặc tệ hơn: một thời khóa biểu thiếu
         * tiết được gán nhãn đẹp rồi đem ra treo lên tường.
         */
        it('dùng được là nhị phân, và chỉ lỗi cứng quyết định', () => {
            const clean = [1, 2, 3].map((period) => slot({ period }));
            expect(service.getFitnessDetails(clean).quality.usable).toBe(true);

            // Hai tiết cùng lớp cùng giờ: một lỗi cứng
            const clashing = [slot({ period: 1 }), slot({ period: 1, subjectId: 2 })];
            const graded = service.getFitnessDetails(clashing).quality;
            expect(graded.usable).toBe(false);
            expect(graded.usableLabel).toContain('Chưa dùng được');
        });

        it('chất lượng kém không làm một thời khóa biểu hợp lệ thành không dùng được', () => {
            // Rải ba tiết ra ba ngày: xấu về chất lượng nhưng không lỗi cứng nào
            const scattered = [2, 4, 6].map((day) => slot({ day, period: 1 }));
            const graded = service.getFitnessDetails(scattered).quality;

            expect(graded.usable).toBe(true);
            expect(['GOOD', 'FAIR', 'AVERAGE', 'UNOPTIMISED']).toContain(graded.grade);
        });

        it('xếp hạng đo bằng phần TRÁNH ĐƯỢC, không tính phần bất khả kháng', () => {
            // Môn 3 tiết: một tiết lẻ loi là bất khả kháng, nên nó không được kéo hạng xuống
            const threePeriods = [
                slot({ day: 2, period: 1 }),
                slot({ day: 2, period: 2 }),
                slot({ day: 4, period: 1 }),
            ];
            const graded = service.getFitnessDetails(threePeriods).quality;

            expect(graded.forcedPenalty).toBeGreaterThan(0);
            // Khoản phạt tránh được phải nhỏ hơn tổng, đúng bằng phần bất khả kháng
            const detail = service.getFitnessDetails(threePeriods);
            expect(graded.avoidablePenalty).toBe(detail.softPenalty - graded.forcedPenalty);
        });
    });

    describe('phần khoản phạt không thể tránh', () => {
        /**
         * Một môn có số tiết lẻ thì hai tiết ghép thành một cặp và tiết còn lại không bao
         * giờ có ai bên cạnh. Đó là số học, không phải chất lượng xếp lịch.
         *
         * Bảng điểm từng báo "109 lỗi tiết đôi bị xé lẻ" trong khi 104 trong số đó bất khả
         * kháng — người đọc đi tìm 109 chỗ sửa và tìm ra 5, rồi ngừng tin con số.
         */
        it('môn 3 tiết luôn còn đúng một tiết lẻ loi, dù xếp thế nào', () => {
            const threePeriods = [
                slot({ classId: 'C1', subjectId: 1, day: 2, period: 1 }),
                slot({ classId: 'C1', subjectId: 1, day: 2, period: 2 }),
                slot({ classId: 'C1', subjectId: 1, day: 4, period: 1 }),
            ];

            const result = service.getFitnessDetails(threePeriods);
            const split = result.breakdown.soft.find((item: any) => item.label === 'Môn 2 tiết bị xé lẻ');

            expect(split.count).toBe(1);
            expect(split.floor).toBe(1);
            expect(split.avoidable).toBe(0);
        });

        it('môn 4 tiết thì không có gì bất khả kháng — xé lẻ là do xếp', () => {
            // Bốn tiết rải bốn ngày: bốn tiết đều lẻ loi, và cả bốn đều sửa được
            const fourPeriods = [2, 3, 4, 5].map((day) =>
                slot({ classId: 'C1', subjectId: 1, day, period: 1 }),
            );

            const result = service.getFitnessDetails(fourPeriods);
            const split = result.breakdown.soft.find((item: any) => item.label === 'Môn 2 tiết bị xé lẻ');

            expect(split.count).toBe(4);
            expect(split.floor).toBe(0);
            expect(split.avoidable).toBe(4);
        });

        it('điểm phạt trên mỗi tiết được tính ra, để so được giữa hai trường khác quy mô', () => {
            const schedule = [1, 2, 3, 4].map((period) => slot({ period }));
            const result = service.getFitnessDetails(schedule);

            expect(result.penaltyPerSlot).toBeCloseTo(result.softPenalty / schedule.length, 2);
        });
    });

    describe('placement guards', () => {
        it('detects a teacher registered as busy, converting absolute to relative period', () => {
            expect(service.isTeacherBusy('T2', 3, 2)).toBe(true);
            expect(service.isTeacherBusy('T2', 3, 4)).toBe(false);
        });

        /**
         * Đăng ký bận "cả buổi chiều" chỉ ghi một dòng với session = 1; "cả ngày" ghi
         * session = 2 và phải chặn ĐÚNG MỘT tiết ở cả hai buổi. Nhánh này không có test nào
         * chạm tới, nên nếu ai đó đổi phép quy đổi tiết tương đối sang tuyệt đối thì giáo
         * viên bị xếp vào đúng giờ họ đã báo bận, mà không có gì báo ra.
         */
        it('bận cả ngày thì chặn tiết đó ở cả buổi sáng lẫn buổi chiều', () => {
            // session 2, tiết 3 -> tiết 3 buổi sáng và tiết 8 (3 + 5) buổi chiều
            expect(service.isTeacherBusy('T3', 4, 3)).toBe(true);
            expect(service.isTeacherBusy('T3', 4, 8)).toBe(true);

            // Các tiết khác trong ngày vẫn dạy được
            expect(service.isTeacherBusy('T3', 4, 2)).toBe(false);
            expect(service.isTeacherBusy('T3', 4, 9)).toBe(false);
            // Ngày khác không bị ảnh hưởng
            expect(service.isTeacherBusy('T3', 5, 3)).toBe(false);
        });

        it('blocks a teacher who already reached the weekly quota', () => {
            const schedule = [1, 2, 3].map(period => slot({ period, teacherId: 'T1' }));
            expect(service.isTeacherAtWeeklyLimit('T1', schedule)).toBe(true);
            expect(service.isTeacherAtWeeklyLimit('T2', schedule)).toBe(false);
        });

        it('blocks a practice subject when its lab is taken at that time', () => {
            const schedule = [slot({ classId: 'C2', subjectId: 2, day: 2, period: 1 })];
            expect(service.isRoomTypeFull(2, 2, 1, schedule)).toBe(true);
            expect(service.isRoomTypeFull(2, 2, 3, schedule)).toBe(false);
        });

        it('never blocks a subject that needs no special room', () => {
            const schedule = [slot({ classId: 'C2', subjectId: 1 })];
            expect(service.isRoomTypeFull(1, 2, 1, schedule)).toBe(false);
        });
    });

    describe('checkMobilityCost', () => {
        const byTeacher = (slots: TimeSlot[]) => {
            const map = new Map<string, TimeSlot[]>();
            for (const s of slots) {
                if (!map.has(s.teacherId)) map.set(s.teacherId, []);
                map.get(s.teacherId)!.push(s);
            }
            return map;
        };

        it('charges nothing when consecutive periods stay on one floor', () => {
            // Both periods are ordinary lessons in C1's home room on floor 1
            const schedule = [slot({ period: 1 }), slot({ period: 2 })];
            expect(service.checkMobilityCost(byTeacher(schedule))).toBe(0);
        });

        it('charges the floors climbed between back-to-back periods', () => {
            // Toán in the class room (floor 1) then Tin in the IT lab (floor 3)
            const schedule = [slot({ period: 1, subjectId: 1 }), slot({ period: 2, subjectId: 2 })];
            expect(service.checkMobilityCost(byTeacher(schedule))).toBe(2);
        });

        it('ignores floors when the periods are not adjacent', () => {
            const schedule = [slot({ period: 1, subjectId: 1 }), slot({ period: 4, subjectId: 2 })];
            expect(service.checkMobilityCost(byTeacher(schedule))).toBe(0);
        });

        it('scales the cost by the teacher-specific weight', async () => {
            const heavy = { ...TEACHERS[0], id: 'T9', mobility_weight: 30 };
            const prisma: any = {
                room: { findMany: jest.fn().mockResolvedValue(ROOMS) },
                subject: { findMany: jest.fn().mockResolvedValue(SUBJECTS) },
                teacher: { findMany: jest.fn().mockResolvedValue([heavy]) },
                teachingAssignment: { findMany: jest.fn().mockResolvedValue([]) },
                fixedPeriodRule: { findMany: jest.fn().mockResolvedValue([]) },
                class: { findMany: jest.fn().mockResolvedValue(CLASSES) },
            };
            const weighted = new ConstraintService(prisma, defaultSettings());
            await weighted.initialize('semester-1');

            const schedule = [
                slot({ period: 1, subjectId: 1, teacherId: 'T9' }),
                slot({ period: 2, subjectId: 2, teacherId: 'T9' }),
            ];
            // Same two-floor climb, but weight 30 instead of 10
            expect(weighted.checkMobilityCost(byTeacher(schedule))).toBe(6);
        });

        it('skips periods whose floor cannot be worked out', () => {
            // C3 has no home room, so there is no floor to compare
            const schedule = [
                slot({ classId: 'C3', period: 1, subjectId: 1 }),
                slot({ classId: 'C3', period: 2, subjectId: 1 }),
            ];
            expect(service.checkMobilityCost(byTeacher(schedule))).toBe(0);
        });
    });

    describe('checkSubjectSpacing and afternoon load', () => {
        it('penalises a subject that disappears for more than three days', () => {
            // Toán on Monday then not again until Saturday - a five day gap
            const schedule = [slot({ day: 2, period: 1 }), slot({ day: 7, period: 1 })];
            const details = service.getFitnessDetails(schedule).details.join(' ');
            expect(details).toContain('cách nhau quá 3 ngày');
        });

        it('accepts a subject that comes round within three days', () => {
            const schedule = [slot({ day: 2, period: 1 }), slot({ day: 5, period: 1 })];
            const details = service.getFitnessDetails(schedule).details.join(' ');
            expect(details).not.toContain('cách nhau quá 3 ngày');
        });
    });

    describe('locateHardViolations', () => {
        it('names the two periods that clash on a teacher', () => {
            const schedule = [
                slot({ id: 'a', classId: 'C1', teacherId: 'T1' }),
                slot({ id: 'b', classId: 'C2', teacherId: 'T1' }),
            ];
            const found = service.locateHardViolations(schedule);
            const teacherClash = found.find(f => f.label === 'Giáo viên trùng giờ');

            expect(teacherClash?.slotIds.sort()).toEqual(['a', 'b']);
        });

        it('names the periods either side of a hole in a class day', () => {
            const schedule = [
                slot({ id: 'a', period: 1 }),
                slot({ id: 'b', period: 4 }),
            ];
            const found = service.locateHardViolations(schedule);
            const gaps = found.find(f => f.label === 'Lớp bị trống tiết giữa buổi');

            expect(gaps?.slotIds.sort()).toEqual(['a', 'b']);
        });

        it('reports nothing for a clean schedule', () => {
            const schedule = [slot({ id: 'a', period: 1 }), slot({ id: 'b', period: 2 })];
            expect(service.locateHardViolations(schedule)).toHaveLength(0);
        });
    });

    describe('getFitnessDetails', () => {
        it('marks a schedule with a class gap as invalid', () => {
            const schedule = [1, 2, 4].map(period => slot({ period }));
            const result = service.getFitnessDetails(schedule);

            expect(result.isValid).toBe(false);
            expect(result.details.join(' ')).toContain('Lớp bị trống tiết giữa buổi');
        });

        it('penalises teaching both sessions of the same day', () => {
            const schedule = [
                slot({ teacherId: 'T2', day: 2, period: 1 }),
                slot({ teacherId: 'T2', day: 2, period: 6, classId: 'C2' }),
            ];
            const result = service.getFitnessDetails(schedule);

            expect(result.details.join(' ')).toContain('dạy cả sáng lẫn chiều');
        });

        it('reports a fully satisfied schedule as valid', () => {
            const schedule = [1, 2, 3].map(period => slot({ period, teacherId: 'T1' }));
            const result = service.getFitnessDetails(schedule);

            expect(result.hardViolations).toBe(0);
            expect(result.isValid).toBe(true);
        });
    });
});
