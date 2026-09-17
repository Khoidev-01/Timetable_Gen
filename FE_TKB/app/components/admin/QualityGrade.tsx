/**
 * Thang đánh giá chất lượng thời khóa biểu: sáu bậc, từ Tệ đến Xuất sắc.
 *
 * Giao diện không hiện điểm số. Con số bên trong là tổng điểm phạt trên toàn bộ tiết — nó âm,
 * nó lớn lên theo quy mô trường, và không có mốc nào để người đọc biết bao nhiêu là đủ. Mỗi bậc
 * ở đây được neo vào một mức công sức tối ưu đo thật trên dữ liệu (xem readme, mục 5.2), nên
 * chữ "Tốt" có nghĩa cụ thể chứ không phải một cảm tính.
 */

export type QualityGrade = 'POOR' | 'WEAK' | 'AVERAGE' | 'FAIR' | 'GOOD' | 'EXCELLENT';

interface GradeInfo {
  grade: QualityGrade;
  label: string;
  /** Chữ và nền của nhãn. */
  badge: string;
  /** Màu ô trên thang. */
  fill: string;
}

/** Từ tệ nhất tới tốt nhất — đúng thứ tự hiển thị trên thang. */
export const QUALITY_SCALE: GradeInfo[] = [
  { grade: 'POOR', label: 'Tệ', badge: 'bg-red-500/10 text-red-700 dark:text-red-400', fill: 'bg-red-500' },
  { grade: 'WEAK', label: 'Yếu', badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', fill: 'bg-orange-500' },
  { grade: 'AVERAGE', label: 'Trung bình', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', fill: 'bg-amber-500' },
  { grade: 'FAIR', label: 'Khá', badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', fill: 'bg-sky-500' },
  { grade: 'GOOD', label: 'Tốt', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', fill: 'bg-emerald-500' },
  { grade: 'EXCELLENT', label: 'Xuất sắc', badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', fill: 'bg-violet-600' },
];

export function gradeInfo(grade: string | undefined | null): GradeInfo | undefined {
  return QUALITY_SCALE.find((item) => item.grade === grade);
}

/** Nhãn một bậc. Không có bậc thì hiện gạch ngang, không đoán. */
export function GradeBadge({ grade, className = '' }: { grade?: string | null; className?: string }) {
  const info = gradeInfo(grade);
  if (!info) return <span className={`text-[var(--text-muted)] ${className}`}>—</span>;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${info.badge} ${className}`}>
      {info.label}
    </span>
  );
}

/** Cả sáu bậc trên một hàng, bậc hiện tại được tô đậm. */
export function QualityScale({ grade }: { grade?: string | null }) {
  const current = QUALITY_SCALE.findIndex((item) => item.grade === grade);

  return (
    <div className="w-full" aria-label="Thang đánh giá chất lượng">
      <div className="flex gap-1">
        {QUALITY_SCALE.map((item, index) => (
          <div
            key={item.grade}
            className={`h-2 flex-1 rounded-full ${index <= current ? item.fill : 'bg-[var(--border-default)]'} ${
              index === current ? 'ring-2 ring-offset-1 ring-[var(--text-muted)]' : ''
            }`}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {QUALITY_SCALE.map((item, index) => (
          <span
            key={item.grade}
            className={`flex-1 text-center text-[11px] ${
              index === current ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Một thay đổi (đổi tiết, kéo thả) làm thời khóa biểu tốt hơn hay kém đi — nói bằng chữ,
 * không bằng "+12 điểm".
 */
export function describeChange(delta: number | undefined | null): { text: string; tone: string } | undefined {
  if (delta === undefined || delta === null) return undefined;
  if (delta > 0) return { text: 'chất lượng tốt hơn', tone: 'text-emerald-600' };
  if (delta < 0) return { text: 'chất lượng kém đi', tone: 'text-amber-600' };
  return { text: 'chất lượng không đổi', tone: 'text-[var(--text-muted)]' };
}
