'use client';

import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

export interface SoftItem {
  label: string;
  count: number;
  weight: number;
  /** Số lỗi không thể tránh, do chính dữ liệu quy định. */
  floor?: number;
  /** Số lỗi thật sự còn sửa được. */
  avoidable?: number;
}

/**
 * Điểm chất lượng, và phần nào của nó thật sự sửa được.
 *
 * Con số điểm là một TỔNG TUYỆT ĐỐI trên toàn bộ tiết, nên nó lớn lên theo quy mô trường:
 * cùng một chất lượng trên mỗi tiết, trường 30 lớp cho ra con số gấp hơn bốn lần trường 7
 * lớp. Hiện mỗi con số tổng thì người xem chỉ biết nó to, không biết nó có tệ hay không.
 *
 * Và một phần khoản phạt là bất khả kháng. Môn có 3 tiết mỗi tuần thì hai tiết ghép thành
 * một cặp và tiết thứ ba không bao giờ có ai bên cạnh — bảng điểm từng báo 104 lỗi loại đó
 * như thể có 104 chỗ cần sửa. Người đi tìm 104 chỗ và không tìm ra chỗ nào sẽ ngừng tin cả
 * những con số đúng.
 */
export default function QualityBreakdown({
  score,
  slotCount,
  penaltyPerSlot,
  hardViolations,
  items,
}: {
  score: number | null;
  slotCount: number;
  penaltyPerSlot?: number;
  hardViolations?: number;
  items: SoftItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const ranked = [...items]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count * b.weight - a.count * a.weight);

  const totalFloor = ranked.reduce((sum, item) => sum + (item.floor ?? 0) * item.weight, 0);
  const isValid = (hardViolations ?? 0) === 0;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isValid ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'
          }`}
        >
          {isValid ? 'Hợp lệ' : `${hardViolations} lỗi cứng`}
        </span>

        <span className="text-sm text-[var(--text-secondary)]">
          Điểm <span className="font-semibold text-[var(--text-primary)]">{score ?? '---'}</span>
          {penaltyPerSlot !== undefined && (
            <span className="text-[var(--text-muted)]"> · {penaltyPerSlot} điểm phạt mỗi tiết</span>
          )}
          {slotCount > 0 && <span className="text-[var(--text-muted)]"> · {slotCount} tiết</span>}
        </span>

        <ChevronDown
          size={16}
          className={`ml-auto shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[var(--border-default)] px-3 py-2">
          <p className="mb-2 flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Điểm là tổng trên toàn bộ tiết nên nó lớn lên theo quy mô trường — so hai trường
              với nhau thì dùng cột &ldquo;điểm phạt mỗi tiết&rdquo;. Lỗi cứng bằng 0 là điều kiện
              duy nhất để thời khóa biểu dùng được; điểm chất lượng không quyết định điều đó.
            </span>
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="py-1 font-medium">Tiêu chí</th>
                <th className="py-1 text-right font-medium">Điểm</th>
                <th className="py-1 text-right font-medium">Số lỗi</th>
                <th className="py-1 text-right font-medium">Sửa được</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item) => {
                const avoidable = item.avoidable ?? item.count;
                const forced = item.floor ?? 0;

                return (
                  <tr key={item.label} className="border-t border-[var(--border-light)]">
                    <td className="py-1.5 pr-2 text-[var(--text-primary)]">{item.label}</td>
                    <td className="py-1.5 text-right text-[var(--text-secondary)]">
                      −{item.count * item.weight}
                    </td>
                    <td className="py-1.5 text-right text-[var(--text-secondary)]">{item.count}</td>
                    <td className="py-1.5 text-right">
                      {forced > 0 ? (
                        <span className={avoidable === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                          {avoidable}
                          <span className="text-xs text-[var(--text-muted)]"> / {forced} bất khả kháng</span>
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

          {totalFloor > 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Trong tổng điểm phạt, <span className="font-medium text-[var(--text-secondary)]">{totalFloor} điểm</span>{' '}
              không thể xóa được dù xếp thế nào — môn có số tiết lẻ thì luôn còn một tiết không
              có tiết cùng môn bên cạnh, và một giáo viên dạy cả lớp học sáng lẫn lớp học chiều
              thì buộc phải tới trường ở cả hai buổi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
