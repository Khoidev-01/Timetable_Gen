import { formatRoomLabel } from './room-label';

describe('formatRoomLabel', () => {
  it('ghi rõ loại phòng theo phòng được gán', () => {
    expect(formatRoomLabel({ name: '101', type: 'CLASSROOM' }, 'TOAN')).toBe('Phòng 101');
    expect(formatRoomLabel({ name: '301', type: 'LAB_PHYSICS' }, 'LY')).toBe('Phòng Lab Vật lý 301');
    expect(formatRoomLabel({ name: '303', type: 'LAB_CHEM' }, 'HOA')).toBe('Phòng Lab Hóa học 303');
    expect(formatRoomLabel({ name: '305', type: 'LAB_BIO' }, 'SINH')).toBe('Phòng Lab Sinh học 305');
    expect(formatRoomLabel({ name: '307', type: 'LAB_IT' }, 'TIN')).toBe('Phòng Lab Tin học 307');
    expect(formatRoomLabel({ name: '310', type: 'MULTI_PURPOSE' }, 'MT')).toBe('Phòng đa năng 310');
  });

  it('sân bãi và chào cờ không phòng đều là Sân trường', () => {
    expect(formatRoomLabel({ name: 'SAN_1', type: 'YARD' }, 'GDTC')).toBe('Sân trường');
    expect(formatRoomLabel(null, 'CHAO_CO')).toBe('Sân trường');
  });

  it('tiết thường không có phòng thì không bịa nhãn', () => {
    expect(formatRoomLabel(null, 'TOAN')).toBeUndefined();
  });
});
