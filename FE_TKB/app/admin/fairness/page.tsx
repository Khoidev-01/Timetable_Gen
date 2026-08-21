'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Scale, TriangleAlert } from 'lucide-react';
import { API_URL } from '@/lib/api';
import ParetoCurve from '../../components/admin/ParetoCurve';

interface TeacherQuality {
  teacherId: string;
  code: string;
  name: string;
  quality: number;
  periods: number;
  burdens: Array<{ label: string; count: number; cost: number }>;
}

interface FairnessReport {
  gini: number;
  lorenz: Array<{ population: number; quality: number }>;
  teachers: TeacherQuality[];
  worstOff: Array<{
    teacherId: string;
    name: string;
    quality: number;
    biggestBurden: string;
    suggestion: string;
  }>;
  summary: { best: number; worst: number; median: number; spread: number };
}

/** What the coefficient means in the only terms a head teacher cares about. */
function readGini(gini: number): { label: string; tone: string } {
  if (gini < 0.1) return { label: 'Rất đồng đều', tone: 'text-emerald-600' };
  if (gini < 0.2) return { label: 'Khá đồng đều', tone: 'text-emerald-600' };
  if (gini < 0.3) return { label: 'Có chênh lệch đáng kể', tone: 'text-amber-600' };
  return { label: 'Chênh lệch lớn', tone: 'text-red-600' };
}

export default function FairnessPage() {
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [semesterId, setSemesterId] = useState('');

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const yearRes = await fetch(`${API_URL}/system/years`, { headers: authHeaders() });
      if (!yearRes.ok) return;

      const years = await yearRes.json();
      const semester = years[0]?.semesters?.[0];
      if (!semester) return;
      setSemesterId(semester.id);

      const res = await fetch(`${API_URL}/algorithm/fairness/${semester.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) setReport(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tính…</p>;
  }

  if (!report || report.teachers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-default)] p-10 text-center">
        <Scale size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-primary)]">Chưa có thời khóa biểu để đánh giá</p>
      </div>
    );
  }

  const reading = readGini(report.gini);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <Scale size={24} className="text-indigo-500" />
            Công bằng giữa các giáo viên
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Điểm tổng của thời khóa biểu không nói gì về việc phần bất tiện rơi vào ai. Trang
            này chấm điểm tuần làm việc của từng giáo viên rồi đo độ chênh lệch giữa họ.
          </p>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        >
          <RefreshCw size={15} />
          Tính lại
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 lg:col-span-1">
          <p className="text-sm text-[var(--text-muted)]">Hệ số Gini</p>
          <p className={`mt-1 text-4xl font-bold ${reading.tone}`}>{report.gini.toFixed(3)}</p>
          <p className={`mt-1 text-sm font-medium ${reading.tone}`}>{reading.label}</p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
            0 nghĩa là mọi giáo viên có tuần làm việc tốt như nhau. Không trường nào đạt 0 —
            điều đáng xem là con số này tăng hay giảm giữa hai phương án.
          </p>

          <dl className="mt-4 space-y-1.5 border-t border-[var(--border-light)] pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Lịch tốt nhất</dt>
              <dd className="font-semibold text-emerald-600">{report.summary.best} điểm</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Trung vị</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{report.summary.median} điểm</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Lịch tệ nhất</dt>
              <dd className="font-semibold text-red-600">{report.summary.worst} điểm</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--border-light)] pt-1.5">
              <dt className="text-[var(--text-muted)]">Khoảng chênh</dt>
              <dd className="font-bold text-[var(--text-primary)]">{report.summary.spread} điểm</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Đường cong Lorenz</h2>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Đường chéo là phân bố hoàn toàn đồng đều. Đường cong càng võng xuống xa đường chéo,
            chênh lệch càng lớn.
          </p>
          <LorenzCurve points={report.lorenz} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-1 flex items-center gap-2">
          <TriangleAlert size={18} className="text-amber-500" />
          <h2 className="font-semibold text-[var(--text-primary)]">Giáo viên thiệt thòi nhất</h2>
        </div>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Với mỗi người, điều gì làm tuần của họ nặng nhất và sửa được bằng cách nào.
        </p>

        <ul className="space-y-3">
          {report.worstOff.map((teacher) => (
            <li
              key={teacher.teacherId}
              className="flex flex-wrap items-start gap-4 rounded-lg bg-[var(--bg-surface-hover)] p-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-lg font-bold text-red-600">
                {teacher.quality}
              </div>
              <div className="min-w-48 flex-1">
                <p className="font-semibold text-[var(--text-primary)]">{teacher.name}</p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">{teacher.biggestBurden}</p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{teacher.suggestion}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {semesterId && <ParetoCurve semesterId={semesterId} />}

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <h2 className="mb-1 font-semibold text-[var(--text-primary)]">Điểm lịch từng giáo viên</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Mỗi giáo viên được chấm so với chính khối lượng dạy của họ — người dạy 20 tiết không
          thể có tuần giống người dạy 8 tiết, nên trừ điểm vì điều đó là không công bằng.
        </p>

        <ul className="space-y-2">
          {report.teachers.map((teacher) => (
            <li
              key={teacher.teacherId}
              title={
                teacher.burdens.length > 0
                  ? teacher.burdens.map((b) => `${b.label}: ${b.count} lần (−${b.cost})`).join('\n')
                  : 'Không có điểm trừ nào'
              }
              className="flex items-center gap-3 text-sm"
            >
              <span className="w-32 shrink-0 truncate text-[var(--text-primary)]">{teacher.name}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--border-light)]">
                <div
                  className={`h-full rounded-full ${
                    teacher.quality >= 80
                      ? 'bg-emerald-500'
                      : teacher.quality >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${teacher.quality}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-medium text-[var(--text-primary)]">
                {teacher.quality}
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-[var(--text-muted)]">
                {teacher.periods} tiết
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LorenzCurve({ points }: { points: Array<{ population: number; quality: number }> }) {
  if (points.length < 2) return null;

  const size = 260;
  const pad = 28;
  const scale = size - pad * 2;
  const x = (v: number) => pad + v * scale;
  const y = (v: number) => size - pad - v * scale;

  const curve = points.map((p) => `${x(p.population)},${y(p.quality)}`).join(' ');
  const area = `${x(0)},${y(0)} ${curve} ${x(1)},${y(0)}`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-64 w-full max-w-sm" role="img" aria-label="Đường cong Lorenz">
        <polygon points={area} fill="rgb(99 102 241 / 0.12)" />
        <line
          x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)}
          stroke="currentColor" strokeDasharray="4 4" strokeWidth="1"
          className="text-[var(--text-muted)]"
        />
        <polyline points={curve} fill="none" stroke="rgb(99 102 241)" strokeWidth="2.5" />
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="currentColor" strokeWidth="1" className="text-[var(--border-default)]" />
        <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="currentColor" strokeWidth="1" className="text-[var(--border-default)]" />
        <text x={size / 2} y={size - 6} textAnchor="middle" className="fill-[var(--text-muted)] text-[9px]">
          % giáo viên (lịch tệ nhất trước)
        </text>
        <text x={9} y={size / 2} textAnchor="middle" transform={`rotate(-90 9 ${size / 2})`} className="fill-[var(--text-muted)] text-[9px]">
          % tổng chất lượng lịch
        </text>
      </svg>
    </div>
  );
}
