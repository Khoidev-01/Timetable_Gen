'use client';

import { useState } from 'react';
import { Loader2, Scale, TrendingUp } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface ParetoPoint {
  fairnessWeight: number;
  timetableId: string;
  score: number;
  gini: number;
  spread: number;
  worstTeacherQuality: number;
  hardViolations: number;
  isValid: boolean;
  onFrontier: boolean;
  seconds: number;
}

interface Sweep {
  points: ParetoPoint[];
  recommendation?: { fairnessWeight: number; reason: string };
}

/**
 * What a fairer timetable costs in total quality.
 *
 * The two cannot both be maximised, and until now nothing said by how much they pull
 * against each other. Each point is a real solve, not a projection.
 */
export default function ParetoCurve({ semesterId }: { semesterId: string }) {
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setIsRunning(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/algorithm/pareto/${semesterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? 'Không chạy được');
        return;
      }
      setSweep(body);
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={18} className="text-violet-500" />
        <h2 className="font-semibold text-[var(--text-primary)]">Hiệu quả ↔ Công bằng</h2>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-[var(--text-muted)]">
        Không thể vừa tối đa chất lượng tổng vừa tối đa độ đồng đều. Nút dưới đây giải lại bài
        toán nhiều lần với các mức ưu tiên công bằng khác nhau, rồi cho biết mỗi mức đắt bao
        nhiêu — bằng số, không phải bằng cảm tính. Mỗi điểm là một lần giải thật, mất vài chục
        giây.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!sweep && (
        <button
          onClick={run}
          disabled={isRunning}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
          {isRunning ? 'Đang giải lại nhiều lần…' : 'Đo cái giá của công bằng'}
        </button>
      )}

      {sweep && (
        <div className="space-y-5">
          <Scatter points={sweep.points} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left text-xs text-[var(--text-muted)]">
                  <th className="py-2">Mức ưu tiên</th>
                  <th className="py-2 text-right">Điểm tổng</th>
                  <th className="py-2 text-right">Gini</th>
                  <th className="py-2 text-right">Chênh lệch</th>
                  <th className="py-2 text-right">GV tệ nhất</th>
                  <th className="py-2 text-center">Đáng chọn</th>
                </tr>
              </thead>
              <tbody>
                {sweep.points.map((point) => (
                  <tr
                    key={point.fairnessWeight}
                    className={`border-b border-[var(--border-light)] ${point.onFrontier ? '' : 'opacity-45'}`}
                  >
                    <td className="py-2 font-medium text-[var(--text-primary)]">
                      {point.fairnessWeight === 0 ? '0 — như hiện tại' : point.fairnessWeight}
                    </td>
                    <td className="py-2 text-right text-[var(--text-primary)]">{point.score}</td>
                    <td className="py-2 text-right text-[var(--text-primary)]">{point.gini.toFixed(3)}</td>
                    <td className="py-2 text-right text-[var(--text-primary)]">{point.spread}</td>
                    <td className="py-2 text-right text-[var(--text-primary)]">{point.worstTeacherQuality}</td>
                    <td className="py-2 text-center">
                      {!point.isValid ? (
                        <span className="text-red-600">lỗi cứng</span>
                      ) : point.onFrontier ? (
                        <span className="text-emerald-600">có</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">bị lấn át</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            &ldquo;Bị lấn át&rdquo; nghĩa là có phương án khác tốt hơn ở <em>cả hai</em> mặt —
            không ai nên chọn nó, dù coi trọng điều gì đi nữa.
          </p>

          {sweep.recommendation && (
            <div className="rounded-lg bg-violet-500/10 p-4">
              <p className="font-semibold text-violet-700 dark:text-violet-300">
                Đề xuất: mức ưu tiên {sweep.recommendation.fairnessWeight}
              </p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{sweep.recommendation.reason}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Đây là gợi ý, không phải quyết định — đánh đổi này là việc của nhà trường. Đặt
                mức đã chọn ở trang Cấu hình ràng buộc rồi xếp lại.
              </p>
            </div>
          )}

          <button
            onClick={run}
            disabled={isRunning}
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-60"
          >
            {isRunning ? 'Đang chạy lại…' : 'Đo lại'}
          </button>
        </div>
      )}
    </section>
  );
}

/** Quality against inequality. Up and to the left is better on both counts. */
function Scatter({ points }: { points: ParetoPoint[] }) {
  const valid = points.filter((p) => p.isValid);
  if (valid.length < 2) return null;

  const width = 460;
  const height = 240;
  const pad = 44;

  const scores = valid.map((p) => p.score);
  const ginis = valid.map((p) => p.gini);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const minGini = Math.min(...ginis);
  const maxGini = Math.max(...ginis);

  const x = (gini: number) =>
    pad + ((gini - minGini) / Math.max(1e-6, maxGini - minGini)) * (width - pad * 2);
  const y = (score: number) =>
    height - pad - ((score - minScore) / Math.max(1, maxScore - minScore)) * (height - pad * 2);

  const frontier = [...valid].filter((p) => p.onFrontier).sort((a, b) => a.gini - b.gini);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full max-w-lg" role="img" aria-label="Biểu đồ đánh đổi">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" strokeWidth="1" className="text-[var(--border-default)]" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="currentColor" strokeWidth="1" className="text-[var(--border-default)]" />

        {frontier.length > 1 && (
          <polyline
            points={frontier.map((p) => `${x(p.gini)},${y(p.score)}`).join(' ')}
            fill="none"
            stroke="rgb(139 92 246)"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        )}

        {valid.map((p) => (
          <g key={p.fairnessWeight}>
            <circle
              cx={x(p.gini)}
              cy={y(p.score)}
              r={p.onFrontier ? 6 : 4}
              fill={p.onFrontier ? 'rgb(139 92 246)' : 'var(--border-default)'}
            />
            <text x={x(p.gini)} y={y(p.score) - 10} textAnchor="middle" className="fill-[var(--text-muted)] text-[9px]">
              {p.fairnessWeight}
            </text>
          </g>
        ))}

        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">
          Gini — càng trái càng đồng đều
        </text>
        <text x={12} y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} className="fill-[var(--text-muted)] text-[10px]">
          Điểm tổng — càng lên càng tốt
        </text>
      </svg>
    </div>
  );
}
