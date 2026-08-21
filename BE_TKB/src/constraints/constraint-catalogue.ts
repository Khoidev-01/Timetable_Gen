/**
 * Every constraint the solver actually applies, in one list.
 *
 * The admin screen used to show eleven entries typed out by hand while the solver applied
 * eight hard checks and fourteen soft ones. Some rows on screen matched nothing in the
 * code, several real constraints were invisible, and no row was ever read back - the
 * weights lived in memory and the solver never looked at them.
 *
 * These keys are the same identifiers used in `ConstraintService.weights` and in
 * `checkHardConstraints()`. If a constraint is added there without an entry here, the
 * catalogue test fails - the screen cannot drift away from the code again.
 */
export type ConstraintKind = 'PENALTY' | 'HARD' | 'SOFT';

export interface CatalogueEntry {
  key: string;
  kind: ConstraintKind;
  code: string;
  name: string;
  description: string;
  defaultWeight: number;
  /** False for the three clashes that are physically impossible, never a preference. */
  canDisable: boolean;
}

export const CONSTRAINT_CATALOGUE: CatalogueEntry[] = [
  {
    key: 'hardViolation',
    kind: 'PENALTY',
    code: 'PEN',
    name: 'Mức phạt mỗi lỗi cứng',
    description:
      'Số điểm trừ cho mỗi lỗi cứng. Đặt cao để thuật toán ưu tiên tìm lời giải hợp lệ trước khi tối ưu chất lượng.',
    defaultWeight: 100,
    canDisable: false,
  },

  // --- Hard constraints: a schedule that breaks one of these is not usable ---
  {
    key: 'teacherConflict',
    kind: 'HARD',
    code: 'HC_01',
    name: 'Giáo viên trùng giờ',
    description: 'Một giáo viên không thể đứng ở hai lớp cùng một tiết.',
    defaultWeight: 0,
    canDisable: false,
  },
  {
    key: 'classConflict',
    kind: 'HARD',
    code: 'HC_02',
    name: 'Lớp học trùng giờ',
    description: 'Một lớp không thể học hai môn cùng một tiết.',
    defaultWeight: 0,
    canDisable: false,
  },
  {
    key: 'roomConflict',
    kind: 'HARD',
    code: 'HC_03',
    name: 'Phòng học trùng giờ',
    description: 'Một phòng không thể chứa hai lớp cùng một tiết.',
    defaultWeight: 0,
    canDisable: false,
  },
  {
    key: 'teacherBusy',
    kind: 'HARD',
    code: 'HC_04',
    name: 'Lịch bận giáo viên',
    description: 'Không xếp tiết vào khung giờ giáo viên đã đăng ký bận.',
    defaultWeight: 0,
    canDisable: true,
  },
  {
    key: 'missingPeriods',
    kind: 'HARD',
    code: 'HC_05',
    name: 'Đủ số tiết theo phân công',
    description:
      'Mỗi cặp (lớp, môn) phải nhận đúng số tiết đã phân công. Thiếu tiết là thời khóa biểu sai, không phải kém tối ưu.',
    defaultWeight: 0,
    canDisable: true,
  },
  {
    key: 'classGaps',
    kind: 'HARD',
    code: 'HC_06',
    name: 'Lớp không trống tiết giữa buổi',
    description: 'Học sinh không thể về giữa buổi rồi quay lại, nên buổi học của lớp phải liền mạch.',
    defaultWeight: 0,
    canDisable: true,
  },
  {
    key: 'teacherWeeklyLimit',
    kind: 'HARD',
    code: 'HC_07',
    name: 'Định mức tiết/tuần của giáo viên',
    description:
      'Theo Thông tư 05/2025, giáo viên THPT dạy 17 tiết/tuần. Chào cờ và sinh hoạt không tính vào định mức vì đã được trả bằng giảm trừ chủ nhiệm.',
    defaultWeight: 0,
    canDisable: true,
  },
  {
    key: 'roomTypeCapacity',
    kind: 'HARD',
    code: 'HC_08',
    name: 'Đủ phòng chức năng',
    description: 'Số tiết cần phòng thực hành trong một khung giờ không được vượt số phòng trường có.',
    defaultWeight: 0,
    canDisable: true,
  },

  {
    key: 'sessionRestriction',
    kind: 'HARD',
    code: 'HC_09',
    name: 'Lớp học đúng buổi chính',
    description:
      'Lớp học sáng thì học sáng, học chiều thì học chiều. Thể dục, GDQP, HĐTN và GDĐP được miễn vì trường vẫn xếp chúng vào buổi trống.',
    defaultWeight: 0,
    canDisable: true,
  },

  // --- Soft constraints: violating one costs points, the schedule stays usable ---
  {
    key: 'spreadSubjects',
    kind: 'SOFT',
    code: 'SC_01',
    name: 'Phân bố đều môn học',
    description: 'Môn nhiều tiết nên rải đều trong tuần thay vì dồn vào một hai ngày.',
    defaultWeight: 10,
    canDisable: true,
  },
  {
    key: 'heavySubjects',
    kind: 'SOFT',
    code: 'SC_02',
    name: 'Tránh môn nặng liền nhau',
    description: 'Toán, Lý, Hóa xếp liền nhau làm học sinh quá tải.',
    defaultWeight: 20,
    canDisable: true,
  },
  {
    key: 'morningPriority',
    kind: 'SOFT',
    code: 'SC_03',
    name: 'Môn chính ưu tiên đầu buổi',
    description: 'Toán, Văn, Anh học tốt nhất ở những tiết đầu, khi học sinh còn tập trung.',
    defaultWeight: 15,
    canDisable: true,
  },
  {
    key: 'block2',
    kind: 'SOFT',
    code: 'SC_04',
    name: 'Giữ nguyên tiết đôi',
    description: 'Môn có 2 tiết trong ngày nên xếp liền nhau để không mất thời gian ổn định lớp hai lần.',
    defaultWeight: 10,
    canDisable: true,
  },
  {
    key: 'teacherGaps',
    kind: 'SOFT',
    code: 'SC_05',
    name: 'Hạn chế tiết trống giáo viên',
    description: 'Giáo viên chờ một tiết giữa hai tiết dạy là thời gian bỏ phí ở trường.',
    defaultWeight: 5,
    canDisable: true,
  },
  {
    key: 'teacherMaxLoad',
    kind: 'SOFT',
    code: 'SC_06',
    name: 'Giới hạn tiết mỗi buổi',
    description: 'Dạy quá 4 tiết trong một buổi ảnh hưởng chất lượng những tiết cuối.',
    defaultWeight: 10,
    canDisable: true,
  },
  {
    key: 'teacherAttendance',
    kind: 'SOFT',
    code: 'SC_07',
    name: 'Gom buổi đến trường',
    description: 'Giáo viên đến trường chỉ để dạy một tiết là một buổi đi lại gần như không đáng.',
    defaultWeight: 8,
    canDisable: true,
  },
  {
    key: 'bothSessionsSameDay',
    kind: 'SOFT',
    code: 'SC_08',
    name: 'Tránh dạy cả sáng lẫn chiều',
    description: 'Dạy hai buổi trong ngày nghĩa là giáo viên ở trường gần như trọn ngày.',
    defaultWeight: 12,
    canDisable: true,
  },
  {
    key: 'afterPhysicalEd',
    kind: 'SOFT',
    code: 'SC_09',
    name: 'Không xếp môn tư duy ngay sau Thể dục',
    description: 'Học sinh vừa vận động xong khó tập trung ngay vào môn cần suy nghĩ.',
    defaultWeight: 10,
    canDisable: true,
  },
  {
    key: 'noDayOff',
    kind: 'SOFT',
    code: 'SC_10',
    name: 'Giữ ngày nghỉ cho giáo viên',
    description: 'Mỗi giáo viên nên có ít nhất một ngày không phải đến trường.',
    defaultWeight: 15,
    canDisable: true,
  },
  {
    key: 'consecutiveTeaching',
    kind: 'SOFT',
    code: 'SC_11',
    name: 'Không dạy quá 4 tiết liên tiếp',
    description: 'Bốn tiết liền không nghỉ là quá sức với một giáo viên.',
    defaultWeight: 8,
    canDisable: true,
  },
  {
    key: 'subjectSpacing',
    kind: 'SOFT',
    code: 'SC_12',
    name: 'Môn không cách nhau quá 3 ngày',
    description: 'Khoảng cách quá xa giữa hai tiết cùng môn làm học sinh quên bài trước.',
    defaultWeight: 8,
    canDisable: true,
  },
  {
    key: 'afternoonOverload',
    kind: 'SOFT',
    code: 'SC_13',
    name: 'Giới hạn tiết buổi phụ',
    description: 'Lớp học quá 3 tiết ở buổi phụ (buổi thứ hai trong ngày) là quá tải.',
    defaultWeight: 12,
    canDisable: true,
  },
  {
    key: 'mobility',
    kind: 'SOFT',
    code: 'SC_14',
    name: 'Hạn chế di chuyển giữa các tầng',
    description: 'Giáo viên lớn tuổi phải leo cầu thang liên tục giữa hai tiết liền nhau.',
    defaultWeight: 3,
    canDisable: true,
  },
  {
    key: 'outdoorTiming',
    kind: 'SOFT',
    code: 'SC_15',
    name: 'Thể dục tránh giờ nắng',
    description: 'Thể dục và GDQP nên xếp tiết 1-3 buổi sáng hoặc tiết 8-10 buổi chiều, tránh nắng giữa trưa.',
    defaultWeight: 10,
    canDisable: true,
  },
  {
    key: 'blockRules',
    kind: 'SOFT',
    code: 'SC_16',
    name: 'Môn nặng không dồn một buổi',
    description:
      'Mỗi buổi tối đa 3 tiết môn nặng, mỗi môn tối đa 2 tiết, và không bao giờ 3 tiết môn nặng liên tiếp.',
    defaultWeight: 12,
    canDisable: true,
  },
];

export const CATALOGUE_BY_KEY = new Map(CONSTRAINT_CATALOGUE.map((entry) => [entry.key, entry]));

/** The soft keys, which are exactly the weight names the solver multiplies by. */
export const SOFT_KEYS = CONSTRAINT_CATALOGUE.filter((e) => e.kind === 'SOFT').map((e) => e.key);

/** The hard keys, which are the checks `checkHardConstraints()` runs. */
export const HARD_KEYS = CONSTRAINT_CATALOGUE.filter((e) => e.kind === 'HARD').map((e) => e.key);
