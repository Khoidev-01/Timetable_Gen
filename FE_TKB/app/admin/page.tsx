'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Users,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { GradeBadge } from '../components/admin/QualityGrade';

interface Dashboard {
  counts: { teachers: number; classes: number; subjects: number; rooms: number };
  timetable: {
    exists: boolean;
    isOfficial: boolean;
    grade: string | null;
    hardViolations: number;
    slotCount: number;
    generatedAt: string | null;
  };
  heatmap: Array<{ day: number; period: number; count: number }>;
  workload: Array<{ code: string; name: string; assigned: number; ceremonies: number; quota: number; daysAtSchool: number; overQuota: boolean }>;
  rooms: Array<{ name: string; type: string; used: number; rate: number }>;
  warnings: string[];
}

const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [semesterName, setSemesterName] = useState('');
  const [yearName, setYearName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const yearRes = await fetch(`${API_URL}/system/years`, { headers: authHeaders() });
      if (!yearRes.ok) return;

      const years = await yearRes.json();
      const semester = years[0]?.semesters?.[0];
      if (!semester) return;
      // "HK1" -> "Học Kỳ 1"; tên khác kiểu đó thì giữ nguyên
      setSemesterName(semester.name.replace(/^HK\s*(\d+)$/i, 'Học Kỳ $1'));
      setYearName(years[0].name);

      const res = await fetch(`${API_URL}/algorithm/dashboard/${semester.id}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const busiest = useMemo(
    () => Math.max(1, ...(data?.heatmap ?? []).map((cell) => cell.count)),
    [data],
  );

  const warnings = useMemo(
    () => Array.from(new Set(data?.warnings ?? [])),
    [data?.warnings],
  );

  const visibleWarnings = warningsExpanded ? warnings : warnings.slice(0, 3);

  const workloadChart = useMemo(
    () => [...(data?.workload ?? [])].sort((a, b) => b.assigned - a.assigned).slice(0, 10),
    [data?.workload],
  );

  const maxAssigned = useMemo(
    () => Math.max(1, ...workloadChart.map((teacher) => teacher.assigned)),
    [workloadChart],
  );

  const roomChart = useMemo(
    () => [...(data?.rooms ?? [])].sort((a, b) => b.rate - a.rate).slice(0, 12),
    [data?.rooms],
  );

  const roomAxisMax = useMemo(
    () => Math.max(100, Math.ceil(Math.max(0, ...roomChart.map((room) => room.rate)) / 100) * 100),
    [roomChart],
  );

  const stats = [
    { label: 'Giáo viên', value: data?.counts.teachers, image: '/images/dashboard/kpi/teachers-3d.png' },
    { label: 'Lớp học', value: data?.counts.classes, image: '/images/dashboard/kpi/classes-3d.png' },
    { label: 'Môn học', value: data?.counts.subjects, image: '/images/dashboard/kpi/subjects-3d.png' },
    { label: 'Phòng học', value: data?.counts.rooms, image: '/images/dashboard/kpi/rooms-3d.png' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
      <div className="relative min-h-[184px] overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-600 via-blue-600 to-violet-700 p-5 text-white shadow-lg shadow-blue-600/15 md:p-7">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <Image
          src="/images/dashboard/timetable-hero-3d.png"
          alt=""
          width={1536}
          height={1024}
          priority
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 right-28 hidden w-[460px] select-none drop-shadow-2xl lg:block xl:right-40 xl:w-[520px]"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <div className="flex items-center gap-3">
              <Image
                src="/favicon.svg?v=2"
                alt="Logo MiKiTimetable"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl ring-1 ring-white/30"
              />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">MiKiTimetable</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-blue-100 md:text-base">
              Hệ thống xếp thời khóa biểu tự động cho trường THPT
            </p>
            {semesterName && (
              <div data-current-semester className="mt-4 w-fit rounded-xl border border-white/20 bg-black/10 px-4 py-2.5 text-sm backdrop-blur-sm">
                <p className="text-xs text-blue-100">Học kỳ hiện tại</p>
                <p className="mt-0.5 font-semibold">{semesterName}</p>
                <p className="text-blue-100">Năm học: {yearName}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 text-amber-950 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-amber-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">Cảnh báo dữ liệu cần kiểm tra</h2>
                <p className="text-xs text-amber-700">Các cảnh báo không chặn bạn xem số liệu tổng quan.</p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-amber-200/70 px-2.5 py-1 text-xs font-bold text-amber-800">
              {warnings.length} cảnh báo
            </span>
          </div>

          <div className={warningsExpanded ? 'max-h-72 overflow-y-auto' : ''}>
            {visibleWarnings.map((warning, index) => (
              <div
                key={`${warning}-${index}`}
                className="flex items-start gap-3 border-b border-amber-200/60 px-4 py-2.5 text-sm last:border-b-0"
              >
                <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-800">
                  {index + 1}
                </span>
                <p className="min-w-0 leading-5 text-amber-900">{warning}</p>
              </div>
            ))}
          </div>

          {warnings.length > 3 && (
            <button
              type="button"
              onClick={() => setWarningsExpanded((current) => !current)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-amber-200 bg-amber-100/60 px-4 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
              aria-expanded={warningsExpanded}
            >
              {warningsExpanded ? (
                <>Thu gọn <ChevronUp size={16} /></>
              ) : (
                <>Xem thêm {warnings.length - 3} cảnh báo <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
            <div
              key={stat.label}
              className="group flex min-h-24 items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-[var(--text-primary)] md:text-3xl">
                  {isLoading ? '…' : (stat.value ?? 0)}
                </p>
              </div>
              <div className="relative h-16 w-16 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Image
                  src={stat.image}
                  alt={`Biểu tượng ${stat.label.toLowerCase()}`}
                  fill
                  sizes="64px"
                  className="object-contain drop-shadow-[0_8px_12px_rgba(37,99,235,0.16)]"
                />
              </div>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* Trạng thái TKB */}
        <div className="relative min-h-[190px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] bg-[radial-gradient(circle_at_82%_50%,rgba(59,130,246,0.10),transparent_42%)] p-6">
          <div className="pointer-events-none absolute inset-y-3 right-4 hidden w-[42%] max-w-[280px] select-none sm:block" aria-hidden="true">
            <Image
              src="/images/dashboard/analytics-status-3d.png"
              alt=""
              fill
              sizes="(min-width: 1280px) 280px, 42vw"
              className="object-contain drop-shadow-[0_16px_24px_rgba(37,99,235,0.18)]"
            />
          </div>
          <div className="relative z-10 sm:max-w-[56%]">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={18} className="text-blue-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">Trạng thái xếp TKB</h3>
            </div>

            {!data?.timetable.exists ? (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">Chưa có dữ liệu xếp lịch</p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Số tiết đã xếp</dt>
                  <dd className="font-bold text-[var(--text-primary)]">{data.timetable.slotCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Chất lượng</dt>
                  <dd>
                    <GradeBadge grade={data.timetable.grade} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Lỗi cứng</dt>
                  <dd className={`font-bold ${data.timetable.hardViolations === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {data.timetable.hardViolations === 0 ? 'Không có' : data.timetable.hardViolations}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Trạng thái</dt>
                  <dd className={`font-bold ${data.timetable.isOfficial ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {data.timetable.isOfficial ? 'Đã công bố' : 'Bản nháp'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>

        {/* Heatmap mật độ tiết */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-1 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Mật độ tiết học</h3>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Số lớp học đồng thời theo ngày và tiết</p>

          <div className="overflow-x-auto">
            <div
              className="grid min-w-[520px] grid-cols-[36px_repeat(6,minmax(56px,1fr))] gap-1"
              role="img"
              aria-label="Biểu đồ nhiệt mật độ tiết học từ thứ hai đến thứ bảy"
            >
              <span />
              {DAYS.map((day) => (
                <span key={day} className="pb-1 text-center text-xs font-medium text-[var(--text-muted)]">Thứ {day}</span>
              ))}
              {PERIODS.map((period) => (
                <div key={period} className="contents">
                  <span className="flex h-5 items-center text-xs text-[var(--text-muted)]">T{period}</span>
                  {DAYS.map((day) => {
                    const cell = data?.heatmap.find((item) => item.day === day && item.period === period);
                    const count = cell?.count ?? 0;
                    const intensity = count / busiest;
                    return (
                      <div
                        key={`${day}-${period}`}
                        title={`Thứ ${day} · tiết ${period}: ${count} lớp`}
                        aria-label={`Thứ ${day}, tiết ${period}: ${count} lớp`}
                        className="h-5 rounded"
                        style={{
                          backgroundColor:
                            intensity === 0 ? 'var(--border-light)' : `rgba(16, 185, 129, ${0.16 + intensity * 0.84})`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-[var(--text-muted)]">
            <span>Ít lớp</span>
            {[0.18, 0.38, 0.62, 0.86, 1].map((opacity) => (
              <span key={opacity} className="h-3 w-5 rounded-sm" style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})` }} />
            ))}
            <span>Nhiều lớp</span>
          </div>
        </div>
      </div>

      {/* Tải giảng dạy */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-violet-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">Tải giảng dạy so với định mức</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">10 giáo viên có số tiết được phân công cao nhất</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-violet-500" />Trong định mức</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-red-500" />Vượt định mức</span>
            <span className="flex items-center gap-1.5"><span className="h-4 w-0.5 bg-slate-700" />Mốc định mức</span>
          </div>
        </div>

        {workloadChart.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Chưa có dữ liệu</p>
        ) : (
          <ul className="space-y-3" role="img" aria-label="Biểu đồ tải giảng dạy theo giáo viên">
            {workloadChart.map((teacher) => {
              const assignedWidth = (teacher.assigned / maxAssigned) * 100;
              const quotaPosition = Math.min(100, (teacher.quota / maxAssigned) * 100);
              return (
              <li
                key={teacher.code}
                title={
                  teacher.ceremonies > 0
                    ? `${teacher.assigned} tiết dạy + ${teacher.ceremonies} tiết chào cờ/sinh hoạt (không tính vào định mức)`
                    : `${teacher.assigned} tiết dạy`
                }
                className="grid grid-cols-[minmax(92px,150px)_minmax(140px,1fr)_70px] items-center gap-3 text-sm"
              >
                <span className="truncate text-[var(--text-primary)]">{teacher.name}</span>
                <div className="relative h-5 overflow-hidden rounded-md bg-[var(--border-light)]">
                  <div
                    className={`h-full rounded-md ${teacher.overQuota ? 'bg-red-500' : 'bg-violet-500'}`}
                    style={{ width: `${assignedWidth}%` }}
                  />
                  <span
                    className="absolute inset-y-0 w-0.5 bg-slate-800 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]"
                    style={{ left: `${quotaPosition}%` }}
                    aria-hidden
                  />
                </div>
                <span className={`text-right tabular-nums ${teacher.overQuota ? 'font-bold text-red-600' : 'text-[var(--text-muted)]'}`}>
                  {teacher.assigned}/{teacher.quota}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sử dụng phòng */}
      {roomChart.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <DoorOpen size={18} className="text-blue-500" />
              <h3 className="font-semibold text-[var(--text-primary)]">Tỷ lệ sử dụng phòng học</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">12 phòng có tỷ lệ sử dụng cao nhất</p>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="relative min-w-[760px] border-b border-l border-[var(--border-default)] px-4 pt-5">
              {[1, 0.75, 0.5, 0.25].map((ratio) => (
                <div
                  key={ratio}
                  className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--border-light)]"
                  style={{ bottom: `${ratio * 100}%` }}
                >
                  <span className="absolute -left-1 -translate-x-full -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                    {Math.round(roomAxisMax * ratio)}%
                  </span>
                </div>
              ))}
              <div
                className="grid h-52 grid-cols-12 items-end gap-3"
                role="img"
                aria-label="Biểu đồ cột tỷ lệ sử dụng phòng học"
              >
                {roomChart.map((room) => (
                  <div key={room.name} className="flex h-full min-w-0 flex-col justify-end text-center">
                    <span className="mb-1 text-[11px] font-semibold tabular-nums text-blue-700">{room.rate}%</span>
                    <div
                      className="mx-auto w-full max-w-10 rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 transition-opacity hover:opacity-80"
                      style={{ height: `${Math.max(3, (room.rate / roomAxisMax) * 100)}%` }}
                      title={`${room.name}: ${room.used} tiết, tỷ lệ ${room.rate}%`}
                      aria-label={`${room.name}: ${room.used} tiết, tỷ lệ ${room.rate}%`}
                    />
                    <span className="mt-2 truncate text-[11px] font-medium text-[var(--text-secondary)]" title={room.name}>{room.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
