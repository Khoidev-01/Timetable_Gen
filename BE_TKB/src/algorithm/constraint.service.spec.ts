import { ConstraintService, QUALITY_SCALE, TimeSlot } from './constraint.service';

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
            expect(['EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'WEAK', 'POOR']).toContain(graded.grade);
        });

        it('còn lỗi cứng thì luôn là Tệ, dù phần còn lại đẹp đến đâu', () => {
            // Hai tiết cùng lớp cùng giờ: một lỗi cứng, và gần như không có khoản phạt mềm nào
            const clashing = [slot({ period: 1 }), slot({ period: 1, subjectId: 2 })];
            const graded = service.getFitnessDetails(clashing).quality;

            expect(graded.grade).toBe('POOR');
            expect(graded.gradeLabel).toBe('Tệ');
        });

        /**
         * Sáu bậc neo vào sáu mức công sức đo thật. Nếu ai đó sửa một ranh giới mà làm thang
         * lộn thứ tự, một thời khóa biểu tốt hơn có thể nhận nhãn tệ hơn — không ai nhìn ra
         * trên giao diện, vì giao diện chỉ còn hiện chữ.
         */
        it('thang sáu bậc đi đúng một chiều, và bậc cuối nhận mọi mức tệ hơn', () => {
            expect(QUALITY_SCALE.map((b) => b.label)).toEqual(['Xuất sắc', 'Tốt', 'Khá', 'Trung bình', 'Yếu', 'Tệ']);
            for (let i = 1; i < QUALITY_SCALE.length; i++) {
                expect(QUALITY_SCALE[i].upTo).toBeGreaterThan(QUALITY_SCALE[i - 1].upTo);
            }
            expect(QUALITY_SCALE[QUALITY_SCALE.length - 1].upTo).toBe(Infinity);
        });

        it('một lần xếp đầy đủ đo được rơi vào Tốt, lần tìm kiếm kéo dài rơi vào Xuất sắc', () => {
            const bandOf = (perSlot: number) => QUALITY_SCALE.find((b) => perSlot <= b.upTo)!.grade;

            // Các con số đo thật, xem chú thích của QUALITY_SCALE
            for (const run of [3.98, 4.01, 4.13]) expect(bandOf(run)).toBe('GOOD');
            for (const run of [3.68, 3.78, 3.85]) expect(bandOf(run)).toBe('EXCELLENT');
            expect(bandOf(9.35)).toBe('POOR');
        });

        it('xếp hạng đo bằng phần TRÁNH ĐƯỢC, không tính phần bất khả kháng', () => {
            // Giáo viên dạy cả buổi sáng lẫn buổi chiều thì buộc phải tới trường hai buổi,
            // dù công thức lấy sàn là "gộp hết vào ít buổi nhất có thể". Đó là khoản bất khả
            // kháng còn lại sau khi gỡ mức sàn sai của tiêu chí tiết đôi.
            const bothSessions = [
                ...Array.from({ length: 6 }, (_, i) => slot({ day: 2 + i, period: 1 })),
                ...Array.from({ length: 6 }, (_, i) => slot({ day: 2 + i, period: 7 })),
            ];
            const detail = service.getFitnessDetails(bothSessions);
            const graded = detail.quality;

            expect(graded.forcedPenalty).toBeGreaterThan(0);
            expect(graded.avoidablePenalty).toBe(detail.softPenalty - graded.forcedPenalty);
        });
    });

    describe('phần khoản phạt không thể tránh', () => {
        /**
         * Tôi từng khẳng định môn có số tiết lẻ thì bắt buộc lỗi một tiết, và đưa con số đó
         * lên giao diện dưới dạng "104 không thể tránh — còn 0 chỗ sửa được".
         *
         * Sai. Phép kiểm chỉ đòi mỗi tiết có ÍT NHẤT MỘT tiết cùng môn bên cạnh, không đòi
         * chia thành từng cặp — ba tiết liên nhau trong một ngày thì cả ba đều có hàng xóm.
         * Phép đo cận dưới bắt được mâu thuẫn: tối ưu riêng tiêu chí đó xuống 89, thấp hơn
         * con số tôi gọi là sàn.
         */
        it('môn 3 tiết xếp liền nhau thì không tiết nào lẻ loi', () => {
            const inARow = [1, 2, 3].map((period) =>
                slot({ classId: 'C1', subjectId: 1, day: 2, period }),
            );

            const result = service.getFitnessDetails(inARow);
            const split = result.breakdown.soft.find((item: any) => item.label === 'Môn 2 tiết bị xé lẻ');

            expect(split).toBeUndefined();
        });

        it('môn 3 tiết xếp tách ra thì lỗi, và lỗi đó SỬA ĐƯỢC — không có sàn', () => {
            const split3 = [
                slot({ classId: 'C1', subjectId: 1, day: 2, period: 1 }),
                slot({ classId: 'C1', subjectId: 1, day: 2, period: 2 }),
                slot({ classId: 'C1', subjectId: 1, day: 4, period: 1 }),
            ];

            const result = service.getFitnessDetails(split3);
            const split = result.breakdown.soft.find((item: any) => item.label === 'Môn 2 tiết bị xé lẻ');

            expect(split.count).toBe(1);
            expect(split.floor ?? 0).toBe(0);
            expect(split.avoidable).toBe(1);
        });

        it('môn 4 tiết thì không có gì bất khả kháng — xé lẻ là do xếp', () => {
            // Bốn tiết rải bốn ngày: bốn tiết đều lẻ loi, và cả bốn đều sửa được
            const fourPeriods = [2, 3, 4, 5].map((day) =>
                slot({ classId: 'C1', subjectId: 1, day, period: 1 }),
            );

            const result = service.getFitnessDetails(fourPeriods);
            const split = result.breakdown.soft.find((item: any) => item.label === 'Môn 2 tiết bị xé lẻ');

            expect(split.count).toBe(4);
            expect(split.floor ?? 0).toBe(0);
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

    describe('môn ưu tiên ở cuối buổi', () => {
        const priorityAt = (period: number) =>
            service.getFitnessDetails([slot({ subjectId: 1, day: 2, period })])
                .breakdown.soft.find((item: any) => item.label === 'Môn ưu tiên ở tiết cuối')?.count ?? 0;

        it('tiết 4 buổi sáng bị phạt, tiết 3 thì không', () => {
            expect(priorityAt(3)).toBe(0);
            expect(priorityAt(4)).toBe(1);
        });

        /**
         * Trường có 9 trên 30 lớp học chính buổi chiều. Phép kiểm cũ viết `period <= 5` nên
         * với những lớp ấy tiêu chí này chưa bao giờ chạy — 33 tiết Toán/Văn/Anh nằm ở tiết
         * 9-10 mà không tính một điểm phạt nào.
         */
        it('tiết 9 buổi chiều cũng là cuối buổi, và cũng bị phạt', () => {
            expect(priorityAt(8)).toBe(0);
            expect(priorityAt(9)).toBe(1);
            expect(priorityAt(10)).toBe(1);
        });
    });

    describe('locateSoftHotspots', () => {
        /**
         * Danh sách nghi phạm chỉ đáng tin khi nó dùng LẠI đúng định nghĩa của hàm chấm
         * điểm. Lệch một chút thôi là vòng tìm kiếm được dẫn tới những tiết không hề có
         * lỗi, và lúc ấy nó còn tệ hơn bốc đều.
         */
        it('chỉ tiết lẻ loi bị nêu tên, hai tiết ghép được thì không', () => {
            const schedule = [
                slot({ id: 'cap-1', subjectId: 1, day: 2, period: 1 }),
                slot({ id: 'cap-2', subjectId: 1, day: 2, period: 2 }),
                slot({ id: 'le-loi', subjectId: 1, day: 4, period: 1 }),
            ];

            const named = new Set(service.locateSoftHotspots(schedule).map((s) => s.id));

            expect(named).toEqual(new Set(['le-loi']));
        });

        it('ba tiết liền nhau thì không ai bị nêu tên', () => {
            const schedule = [1, 2, 3].map((period) =>
                slot({ id: `t${period}`, subjectId: 1, day: 2, period }),
            );

            expect(service.locateSoftHotspots(schedule)).toHaveLength(0);
        });

        it('tiết trống giữa buổi thì nêu tên cả hai đầu — dịch đầu nào cũng lấp được', () => {
            const schedule = [
                slot({ id: 'truoc', subjectId: 3, day: 2, period: 1 }),
                slot({ id: 'sau', subjectId: 3, day: 2, period: 4 }),
            ];

            const named = new Set(service.locateSoftHotspots(schedule).map((s) => s.id));

            expect(named).toEqual(new Set(['truoc', 'sau']));
        });

        it('tiết bị khoá không bao giờ bị nêu tên — có nêu cũng không dịch được', () => {
            const schedule = [
                slot({ id: 'cap-1', subjectId: 1, day: 2, period: 1 }),
                slot({ id: 'cap-2', subjectId: 1, day: 2, period: 2 }),
                slot({ id: 'le-loi', subjectId: 1, day: 4, period: 1, isLocked: true }),
            ];

            expect(service.locateSoftHotspots(schedule)).toHaveLength(0);
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
