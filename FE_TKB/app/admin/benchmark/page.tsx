'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FlaskConical, Play } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Solver {
  key: string;
  label: string;
  description: string;
}

interface SolverStats {
  key: string;
  label: string;
  description: string;
  runs: number;
  bestScore: number;
  worstScore: number;
  meanScore: number;
  stdDeviation: number;
  meanHardViolations: number;
  validRate: number;
  meanDurationMs: number;
  meanIterations: number;
  trace: number[];
}

interface Report {
  runs: number;
  iterations: number;
  constructionScore: number;
  results: SolverStats[];
  csv: string;
}

const SERIES_COLOURS = ['#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#dc2626'];

export default function BenchmarkPage() {
  const [solvers, setSolvers] = useState<Solver[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [runs, setRuns] = useState(10);
  const [iterations, setIterations] = useState(8000);
  const [report, setReport] = useState<Report | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const [solverRes, yearRes] = await Promise.all([
        fetch(`${API_URL}/algorithm/solvers`, { headers: authHeaders() }),
        fetch(`${API_URL}/system/years`, { headers: authHeaders() }),
      ]);

      if (solverRes.ok) {
        const list: Solver[] = await solverRes.json();
        setSolvers(list);
        setSelected(list.map((s) => s.key));
      }
      if (yearRes.ok) {
        const data = await yearRes.json();
        setYears(data);
        setSemesterId(data[0]?.semesters?.[0]?.id ?? '');
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = async () => {
    if (!semesterId || selected.length === 0) return;

    setIsRunning(true);
    setError('');
    setReport(null);

    try {
      const response = await fetch(`${API_URL}/algorithm/benchmark`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ semesterId, solverKeys: selected, runs, iterations }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? 'Không chạy được thử nghiệm.');
        return;
      }

      setReport(await response.json());
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối.');
    } finally {
      setIsRunning(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const blob = new Blob(['﻿' + report.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `benchmark-${runs}lan-${iterations}vong.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // All traces share one axis so the curves can be read against each other
  const chart = useMemo(() => {
    if (!report || report.results.length === 0) return null;

    const all = report.results.flatMap((r) => r.trace);
    if (all.length === 0) return null;

    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;

    const series = report.results.map((result, index) => ({
      label: result.label,
      colour: SERIES_COLOURS[index % SERIES_COLOURS.length],
      points: result.trace
        .map((value, i) => {
          const x = (i / Math.max(result.trace.length - 1, 1)) * 100;
          const y = 100 - ((value - min) / span) * 100;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' '),
    }));

    return { series, min, max };
  }, [report]);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const inputClass =
    'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-1 flex items-center gap-2">
          <FlaskConical size={20} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Thử nghiệm thuật toán</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Chạy nhiều thuật toán cải thiện trên cùng một bài toán và so sánh bằng số liệu. Mỗi lần
          chạy đều dựng lời giải ban đầu riêng, nên kết quả phản ánh cả độ ổn định chứ không chỉ
          điểm tốt nhất.
        </p>
      </div>

      {/* Cấu hình */}
      <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Học kỳ</span>
            <select className={inputClass} value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              {years.flatMap((year) =>
                (year.semesters ?? []).map((semester: any) => (
                  <option key={semester.id} value={semester.id}>
                    {year.name} — {semester.name}
                  </option>
                )),
              )}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Số lần chạy mỗi thuật toán</span>
            <input
              type="number"
              min={1}
              max={30}
              className={inputClass}
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Số vòng lặp mỗi lần</span>
            <input
              type="number"
              min={100}
              max={40000}
              step={1000}
              className={inputClass}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm text-[var(--text-muted)]">Thuật toán tham gia</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {solvers.map((solver) => (
              <label
                key={solver.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border-default)] p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(solver.key)}
                  onChange={() => toggle(solver.key)}
                />
                <span>
                  <span className="block font-semibold text-[var(--text-primary)]">{solver.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{solver.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning || !semesterId || selected.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={16} />
            {isRunning ? 'Đang chạy…' : 'Chạy thử nghiệm'}
          </button>

          {report && (
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2.5 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
            >
              <Download size={16} /> Tải CSV
            </button>
          )}

          {isRunning && (
            <span className="text-sm text-[var(--text-muted)]">
              {selected.length} thuật toán × {runs} lần — có thể mất vài phút
            </span>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {report && (
        <>
          {/* Bảng kết quả */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <h2 className="font-bold text-[var(--text-primary)]">Kết quả</h2>
              <span className="text-sm text-[var(--text-muted)]">
                {report.runs} lần chạy · {report.iterations} vòng lặp · điểm lời giải ban đầu{' '}
                {report.constructionScore}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-3 text-left">Thuật toán</th>
                    <th className="p-3 text-right">Tốt nhất</th>
                    <th className="p-3 text-right">Trung bình</th>
                    <th className="p-3 text-right">Tệ nhất</th>
                    <th className="p-3 text-right">Độ lệch chuẩn</th>
                    <th className="p-3 text-right">Lỗi cứng TB</th>
                    <th className="p-3 text-right">Hợp lệ</th>
                    <th className="p-3 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-primary)]">
                  {report.results.map((result, index) => (
                    <tr key={result.key} className="border-t border-[var(--border-default)]">
                      <td className="p-3">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length] }}
                          />
                          {result.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold">{result.bestScore}</td>
                      <td className="p-3 text-right font-bold">{result.meanScore}</td>
                      <td className="p-3 text-right text-[var(--text-muted)]">{result.worstScore}</td>
                      <td className="p-3 text-right text-[var(--text-muted)]">±{result.stdDeviation}</td>
                      <td className="p-3 text-right">{result.meanHardViolations}</td>
                      <td className="p-3 text-right">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            result.validRate >= 90
                              ? 'bg-emerald-100 text-emerald-700'
                              : result.validRate >= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {result.validRate}%
                        </span>
                      </td>
                      <td className="p-3 text-right text-[var(--text-muted)]">{result.meanDurationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-[var(--text-muted)]">
              &ldquo;Hợp lệ&rdquo; là tỉ lệ lần chạy đạt 0 lỗi cứng — chỉ số quan trọng hơn điểm, vì
              thời khóa biểu còn lỗi cứng thì không dùng được dù điểm cao.
            </p>
          </div>

          {/* Đường hội tụ */}
          {chart && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
              <h2 className="mb-1 font-bold text-[var(--text-primary)]">Đường hội tụ</h2>
              <p className="mb-4 text-sm text-[var(--text-muted)]">
                Điểm tốt nhất theo thời gian, lấy từ lần chạy tốt nhất của mỗi thuật toán
              </p>

              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-64 w-full">
                {[0, 25, 50, 75, 100].map((y) => (
                  <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeWidth="0.2" className="text-[var(--border-default)]" />
                ))}
                {chart.series.map((series) => (
                  <polyline
                    key={series.label}
                    points={series.points}
                    fill="none"
                    stroke={series.colour}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              <div className="mt-3 flex flex-wrap gap-4">
                {chart.series.map((series) => (
                  <span key={series.label} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                    <span className="inline-block h-0.5 w-5" style={{ backgroundColor: series.colour }} />
                    {series.label}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
                <span>điểm thấp nhất {chart.min}</span>
                <span>điểm cao nhất {chart.max}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
