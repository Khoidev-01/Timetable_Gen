import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AbsenceLinkService } from './absence-link.service';
import { SubstituteService } from './substitute.service';

/**
 * Turning "week 3, Thursday, period 2" into a calendar date is the one place this can
 * quietly go wrong, and a substitute sent on the wrong day is worse than none at all.
 */
/**
 * Compare in local time, not UTC. These dates are local midnight, so `toISOString()`
 * shifts them back a day in Vietnam and the assertion would fail on correct arithmetic.
 */
const asLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('AbsenceLinkService', () => {
  let service: AbsenceLinkService;
  let semester: any;
  let requests: any[];
  let recorded: any[];
  let planned: any;

  beforeEach(async () => {
    // 2026-09-07 is a Monday
    semester = { id: 'sem1', name: 'Học kỳ 1', start_date: new Date('2026-09-07T00:00:00') };
    requests = [];
    recorded = [];
    planned = { periods: [] };

    const prisma = {
      semester: { findUnique: async () => semester },
      teacher: { findUnique: async () => ({ id: 'T1', code: 'GV1', full_name: 'Cô Lan' }) },
      teacherBusyRequest: {
        findMany: async () => requests,
        findUnique: async ({ where }: any) => ({
          ...requests.find((r) => r.id === where.id),
          teacher: { full_name: 'Cô Lan' },
        }),
      },
    };

    const substitutes = {
      planCoverage: async () => planned,
      recordAbsence: async (params: any) => {
        recorded.push(params);
        return { success: true, overlayId: `ov${recorded.length}`, covered: 0, total: params.coverage.length };
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsenceLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubstituteService, useValue: substitutes },
      ],
    }).compile();

    service = module.get(AbsenceLinkService);
  });

  it('tuần 1 thứ 2 rơi đúng ngày khai giảng', async () => {
    const date = await service.dateOf('sem1', 1, 2);
    expect(asLocalDate(date)).toBe('2026-09-07');
  });

  it('tuần 1 thứ 7 là năm ngày sau đó', async () => {
    const date = await service.dateOf('sem1', 1, 7);
    expect(asLocalDate(date)).toBe('2026-09-12');
  });

  it('mỗi tuần cách nhau đúng bảy ngày', async () => {
    const week1 = await service.dateOf('sem1', 1, 3);
    const week4 = await service.dateOf('sem1', 4, 3);
    const days = (week4.getTime() - week1.getTime()) / 86_400_000;
    expect(days).toBe(21);
  });

  it('neo vào thứ Hai kể cả khi học kỳ bắt đầu giữa tuần', async () => {
    // 2026-09-09 là thứ Tư — tuần 1 thứ 2 vẫn phải là thứ Hai trước đó
    semester.start_date = new Date('2026-09-09T00:00:00');
    const date = await service.dateOf('sem1', 1, 2);
    expect(asLocalDate(date)).toBe('2026-09-07');
  });

  it('nói rõ vì sao không quy được khi học kỳ thiếu ngày bắt đầu', async () => {
    semester.start_date = null;
    await expect(service.dateOf('sem1', 2, 3)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.dateOf('sem1', 2, 3)).rejects.toThrow(/ngày bắt đầu/);
  });

  it('từ chối thứ nằm ngoài khoảng 2-7', async () => {
    await expect(service.dateOf('sem1', 1, 8)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.dateOf('sem1', 1, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('báo không tìm thấy học kỳ thay vì trả ngày sai', async () => {
    semester = null;
    await expect(service.dateOf('sem1', 1, 2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gộp nhiều tiết cùng ngày thành một lần vắng', async () => {
    requests = [
      { id: 'r1', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 3, period: 1, reason: 'Họp' },
      { id: 'r2', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 3, period: 2, reason: 'Họp' },
    ];
    planned = {
      periods: [
        { slotId: 's1', period: 1, className: '10A1', subjectName: 'Toán', candidates: [] },
        { slotId: 's2', period: 2, className: '10A2', subjectName: 'Toán', candidates: [] },
      ],
    };

    const result = await service.linkApproved({ semesterId: 'sem1', teacherId: 'T1', weekNumber: 2 });

    expect(result.linked).toHaveLength(2);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].coverage).toHaveLength(2);
    expect(recorded[0].date).toBe('2026-09-15');
  });

  it('tách thành hai lần vắng khi nghỉ hai ngày khác nhau', async () => {
    requests = [
      { id: 'r1', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 3, period: 1, reason: 'Họp' },
      { id: 'r2', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 5, period: 1, reason: 'Đi học' },
    ];
    planned = { periods: [{ slotId: 's1', period: 1, className: '10A1', subjectName: 'Toán', candidates: [] }] };

    await service.linkApproved({ semesterId: 'sem1', teacherId: 'T1', weekNumber: 2 });
    expect(recorded).toHaveLength(2);
  });

  it('không tạo lịch vắng cho tiết giáo viên vốn không dạy', async () => {
    requests = [
      { id: 'r1', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 3, period: 9, reason: 'Bận' },
    ];
    // Giáo viên rảnh tiết 9 — không có gì để bù
    planned = { periods: [{ slotId: 's1', period: 1, className: '10A1', subjectName: 'Toán', candidates: [] }] };

    const result = await service.linkApproved({ semesterId: 'sem1', teacherId: 'T1', weekNumber: 2 });

    expect(result.linked).toHaveLength(1);
    expect(recorded).toHaveLength(0);
  });

  it('ghi lại đơn không quy được ra ngày thay vì bỏ qua im lặng', async () => {
    semester.start_date = null;
    requests = [
      { id: 'r1', semester_id: 'sem1', teacher_id: 'T1', week_number: 2, day_of_week: 3, period: 1, reason: 'Họp' },
    ];

    const result = await service.linkApproved({ semesterId: 'sem1', teacherId: 'T1', weekNumber: 2 });

    expect(result.linked).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/ngày bắt đầu/);
  });
});
