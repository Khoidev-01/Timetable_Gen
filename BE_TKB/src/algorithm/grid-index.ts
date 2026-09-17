import { TimeSlot } from './constraint.service';

/** Một ô trong lưới tuần, gộp thứ và tiết thành một số để làm khoá Map. */
const cellOf = (day: number, period: number) => day * 16 + period;

/**
 * Ai đang ở ô nào, tra trong thời gian hằng số.
 *
 * Vòng tìm kiếm hỏi đúng ba câu, hàng trăm nghìn lần: giáo viên này giờ đó có tiết chưa,
 * lớp này giờ đó có tiết chưa, và loại phòng kia giờ đó còn chỗ không. Trả lời bằng cách
 * quét cả gần một nghìn tiết thì mỗi nước đi tốn vài nghìn phép so sánh, và số vòng lặp
 * chạy được trong một giây — thứ quyết định chất lượng lời giải — tụt xuống theo.
 *
 * Đếm số lượng chứ không đánh dấu có/không. Đánh dấu thì lúc gỡ một tiết ra khỏi ô đang có
 * hai tiết, ô đó lập tức bị coi là trống trong khi vẫn còn một tiết nằm đấy — chỉ mục trả
 * lời sai mà không báo gì, và vòng tìm kiếm dựng ra lịch trùng giờ mà vẫn tưởng hợp lệ.
 */
export class GridIndex {
  private readonly teacherCells = new Map<string, Map<number, number>>();
  private readonly classCells = new Map<string, Map<number, number>>();
  private readonly roomTypeCells = new Map<string, Map<number, number>>();

  constructor(
    slots: TimeSlot[],
    private readonly roomTypeOf: (subjectId: number) => string | null,
  ) {
    for (const slot of slots) this.add(slot);
  }

  private bump(store: Map<string, Map<number, number>>, key: string, cell: number, by: number) {
    let counts = store.get(key);
    if (!counts) store.set(key, (counts = new Map()));

    const left = (counts.get(cell) ?? 0) + by;
    if (left > 0) counts.set(cell, left);
    else counts.delete(cell);
  }

  private add(slot: TimeSlot) {
    const cell = cellOf(slot.day, slot.period);
    this.bump(this.teacherCells, slot.teacherId, cell, 1);
    this.bump(this.classCells, slot.classId, cell, 1);

    const type = this.roomTypeOf(slot.subjectId);
    if (type) this.bump(this.roomTypeCells, type, cell, 1);
  }

  private remove(slot: TimeSlot) {
    const cell = cellOf(slot.day, slot.period);
    this.bump(this.teacherCells, slot.teacherId, cell, -1);
    this.bump(this.classCells, slot.classId, cell, -1);

    const type = this.roomTypeOf(slot.subjectId);
    if (type) this.bump(this.roomTypeCells, type, cell, -1);
  }

  /** Dời một tiết sang ô khác và giữ chỉ mục khớp với lưới. */
  move(slot: TimeSlot, day: number, period: number) {
    this.remove(slot);
    slot.day = day;
    slot.period = period;
    this.add(slot);
  }

  /** Đổi chỗ hai tiết cho nhau. */
  swap(a: TimeSlot, b: TimeSlot) {
    if (a === b) return;

    this.remove(a);
    this.remove(b);

    const day = a.day;
    const period = a.period;
    a.day = b.day;
    a.period = b.period;
    b.day = day;
    b.period = period;

    this.add(a);
    this.add(b);
  }

  /**
   * Giáo viên này đã có tiết ở ô đó chưa.
   *
   * `ignore` cần thiết vì lúc thử một nước đi, tiết đang được dời vẫn còn nằm trong chỉ mục
   * ở chỗ cũ; nếu chỗ cũ trùng ô đang hỏi thì nó tự chặn chính mình.
   */
  teacherBusy(teacherId: string, day: number, period: number, ignore?: TimeSlot): boolean {
    const cell = cellOf(day, period);
    const count = this.teacherCells.get(teacherId)?.get(cell) ?? 0;
    return count - this.selfAt(ignore, teacherId, undefined, cell) > 0;
  }

  classBusy(classId: string, day: number, period: number, ignore?: TimeSlot): boolean {
    const cell = cellOf(day, period);
    const count = this.classCells.get(classId)?.get(cell) ?? 0;
    return count - this.selfAt(ignore, undefined, classId, cell) > 0;
  }

  /** 1 nếu chính tiết được bỏ qua đang nằm ở ô đó và khớp giáo viên/lớp đang hỏi. */
  private selfAt(ignore: TimeSlot | undefined, teacherId?: string, classId?: string, cell?: number): number {
    if (!ignore) return 0;
    if (cellOf(ignore.day, ignore.period) !== cell) return 0;
    if (teacherId !== undefined && ignore.teacherId !== teacherId) return 0;
    if (classId !== undefined && ignore.classId !== classId) return 0;
    return 1;
  }

  /** Số tiết giáo viên này đang có ở ô đó — kể cả tiết bị khoá. */
  teacherCount(teacherId: string, day: number, period: number): number {
    return this.teacherCells.get(teacherId)?.get(cellOf(day, period)) ?? 0;
  }

  /** Số tiết lớp này đang có ở ô đó — kể cả tiết bị khoá. */
  classCount(classId: string, day: number, period: number): number {
    return this.classCells.get(classId)?.get(cellOf(day, period)) ?? 0;
  }

  /** Số tiết đang cần loại phòng đó vào giờ đó. */
  roomTypeUsage(type: string, day: number, period: number, ignore?: TimeSlot): number {
    const cell = cellOf(day, period);
    const count = this.roomTypeCells.get(type)?.get(cell) ?? 0;

    if (!ignore || cellOf(ignore.day, ignore.period) !== cell) return count;
    return this.roomTypeOf(ignore.subjectId) === type ? count - 1 : count;
  }
}
