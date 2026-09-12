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
