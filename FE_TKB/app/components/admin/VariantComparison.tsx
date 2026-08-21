'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, QrCode, RefreshCw } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Variant {
  id: string;
  name: string;
  isOfficial: boolean;
  score: number;
  hardViolations: number;
  isValid: boolean;
  slotCount: number;
  metrics: {
    teacherGaps: number;
    teacherExtraSessions: number;
    bothSessionsSameDay: number;
    splitBlocks: number;
    subjectPileUp: number;
    teachersWithoutDayOff: number;
    stairFloors: number;
  };
}

const COLUMNS: Array<{ key: keyof Variant['metrics']; label: string; hint: string }> = [
  { key: 'teacherExtraSessions', label: 'Buổi thừa', hint: 'Số buổi giáo viên phải đến trường nhiều hơn mức tối thiểu' },
  { key: 'bothSessionsSameDay', label: 'Cả 2 buổi', hint: 'Số lần giáo viên phải dạy cả sáng lẫn chiều trong một ngày' },
  { key: 'teacherGaps', label: 'Trống tiết', hint: 'Tổng số tiết trống giữa hai tiết dạy của giáo viên' },
  { key: 'splitBlocks', label: 'Xé tiết đôi', hint: 'Số tiết của môn 2 tiết bị tách rời nhau' },
  { key: 'subjectPileUp', label: 'Dồn cục', hint: 'Số lần một môn có quá 2 tiết trong cùng một ngày' },
  { key: 'teachersWithoutDayOff', label: 'Không ngày nghỉ', hint: 'Số giáo viên phải đến trường cả 6 ngày' },
  { key: 'stairFloors', label: 'Tầng cầu thang', hint: 'Tổng số tầng giáo viên phải leo giữa hai tiết liền nhau' },
];

interface Props {
  semesterId: string;
  onPublished?: () => void;
}

/**
 * The solver keeps several usable schedules. They score differently but none is simply
 * "the best" - one is kinder to teachers, another tidier for classes - so the choice is
 * shown rather than made.
 */
export default function VariantComparison({ semesterId, onPublished }: Props) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [publishing, setPublishing] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [share, setShare] = useState<{ url: string; qrSvg: string } | null>(null);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    if (!semesterId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/algorithm/variants/${semesterId}`, {
        headers: authHeaders(),
      });
      if (response.ok) setVariants(await response.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (variant: Variant) => {
    setPublishing(variant.id);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/algorithm/publish/${variant.id}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({ text: body?.message ?? 'Không công bố được phương án.', ok: false });
        return;
      }

      setMessage({ text: `Đã công bố ${variant.name}.`, ok: true });
      await load();
      await showShareLink(variant.id);
      onPublished?.();
    } catch (error) {
      console.error(error);
      setMessage({ text: 'Lỗi kết nối.', ok: false });
    } finally {
      setPublishing('');
    }
  };

  const showShareLink = async (timetableId: string) => {
    try {
      const response = await fetch(`${API_URL}/algorithm/public-link/${timetableId}`, {
        headers: authHeaders(),
      });
      if (response.ok) setShare(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  if (variants.length === 0 && !isLoading) return null;

  // Lower is better for every metric, so the winner of each column is its minimum
  const bestOf = (key: keyof Variant['metrics']) =>
    Math.min(...variants.map((variant) => variant.metrics[key]));

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="font-bold text-gray-800">So sánh phương án</span>
        <span className="text-sm text-gray-500">
          Số nhỏ hơn là tốt hơn ở mọi cột · ô tô xanh là phương án tốt nhất của cột đó
        </span>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2 text-left">Phương án</th>
              <th className="p-2 text-right">Điểm</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="p-2 text-right" title={column.hint}>
                  {column.label}
                </th>
              ))}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {variants.map((variant) => (
              <tr key={variant.id} className="border-t border-gray-200">
                <td className="p-2">
                  <span className="flex items-center gap-2 font-medium">
                    {variant.name.split(' — ')[0]}
                    {variant.isOfficial && (
                      <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
                        <BadgeCheck size={12} /> Chính thức
                      </span>
                    )}
                    {!variant.isValid && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                        {variant.hardViolations} lỗi cứng
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-2 text-right font-bold">{variant.score}</td>

                {COLUMNS.map((column) => {
                  const value = variant.metrics[column.key];
                  const isBest = value === bestOf(column.key);
                  return (
                    <td
                      key={column.key}
                      className={`p-2 text-right ${
                        isBest ? 'rounded bg-emerald-50 font-semibold text-emerald-700' : ''
                      }`}
                    >
                      {value}
                    </td>
                  );
                })}

                <td className="p-2 text-right">
                  {variant.isOfficial ? (
                    <button
                      onClick={() => showShareLink(variant.id)}
                      className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs
                        font-medium text-gray-600 hover:bg-gray-50"
                      title="Mã QR cho giáo viên quét"
                    >
                      <QrCode size={12} /> Mã QR
                    </button>
                  ) : (
                    <button
                      onClick={() => publish(variant)}
                      disabled={!variant.isValid || publishing === variant.id}
                      title={variant.isValid ? 'Đặt làm thời khóa biểu chính thức' : 'Phương án còn lỗi cứng'}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {publishing === variant.id ? 'Đang công bố…' : 'Công bố'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {share && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div
            className="shrink-0 rounded bg-white p-2"
            dangerouslySetInnerHTML={{ __html: share.qrSvg }}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-800">Liên kết công khai cho giáo viên</p>
            <p className="mt-1 text-sm text-emerald-700">
              Dán mã QR này lên bảng tin. Giáo viên quét là xem được lịch thật của hôm nay, kể cả
              các tiết dạy thay — không cần tài khoản.
            </p>
            <code className="mt-2 block truncate rounded bg-white px-2 py-1 text-xs text-gray-600">
              {share.url}
            </code>
          </div>
          <button onClick={() => setShare(null)} className="text-sm text-emerald-700 hover:underline">
            Đóng
          </button>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400">
        Chỉ phương án không còn lỗi cứng mới công bố được. Giáo viên luôn nhìn thấy bản chính thức.
      </p>
    </div>
  );
}
