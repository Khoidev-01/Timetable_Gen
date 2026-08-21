'use client';

import { useMemo } from 'react';

export interface SolveProgress {
  attempt: number;
  maxAttempts: number;
  phase: string;
  placed: number;
  required: number;
  hardViolations: number;
  score: number;
  slots?: Array<[string, number, number, number, string]>;
}

interface Props {
  progress: SolveProgress | null;
  history: number[];
  classes: Array<{ id: string; name: string }>;
  isRunning: boolean;
}

const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Live view of the solver: a filling grid, a score trace and the running counters. */
export default function SolverMonitor({ progress, history, classes, isRunning }: Props) {
  // Which (class, day, period) cells are taken right now
  const filled = useMemo(() => {
    const set = new Set<string>();
    for (const [classId, day, period] of progress?.slots ?? []) {
      set.add(`${classId}|${day}|${period}`);
    }
    return set;
  }, [progress?.slots]);

  const chart = useMemo(() => {
    if (history.length < 2) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;

    const points = history
      .map((value, index) => {
        const x = (index / (history.length - 1)) * 100;
        const y = 100 - ((value - min) / span) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    return { points, min, max };
  }, [history]);

  if (!progress) return null;

  const fillRate = progress.required > 0 ? Math.round((progress.placed / progress.required) * 100) : 0;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <span className="font-bold text-gray-800">Tiến trình xếp lịch</span>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
          {progress.phase}
        </span>
        {progress.maxAttempts > 0 && (
          <span className="text-sm text-gray-600">
            Phương án {progress.attempt}/{progress.maxAttempts}
          </span>
        )}
        {isRunning && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
            đang chạy
          </span>
        )}
      </div>

      {/* Counters */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Đã xếp</p>
          <p className="text-xl font-bold text-gray-800">
            {progress.placed}
            <span className="text-sm font-normal text-gray-400">/{progress.required}</span>
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min(fillRate, 100)}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Lỗi cứng</p>
          <p
            className={`text-xl font-bold ${
              progress.hardViolations === 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {progress.hardViolations}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {progress.hardViolations === 0 ? 'hợp lệ' : 'chưa dùng được'}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Điểm</p>
          <p className={`text-xl font-bold ${progress.score >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {progress.score}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Biến thiên điểm</p>
          {chart ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 h-10 w-full">
              <polyline points={chart.points} fill="none" stroke="#8b5cf6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <p className="mt-2 text-xs text-gray-400">đang thu thập…</p>
          )}
        </div>
      </div>

      {/* Live grid: one row per class, one cell per (day, period) */}
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: '2px' }}>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id}>
                <td className="pr-2 text-right text-xs font-semibold whitespace-nowrap text-gray-600">
                  {cls.name}
                </td>
                {DAYS.map((day) => (
                  <td key={day} className="px-0.5">
                    <div className="flex gap-0.5">
                      {PERIODS.map((period) => (
                        <span
                          key={period}
                          title={`Thứ ${day} · tiết ${period}`}
                          className={`block h-3 w-2 rounded-sm transition-colors ${
                            filled.has(`${cls.id}|${day}|${period}`) ? 'bg-purple-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Mỗi hàng là một lớp · mỗi cụm là một ngày (Thứ 2 → Thứ 7) · mỗi ô là một tiết
      </p>
    </div>
  );
}
