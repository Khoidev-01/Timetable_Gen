'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown, Users } from 'lucide-react';
import { GradeBadge, QualityGrade, QualityScale } from './QualityGrade';

export interface SoftItem {
  label: string;
  count: number;
  weight: number;
  /** Số lỗi không thể tránh, do chính dữ liệu quy định. */
  floor?: number;
  /** Số lỗi thật sự còn sửa được. */
  avoidable?: number;
}

export interface Quality {
  usable: boolean;
  usableLabel: string;
  usableReason: string;
  grade: QualityGrade;
  gradeLabel: string;
  gradeMeaning?: string;
  fixableCount: number;
  hardship?: {
    teacherCount: number;
    noDayOff: number;
    worstPerPeriod: number;
    spread: number;
  };
}

/**
 * Thời khóa biểu này dùng được chưa, và tốt đến đâu.
 *
 * Trước đây chỗ này hiện `Fitness: -5211`. Không ai nhìn một số âm năm nghìn mà dám đem thời
 * khóa biểu ra dùng, kể cả khi nó hoàn toàn hợp lệ. Nay không còn con số nào: chỉ còn một thang
 * sáu bậc từ Tệ đến Xuất sắc, và danh sách những chỗ còn sửa được, đếm bằng số chỗ.
 *
 * Hai câu hỏi được tách hẳn ra. **Dùng được hay chưa** là nhị phân và chỉ phụ thuộc lỗi cứng.
 * **Chất lượng** là thang bậc. Còn lỗi cứng thì chất lượng luôn là Tệ — một thời khóa biểu
 * thiếu tiết không được phép mang nhãn đẹp.
 */
export default function QualityBreakdown({
  quality,
  slotCount,
  hardViolations,
  items,
}: {
  quality?: Quality;
  slotCount: number;
  hardViolations?: number;
  items: SoftItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Xếp theo mức ảnh hưởng tới chất lượng, nhưng chỉ hiện số chỗ
  const ranked = [...items]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count * b.weight - a.count * a.weight);

  const usable = quality?.usable ?? (hardViolations ?? 0) === 0;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${
            usable ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'
          }`}
        >
          {usable ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {quality?.usableLabel ?? (usable ? 'Dùng được' : `Chưa dùng được - ${hardViolations} lỗi cứng`)}
        </span>

        {quality && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            Chất lượng: <GradeBadge grade={quality.grade} />
          </span>
        )}

        <span className="text-sm text-[var(--text-muted)]">{slotCount} tiết</span>

        <button
          onClick={() => setIsOpen((open) => !open)}
          className="ml-auto flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Chi tiết
          <ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {quality && (
        <div className="px-4 pb-3">
          <QualityScale grade={quality.grade} />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {quality.gradeMeaning ?? quality.usableReason}
          </p>
        </div>
      )}

      {/*
        Xếp hạng tổng là một trung bình, và trung bình che đi cả hai đầu. Lời phàn nàn ở trường
        đến từ đúng người có lịch xấu nhất, và người đó sẽ không thấy mình trong chữ "Tốt".
      */}
      {quality?.hardship && quality.hardship.noDayOff > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Users size={13} className="shrink-0" />
          <span>
            <strong>{quality.hardship.noDayOff}</strong> trong {quality.hardship.teacherCount} giáo
            viên không có ngày nghỉ nào trong tuần; người chịu nặng nhất gấp{' '}
            <strong>{quality.hardship.spread} lần</strong> người nhẹ nhất.
          </span>
          <Link href="/admin/fairness" className="font-medium underline hover:no-underline">
            Xem trang Công bằng
          </Link>
        </div>
      )}

      {isOpen && (
        <div className="border-t border-[var(--border-default)] px-4 py-3">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Mỗi bậc ứng với một mức công sức tối ưu đã đo thật trên dữ liệu: <strong>Tốt</strong> là
            ngang một lần xếp đầy đủ của hệ thống, <strong>Xuất sắc</strong> là ngang một lần tìm kiếm
            kéo dài gấp ba lần, còn các bậc dưới ứng với những lần tối ưu ngắn dần. Các bậc đã trừ phần
            không thể tránh và tính theo quy mô trường, nên trường lớn và trường nhỏ so được với nhau.
          </p>

          <table className="data-table data-table--compact w-full text-sm">
            <colgroup>
              <col style={{ width: '60%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="py-1 font-medium">Chỗ chưa tối ưu</th>
                <th className="py-1 text-right font-medium">Số chỗ</th>
                <th className="py-1 text-right font-medium">Còn sửa được</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item) => {
                const avoidable = item.avoidable ?? item.count;
                const forced = item.floor ?? 0;

                return (
                  <tr key={item.label} className="border-t border-[var(--border-light)]">
                    <td className="py-1.5 pr-2 text-[var(--text-primary)]">{item.label}</td>
                    <td className="py-1.5 text-right text-[var(--text-secondary)]">{item.count}</td>
                    <td className="py-1.5 text-right">
                      {avoidable === 0 ? (
                        <span className="text-emerald-600">đã tối đa</span>
                      ) : forced > 0 ? (
                        <span className="text-amber-600">
                          {avoidable}
                          <span className="text-xs text-[var(--text-muted)]"> ({forced} bất khả kháng)</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">{avoidable}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Danh sách xếp theo mức ảnh hưởng tới chất lượng, chỗ nặng nhất lên đầu. &ldquo;Đã tối
            đa&rdquo; nghĩa là không xếp lại kiểu nào tốt hơn được: một giáo viên dạy cả lớp học sáng
            lẫn lớp học chiều thì buộc phải tới trường hai buổi.
          </p>
        </div>
      )}
    </div>
  );
}
