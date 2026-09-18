/**
 * Nhãn phòng hiển thị cho người đọc lịch.
 *
 * Tên phòng trong CSDL chỉ là số ("301"), không nói được đó là phòng học thường hay phòng thí
 * nghiệm - giáo viên và học sinh phải biết tiết thực hành học ở phòng Lab nào, còn chào cờ
 * và thể dục thì ra sân trường.
 */
const ROOM_TYPE_PREFIX: Record<string, string> = {
  CLASSROOM: 'Phòng',
  LAB_PHYSICS: 'Phòng Lab Vật lý',
  LAB_CHEM: 'Phòng Lab Hóa học',
  LAB_BIO: 'Phòng Lab Sinh học',
  LAB_IT: 'Phòng Lab Tin học',
  MULTI_PURPOSE: 'Phòng đa năng',
};

/** Hoạt động diễn ra ngoài sân dù không được gán phòng. */
const OUTDOOR_WITHOUT_ROOM = new Set(['CHAO_CO']);

export const SCHOOL_YARD_LABEL = 'Sân trường';

export function formatRoomLabel(
  room: { name: string; type?: string | null } | null | undefined,
  subjectCode?: string | null,
): string | undefined {
  if (!room) return subjectCode && OUTDOOR_WITHOUT_ROOM.has(subjectCode) ? SCHOOL_YARD_LABEL : undefined;
  if (room.type === 'YARD') return SCHOOL_YARD_LABEL;
  const prefix = ROOM_TYPE_PREFIX[room.type ?? 'CLASSROOM'] ?? 'Phòng';
  return `${prefix} ${room.name}`;
}
