'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Scale, Search } from 'lucide-react';
import { API_URL } from '@/lib/api';
import ParetoCurve from '../../components/admin/ParetoCurve';
import { FilterChips, Pager, usePaged } from '../../components/ui/Paging';

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

type BandKey = 'GOOD' | 'FAIR' | 'AVERAGE' | 'POOR';

/**
 * Bốn mức lịch của một giáo viên (điểm 0-100 so với khối lượng dạy của chính họ).
 * Mức nào cũng có màu riêng để thanh phân bố đọc được ngay mà không cần nhìn số.
 */
const BANDS: Array<{ key: BandKey; label: string; range: string; min: number; bar: string; text: string }> = [
  { key: 'GOOD', label: 'Tốt', range: 'từ 80 điểm', min: 80, bar: 'bg-emerald-500', text: 'text-emerald-700' },
  { key: 'FAIR', label: 'Khá', range: '70-79 điểm', min: 70, bar: 'bg-sky-500', text: 'text-sky-700' },
  { key: 'AVERAGE', label: 'Trung bình', range: '60-69 điểm', min: 60, bar: 'bg-amber-500', text: 'text-amber-700' },
  { key: 'POOR', label: 'Cần xem lại', range: 'dưới 60 điểm', min: 0, bar: 'bg-red-500', text: 'text-red-700' },
];

const bandOf = (quality: number) => BANDS.find((band) => quality >= band.min)!;

/** Kết luận bằng lời cho hệ số Gini - người đọc không cần biết Gini là gì. */
function verdict(gini: number): { title: string; tone: string } {
  if (gini < 0.1) return { title: 'Phần bất tiện được chia rất đồng đều', tone: 'text-emerald-700' };
  if (gini < 0.2) return { title: 'Phần bất tiện được chia khá đồng đều', tone: 'text-emerald-700' };
  if (gini < 0.3) return { title: 'Có chênh lệch đáng kể giữa các giáo viên', tone: 'text-amber-700' };
  return { title: 'Chênh lệch lớn: một số giáo viên gánh phần lớn bất tiện', tone: 'text-red-700' };
}

const CARD = 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6';

/** Mỗi dòng của bảng từng giáo viên cao bằng nhau, để bảng không co giãn khi chuyển trang hay lọc. */
const TEACHER_ROW_HEIGHT = '4.5rem';

/** Số người mỗi trang ở danh sách nên ưu tiên xem lại: vừa để khung này cao bằng khung bên cạnh. */
const WORST_OFF_PAGE_SIZE = 3;

export default function FairnessPage() {
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [semesterId, setSemesterId] = useState('');
  const [band, setBand] = useState<BandKey | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

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

  const teachers = useMemo(() => report?.teachers ?? [], [report]);

  const bandCounts = useMemo(() => {
    const counts: Record<BandKey, number> = { GOOD: 0, FAIR: 0, AVERAGE: 0, POOR: 0 };
    for (const teacher of teachers) counts[bandOf(teacher.quality).key]++;
    return counts;
  }, [teachers]);

  // Mỗi loại bất tiện: bao nhiêu giáo viên gặp, bao nhiêu lần, mất tổng bao nhiêu điểm
  const burdenTotals = useMemo(() => {
    const totals = new Map<string, { label: string; teachers: number; count: number; cost: number }>();
    for (const teacher of teachers) {
      for (const burden of teacher.burdens) {
        const entry = totals.get(burden.label) ?? { label: burden.label, teachers: 0, count: 0, cost: 0 };
        entry.teachers++;
        entry.count += burden.count;
        entry.cost += burden.cost;
        totals.set(burden.label, entry);
      }
    }
    return [...totals.values()].sort((a, b) => b.cost - a.cost);
  }, [teachers]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    return teachers.filter(
      (teacher) =>
        (band === 'ALL' || bandOf(teacher.quality).key === band) &&
        (!needle ||
          teacher.name.toLocaleLowerCase('vi').includes(needle) ||
          teacher.code.toLocaleLowerCase('vi').includes(needle)),
    );
  }, [teachers, band, query]);
  const paged = usePaged(filtered);
  const worstPaged = usePaged(report?.worstOff ?? [], WORST_OFF_PAGE_SIZE);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tính…</p>;
  }

  if (!report || teachers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-default)] p-10 text-center">
        <Scale size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-primary)]">Chưa có thời khóa biểu để đánh giá</p>
      </div>
    );
  }

  const reading = verdict(report.gini);
  const atLeastFair = bandCounts.GOOD + bandCounts.FAIR;
  const maxBurdenCost = burdenTotals[0]?.cost ?? 1;

  const chooseBand = (key: BandKey | 'ALL') => {
    setBand(key);
    paged.setPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Tiêu đề */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <Scale size={24} className="text-indigo-500" />
            Công bằng giữa các giáo viên
          </h1>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <RefreshCw size={15} />
            Tính lại
          </button>
        </div>
        <p data-page-description className="mt-1 text-sm text-[var(--text-muted)]">
          Mỗi giáo viên được chấm lịch dạy từ 0 đến 100, so với chính số tiết của họ. Trang này cho
          biết bất tiện (tiết trống, tiết cuối buổi, đi lại nhiều buổi...) có dồn vào ai không.
        </p>
      </div>

      {/* 1. Nhận định chung + phân bố */}
      <section className={CARD} aria-labelledby="fairness-verdict">
        <h2 id="fairness-verdict" className={`text-2xl font-bold ${reading.tone}`}>
          {reading.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">{atLeastFair}/{teachers.length}</strong> giáo viên có lịch từ mức Khá
          trở lên. Lịch tốt nhất <strong className="text-[var(--text-primary)]">{report.summary.best}</strong> điểm, tệ nhất{' '}
          <strong className="text-[var(--text-primary)]">{report.summary.worst}</strong> điểm, người ở giữa{' '}
          <strong className="text-[var(--text-primary)]">{report.summary.median}</strong> điểm.
        </p>

        <div className="mt-6">
          <div className="flex h-10 w-full overflow-hidden rounded-lg" role="img" aria-label="Phân bố giáo viên theo mức lịch">
            {BANDS.map((item) =>
              bandCounts[item.key] > 0 ? (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => chooseBand(item.key)}
                  title={`${item.label}: ${bandCounts[item.key]} giáo viên - bấm để lọc bảng bên dưới`}
                  className={`${item.bar} flex items-center justify-center text-sm font-semibold text-white transition-opacity hover:opacity-85`}
                  style={{ width: `${(bandCounts[item.key] / teachers.length) * 100}%` }}
                >
                  {bandCounts[item.key]}
                </button>
              ) : null,
            )}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            {BANDS.map((item) => (
              <li key={item.key} className="flex items-start gap-2">
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${item.bar}`} aria-hidden="true" />
                <span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {item.label}: {bandCounts[item.key]} giáo viên
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{item.range}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Đường cong Lorenz và hệ số Gini: cùng câu trả lời ở trên, dưới dạng hình */}
      <section className={CARD} aria-labelledby="fairness-lorenz">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="fairness-lorenz" className="font-semibold text-[var(--text-primary)]">
              Đường cong Lorenz
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Xếp giáo viên từ lịch kém nhất đến tốt nhất rồi cộng dồn. Đường chéo nét đứt là chia đều tuyệt
              đối; đường cong càng võng xa đường chéo thì bất tiện càng dồn vào ít người.
            </p>
            <div className="mt-4 border-t border-[var(--border-light)] pt-4">
              <p className="text-sm text-[var(--text-muted)]">Hệ số Gini</p>
              <p className={`text-3xl font-bold ${reading.tone}`}>{report.gini.toFixed(3).replace('.', ',')}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Đo độ hở giữa đường chéo và đường cong: 0 là mọi giáo viên có lịch tốt như nhau, càng
                gần 1 càng chênh lệch. Dưới 0,1 là rất đồng đều, từ 0,3 trở lên là chênh lệch lớn. Điều đáng xem
                là con số này tăng hay giảm khi xếp lại thời khóa biểu.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            <LorenzCurve points={report.lorenz} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 2. Điều gây bất tiện */}
        <section className={CARD} aria-labelledby="fairness-burdens">
          <h2 id="fairness-burdens" className="font-semibold text-[var(--text-primary)]">
            Điều gây bất tiện nhiều nhất
          </h2>
          <p className="mb-4 mt-1 text-sm text-[var(--text-muted)]">
            Tổng số điểm bị trừ trên toàn trường. Sửa được loại đứng đầu là cải thiện lịch cho nhiều người nhất.
          </p>
          <ul className="space-y-4">
            {burdenTotals.map((burden) => (
              <li key={burden.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--text-primary)]">{burden.label}</span>
                  <span className="shrink-0 text-[var(--text-muted)]">
                    {burden.teachers} giáo viên · {burden.count} lần · −{burden.cost} điểm
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--border-light)]">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(burden.cost / maxBurdenCost) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Người cần ưu tiên */}
        <section className={`${CARD} flex flex-col`} aria-labelledby="fairness-worst">
          <h2 id="fairness-worst" className="font-semibold text-[var(--text-primary)]">
            Giáo viên nên ưu tiên xem lại
          </h2>
          <p className="mb-4 mt-1 text-sm text-[var(--text-muted)]">
            {report.worstOff.length} người có lịch dưới mức Khá, điều làm tuần của họ nặng nhất và cách gỡ.
          </p>
          <ol className="flex-1 divide-y divide-[var(--border-light)]">
            {worstPaged.visible.map((teacher, offset) => {
              const index = worstPaged.pageStart + offset;
              const level = bandOf(teacher.quality);
              return (
                <li key={teacher.teacherId} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="w-5 shrink-0 pt-0.5 text-sm font-semibold text-[var(--text-muted)]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold text-[var(--text-primary)]">{teacher.name}</span>
                      <span className={`text-sm font-semibold ${level.text}`}>
                        {teacher.quality} điểm · {level.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{teacher.biggestBurden}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">Gợi ý: {teacher.suggestion}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="-mx-6 -mb-6 mt-4">
            <Pager paged={worstPaged} noun="giáo viên" label="Phân trang giáo viên nên ưu tiên xem lại" />
          </div>
        </section>
      </div>

      {/* 4. Bảng tra cứu */}
      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" aria-labelledby="fairness-table">
        <div className="space-y-3 p-6 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="fairness-table" className="font-semibold text-[var(--text-primary)]">
                Lịch của từng giáo viên
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Xếp từ lịch kém nhất đến tốt nhất.</p>
            </div>
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Tìm giáo viên</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  paged.setPage(1);
                }}
                placeholder="Tìm theo tên hoặc mã..."
                className="min-h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
          </div>
          <FilterChips
            label="Lọc giáo viên theo mức lịch"
            value={band}
            onChange={chooseBand}
            options={[
              { value: 'ALL', label: 'Tất cả', count: teachers.length },
              ...BANDS.map((item) => ({ value: item.key, label: item.label, count: bandCounts[item.key] })),
            ]}
          />
        </div>

        <table className="data-table">
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '36%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Mã GV</th>
              <th>Họ và tên</th>
              <th>Số tiết</th>
              <th>Điểm lịch</th>
              <th>Bất tiện gặp phải</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr style={{ height: TEACHER_ROW_HEIGHT }}>
                <td colSpan={5} className="text-center text-sm text-[var(--text-muted)]">
                  Không có giáo viên nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              paged.visible.map((teacher) => {
                const level = bandOf(teacher.quality);
                return (
                  <tr key={teacher.teacherId} style={{ height: TEACHER_ROW_HEIGHT }}>
                    <td>{teacher.code}</td>
                    <td className="text-[var(--text-primary)]">{teacher.name}</td>
                    <td className="text-center">{teacher.periods}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-2 min-w-10 flex-1 overflow-hidden rounded-full bg-[var(--border-light)]">
                          <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${teacher.quality}%` }} />
                        </div>
                        <span className="shrink-0 whitespace-nowrap">
                          {teacher.quality} · {level.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      {teacher.burdens.length === 0 ? (
                        'Không có'
                      ) : (
                        // Dài quá hai dòng thì cắt bớt, rê chuột để xem đủ - giữ mọi dòng cao bằng nhau
                        <span
                          className="line-clamp-2"
                          title={teacher.burdens.map((burden) => `${burden.label} (${burden.count} lần)`).join(', ')}
                        >
                          {teacher.burdens.map((burden) => `${burden.label} (${burden.count} lần)`).join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            {/* Trang thiếu dòng thì chèn dòng trống cho đủ, để bảng không thu lại */}
            {Array.from({ length: paged.pageSize - Math.max(1, paged.visible.length) }, (_, i) => (
              <tr key={`filler-${i}`} aria-hidden="true" style={{ height: TEACHER_ROW_HEIGHT }}>
                <td colSpan={5} />
              </tr>
            ))}
          </tbody>
        </table>
        <Pager paged={paged} noun="giáo viên" label="Phân trang giáo viên" keepVisible />
      </section>

      {semesterId && <ParetoCurve semesterId={semesterId} />}

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
  );
}
