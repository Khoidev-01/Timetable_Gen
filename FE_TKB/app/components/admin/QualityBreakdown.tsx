'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown, Users } from 'lucide-react';

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
  grade: 'GOOD' | 'FAIR' | 'AVERAGE' | 'UNOPTIMISED';
  gradeLabel: string;
  avoidablePerSlot: number;
  forcedPenalty: number;
  fixableCount: number;
  hardship?: {
    teacherCount: number;
    noDayOff: number;
    worstPerPeriod: number;
    spread: number;
  };
}

const GRADE_TONE: Record<Quality['grade'], string> = {
  GOOD: 'text-emerald-700 dark:text-emerald-400',
  FAIR: 'text-blue-700 dark:text-blue-400',
  AVERAGE: 'text-amber-700 dark:text-amber-400',
  UNOPTIMISED: 'text-red-700 dark:text-red-400',
};

/**
 * Thời khóa biểu này dùng được chưa, và tốt đến đâu.
 *
 * Trước đây chỗ này hiện đúng một dòng: `Fitness: -5211`. Không ai nhìn một số âm năm nghìn
 * mà dám đem thời khóa biểu đó ra dùng, kể cả khi nó hoàn toàn hợp lệ — mà nó hợp lệ thật.
 * Con số ấy là ngôn ngữ của thuật toán: một tổng tuyệt đối trên gần một nghìn tiết, lớn lên
 * theo quy mô trường, và không có mốc nào để biết bao nhiêu là đủ.
 *
 * Hai câu hỏi được tách hẳn ra, vì trộn chúng lại là chỗ dễ hiểu sai nhất. **Dùng được hay
 * chưa** là nhị phân và chỉ phụ thuộc lỗi cứng. **Chất lượng** là thang bậc, và nó không có
 * quyền phủ quyết: một thời khóa biểu "Trung bình" mà không lỗi cứng vẫn in ra treo lên
 * tường được.
 */
export default function QualityBreakdown({
  quality,
  score,
  slotCount,
  hardViolations,
  items,
}: {
  quality?: Quality;
  score: number | null;
  slotCount: number;
  hardViolations?: number;
  items: SoftItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

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
          {quality?.usableLabel ?? (usable ? 'Dùng được' : `Chưa dùng được — ${hardViolations} lỗi cứng`)}
        </span>

        {quality && (
          <span className="text-sm text-[var(--text-secondary)]">
            Chất lượng:{' '}
            <span className={`font-semibold ${GRADE_TONE[quality.grade]}`}>{quality.gradeLabel}</span>
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
        <p className="px-4 pb-2 text-xs text-[var(--text-muted)]">{quality.usableReason}</p>
      )}

      {/*
        Xếp hạng tổng là một con số trung bình, và trung bình che đi cả hai đầu. Lời phàn nàn
        ở trường không đến từ trung bình — nó đến từ đúng người có lịch xấu nhất, và người đó
        sẽ không thấy mình trong chữ "Tốt". Những con số này trang Công bằng đã tính từ trước,
        nhưng nó là một màn hình khác nên người đọc chữ "Tốt" không có lý do nào đi sang đó.
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
            Xếp hạng đo bằng số điểm phạt <strong>còn tránh được</strong> trên mỗi tiết — đã trừ
            phần bất khả kháng và đã chia cho quy mô trường, nên so được giữa hai trường khác
            cỡ. Mốc lấy từ đo thật trên bốn mức công sức tối ưu: chưa tối ưu 9,4 · tối ưu đầy
            đủ 5,3. <strong>&ldquo;Tốt&rdquo; nghĩa là ngang một lần tối ưu đầy đủ</strong>, không phải hoàn
            hảo.
            {quality && (
              <>
                {' '}
                Bản này: <strong>{quality.avoidablePerSlot}</strong> điểm phạt tránh được mỗi tiết.
              </>
            )}
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="py-1 font-medium">Tiêu chí</th>
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
            &ldquo;Đã tối đa&rdquo; nghĩa là không xếp lại kiểu nào tốt hơn được: môn có số tiết lẻ thì
            luôn còn một tiết không có tiết cùng môn bên cạnh.
            {score !== null && (
              <>
                {' '}
                Điểm thô của thuật toán: <span className="font-mono">{score}</span> — dùng để so hai
                phương án của cùng một lần xếp, không dùng để so hai trường.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
