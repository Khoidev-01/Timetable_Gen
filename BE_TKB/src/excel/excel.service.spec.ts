import { Test, TestingModule } from '@nestjs/testing';
import { RoomType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ExcelService } from './excel.service';

/**
 * Cách một trường thật gọi tên phòng của họ, đối chiếu với loại phòng hệ thống hiểu.
 *
 * "Phòng Tin học" từng rơi xuống loại phòng học thường: file mẫu khai đúng hai phòng máy,
 * hệ thống vẫn báo "chưa khai báo phòng máy tính", rồi bộ giải xếp tiết thực hành Tin vào
 * phòng không có máy. Không ai đọc bảng dữ liệu mà đoán ra được lỗi nằm ở đâu.
 */
describe('ExcelService — nhận dạng loại phòng', () => {
  let service: ExcelService;
  const resolve = (text: string): RoomType => (service as any).resolveRoomType(text);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExcelService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();

    service = module.get(ExcelService);
  });

  it('hiểu các cách gọi phòng máy mà trường hay dùng', () => {
    for (const spelling of ['Phòng Tin học', 'phòng tin học', 'Phòng máy tính', 'Lab Tin học', 'Phòng vi tính']) {
      expect(resolve(spelling)).toBe(RoomType.LAB_IT);
    }
  });

  it('vẫn nhận đúng các phòng chức năng khác', () => {
    expect(resolve('Lab Vật lý')).toBe(RoomType.LAB_PHYSICS);
    expect(resolve('Phòng TN Hóa')).toBe(RoomType.LAB_CHEM);
    expect(resolve('Lab Sinh học')).toBe(RoomType.LAB_BIO);
    expect(resolve('Sân bãi')).toBe(RoomType.YARD);
    expect(resolve('Đa năng')).toBe(RoomType.MULTI_PURPOSE);
  });

  it('phòng học thường vẫn là phòng học thường', () => {
    expect(resolve('Phòng học')).toBe(RoomType.CLASSROOM);
    expect(resolve('')).toBe(RoomType.CLASSROOM);
  });
});

/**
 * File phân công giao lý thuyết cho một người và thực hành cho người khác ở cùng lớp, cùng môn,
 * cùng học kỳ thì phải bị chặn lại: hai phần đó là việc của một giáo viên.
 */
describe('ExcelService — lý thuyết và thực hành cùng giáo viên', () => {
  let service: ExcelService;
  const validate = (rows: any[]) => {
    const errors: any[] = [];
    (service as any).validatePairedTeachers(rows, errors);
    return errors;
  };
  const row = (rowNumber: number, periodType: 'THEORY' | 'PRACTICE' | 'SPECIAL', hk1?: string, hk2?: string) => ({
    rowNumber,
    className: '10A1',
    subjectCode: 'LY',
    subjectName: 'Vật lý',
    periodType,
    hk1: hk1 ? { semesterId: 's1', teacherCode: hk1, totalPeriods: 2 } : undefined,
    hk2: hk2 ? { semesterId: 's2', teacherCode: hk2, totalPeriods: 2 } : undefined,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExcelService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();
    service = module.get(ExcelService);
  });

  it('báo lỗi đúng dòng và đúng học kỳ khi hai phần giao cho hai người', () => {
    const errors = validate([row(5, 'THEORY', 'GV01', 'GV01'), row(6, 'PRACTICE', 'GV01', 'GV02')]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 6, column: 'GV_HK2_Mã', code: 'theory_practice_teacher_mismatch_hk2' });
    expect(errors[0].message).toContain('GV02');
    expect(errors[0].message).toContain('GV01');
  });

  it('cùng một người cho cả hai phần thì không báo gì', () => {
    expect(validate([row(5, 'THEORY', 'GV01', 'GV03'), row(6, 'PRACTICE', 'GV01', 'GV03')])).toEqual([]);
  });

  it('chuyên đề (tiết đặc biệt) không tính là cặp lý thuyết - thực hành', () => {
    expect(validate([row(5, 'THEORY', 'GV01'), row(6, 'SPECIAL', 'GV09')])).toEqual([]);
  });
});
