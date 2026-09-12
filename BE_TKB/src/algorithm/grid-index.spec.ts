import { TimeSlot } from './constraint.service';
import { GridIndex } from './grid-index';

/**
 * Chỉ mục phải trả lời giống hệt phép quét thẳng, sau bất kỳ chuỗi thao tác nào.
 *
 * Một chỉ mục lệch còn tệ hơn không có chỉ mục: nó trả lời sai mà không báo gì, và vòng tìm
 * kiếm sẽ dựng ra một thời khóa biểu trùng giờ mà vẫn tưởng là hợp lệ.
 */
const ROOM_TYPE: Record<number, string | null> = { 1: null, 2: 'LAB_IT', 3: 'LAB_IT' };
const typeOf = (subjectId: number) => ROOM_TYPE[subjectId] ?? null;

function build(count: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let i = 0; i < count; i++) {
    slots.push({
      id: `s${i}`,
      classId: `C${i % 5}`,
      teacherId: `T${i % 7}`,
      subjectId: (i % 3) + 1,
      day: 2 + (i % 6),
      period: 1 + (i % 10),
    });
  }
  return slots;
}

const scanTeacher = (slots: TimeSlot[], teacherId: string, day: number, period: number, ignore?: TimeSlot) =>
  slots.some(s => s !== ignore && s.teacherId === teacherId && s.day === day && s.period === period);

const scanClass = (slots: TimeSlot[], classId: string, day: number, period: number, ignore?: TimeSlot) =>
  slots.some(s => s !== ignore && s.classId === classId && s.day === day && s.period === period);

const scanRoomType = (slots: TimeSlot[], type: string, day: number, period: number) =>
  slots.filter(s => typeOf(s.subjectId) === type && s.day === day && s.period === period).length;

describe('GridIndex', () => {
  it('trả lời giống phép quét thẳng ngay từ đầu', () => {
    const slots = build(60);
    const index = new GridIndex(slots, typeOf);

    for (let day = 2; day <= 7; day++) {
      for (let period = 1; period <= 10; period++) {
        expect(index.teacherBusy('T3', day, period)).toBe(scanTeacher(slots, 'T3', day, period));
        expect(index.classBusy('C2', day, period)).toBe(scanClass(slots, 'C2', day, period));
        expect(index.roomTypeUsage('LAB_IT', day, period)).toBe(scanRoomType(slots, 'LAB_IT', day, period));
      }
    }
  });

  it('vẫn khớp sau hàng trăm lần dời và đổi chỗ', () => {
    const slots = build(60);
    const index = new GridIndex(slots, typeOf);

    // Dãy số giả ngẫu nhiên cố định, để lần chạy nào cũng đi đúng đường đó
    let seed = 12345;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };

    for (let step = 0; step < 400; step++) {
      if (step % 3 === 0) {
        index.swap(slots[next(slots.length)], slots[next(slots.length)]);
      } else {
        index.move(slots[next(slots.length)], 2 + next(6), 1 + next(10));
      }
    }

    for (let day = 2; day <= 7; day++) {
      for (let period = 1; period <= 10; period++) {
        for (const teacher of ['T0', 'T3', 'T6']) {
          expect(index.teacherBusy(teacher, day, period)).toBe(scanTeacher(slots, teacher, day, period));
        }
        for (const cls of ['C0', 'C2', 'C4']) {
          expect(index.classBusy(cls, day, period)).toBe(scanClass(slots, cls, day, period));
        }
        expect(index.roomTypeUsage('LAB_IT', day, period)).toBe(scanRoomType(slots, 'LAB_IT', day, period));
      }
    }
  });

  it('bỏ qua đúng tiết đang xét khi nó vẫn nằm ở ô được hỏi', () => {
    const slots = build(20);
    const index = new GridIndex(slots, typeOf);
    const slot = slots[0];

    // Chính nó đang ở đó, nên hỏi "còn ai khác không" phải trả lời không
    expect(index.teacherBusy(slot.teacherId, slot.day, slot.period, slot)).toBe(
      scanTeacher(slots, slot.teacherId, slot.day, slot.period, slot),
    );
    expect(index.classBusy(slot.classId, slot.day, slot.period, slot)).toBe(
      scanClass(slots, slot.classId, slot.day, slot.period, slot),
    );
  });
});
