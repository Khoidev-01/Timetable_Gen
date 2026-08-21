'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RotateCw, Users, X } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface SwapStep {
  slotId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  from: { day: number; period: number };
  to: { day: number; period: number };
}

interface SwapCycle {
  length: number;
  teachersInvolved: number;
  deltaScore: number;
  steps: SwapStep[];
}

interface Props {
  slotId: string | null;
  onClose: () => void;
  onApplied: () => void;
}

const cell = (value: { day: number; period: number }) => `Thứ ${value.day} · tiết ${value.period}`;

/**
 * Shows the chain swaps that free a period. A direct exchange is usually blocked, but a
 * rotation through two or three colleagues normally exists - people just cannot see it
 * because they only reason one exchange deep.
 */
export default function CascadeSwapDialog({ slotId, onClose, onApplied }: Props) {
  const [target, setTarget] = useState<SwapStep | null>(null);
  const [cycles, setCycles] = useState<SwapCycle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [applying, setApplying] = useState(-1);
  const [error, setError] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    if (!slotId) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/algorithm/swap-options/${slotId}`, {
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.message ?? 'Không tìm được phương án đổi.');
        return;
      }

      setTarget(body.target);
      setCycles(body.cycles ?? []);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối.');
    } finally {
      setIsLoading(false);
    }
  }, [slotId]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (cycle: SwapCycle, index: number) => {
    setApplying(index);
    setError('');
    try {
      const response = await fetch(`${API_URL}/algorithm/apply-swap`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slotIds: cycle.steps.map((step) => step.slotId) }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.message ?? 'Không thực hiện được chu trình.');
        return;
      }

      onApplied();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối.');
    } finally {
      setApplying(-1);
    }
  };

  if (!slotId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <RotateCw size={20} className="text-purple-600" />
              Đổi tiết dây chuyền
            </h2>
            {target && (
              <p className="mt-1 text-sm text-gray-600">
                Giải phóng <strong>{target.subjectName}</strong> lớp <strong>{target.className}</strong>{' '}
                ({target.teacherName}) — hiện ở {cell(target.from)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {isLoading && <p className="py-8 text-center text-gray-500">Đang tìm chu trình…</p>}
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!isLoading && cycles.length === 0 && !error && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Không tìm được chu trình đổi nào cho tiết này. Lịch hiện quá kín — thử mở khóa bớt tiết
            cố định, hoặc giảm số ô giáo viên đã đăng ký bận.
          </div>
        )}

        <div className="space-y-4">
          {cycles.map((cycle, index) => (
            <div key={index} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-700">
                  Chu trình {cycle.length} bên
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-600">
                  <Users size={14} /> {cycle.teachersInvolved} giáo viên phải đồng ý
                </span>
                <span
                  className={`text-sm font-semibold ${
                    cycle.deltaScore >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  Δ điểm {cycle.deltaScore >= 0 ? '+' : ''}
                  {cycle.deltaScore}
                </span>

                <button
                  onClick={() => apply(cycle, index)}
                  disabled={applying >= 0}
                  className="ml-auto rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {applying === index ? 'Đang áp dụng…' : 'Áp dụng'}
                </button>
              </div>

              <ol className="space-y-1.5">
                {cycle.steps.map((step, position) => (
                  <li key={step.slotId} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-5 text-right text-xs text-gray-400">{position + 1}.</span>
                    <span className="font-medium text-gray-800">{step.className}</span>
                    <span className="text-gray-600">{step.subjectName}</span>
                    <span className="text-xs text-gray-500">({step.teacherName})</span>
                    <span className="ml-auto flex items-center gap-1.5 text-gray-700">
                      {cell(step.from)}
                      <ArrowRight size={14} className="text-purple-500" />
                      <span className="font-semibold">{cell(step.to)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Cả chu trình được thực hiện trong một giao dịch — hoặc tất cả cùng chuyển, hoặc không tiết
          nào chuyển. Chu trình áp dụng xong sẽ tự khóa lại.
        </p>
      </div>
    </div>
  );
}
