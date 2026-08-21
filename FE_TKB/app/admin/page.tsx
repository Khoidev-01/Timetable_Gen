'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  DoorOpen,
  School,
  Users,
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Dashboard {
  counts: { teachers: number; classes: number; subjects: number; rooms: number };
  timetable: {
    exists: boolean;
    isOfficial: boolean;
    score: number | null;
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
  const [isLoading, setIsLoading] = useState(true);

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
      setSemesterName(`${years[0].name} — ${semester.name}`);

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

  const stats = [
    { label: 'Giáo viên', value: data?.counts.teachers, icon: Users, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Lớp học', value: data?.counts.classes, icon: School, gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Môn học', value: data?.counts.subjects, icon: BookOpen, gradient: 'from-violet-500 to-violet-600' },
    { label: 'Phòng học', value: data?.counts.rooms, icon: DoorOpen, gradient: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white shadow-xl shadow-blue-600/20 md:p-8">
        <div className="mb-2 flex items-center gap-3">
          <CalendarDays size={28} />
          <h1 className="text-2xl font-bold md:text-3xl">TKB Pro</h1>
        </div>
        <p className="text-sm text-blue-100 md:text-base">
          Hệ thống xếp thời khóa biểu tự động cho trường THPT
          {semesterName && <span className="ml-2 opacity-80">· {semesterName}</span>}
        </p>
      </div>

      {data?.warnings?.map((warning, index) => (
        <p
          key={index}
          className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-all hover:shadow-lg"
            >
              <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br p-2.5 shadow-lg ${stat.gradient}`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)] md:text-3xl">
                {isLoading ? '…' : (stat.value ?? 0)}
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Trạng thái TKB */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Trạng thái xếp TKB</h3>
          </div>

          {!data?.timetable.exists ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Chưa có dữ liệu xếp lịch</p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Số tiết đã xếp</dt>
                <dd className="font-bold text-[var(--text-primary)]">{data.timetable.slotCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Điểm đánh giá</dt>
                <dd className="font-bold text-[var(--text-primary)]">{data.timetable.score}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Lỗi cứng</dt>
                <dd className={`font-bold ${data.timetable.hardViolations === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data.timetable.hardViolations === 0 ? 'không có' : data.timetable.hardViolations}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Trạng thái</dt>
                <dd className={`font-bold ${data.timetable.isOfficial ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {data.timetable.isOfficial ? 'Đã công bố' : 'Bản nháp'}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Heatmap mật độ tiết */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-1 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Mật độ tiết học</h3>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Đậm hơn = nhiều lớp học cùng lúc hơn</p>

          <div className="flex gap-1 overflow-x-auto">
            {DAYS.map((day) => (
              <div key={day} className="flex-1">
                <p className="mb-1 text-center text-xs text-[var(--text-muted)]">T{day}</p>
                <div className="space-y-0.5">
                  {PERIODS.map((period) => {
                    const cell = data?.heatmap.find((c) => c.day === day && c.period === period);
                    const intensity = (cell?.count ?? 0) / busiest;
                    return (
                      <div
                        key={period}
                        title={`Thứ ${day} · tiết ${period}: ${cell?.count ?? 0} lớp`}
                        className="h-3 rounded-sm"
                        style={{
                          backgroundColor:
                            intensity === 0 ? 'var(--border-light)' : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tải giảng dạy */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users size={18} className="text-violet-500" />
          <h3 className="font-semibold text-[var(--text-primary)]">Tải giảng dạy so với định mức</h3>
        </div>

        {(data?.workload ?? []).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Chưa có dữ liệu</p>
        ) : (
          <ul className="space-y-2">
            {data!.workload.slice(0, 12).map((teacher) => (
              <li
                key={teacher.code}
                title={
                  teacher.ceremonies > 0
                    ? `${teacher.assigned} tiết dạy + ${teacher.ceremonies} tiết chào cờ/sinh hoạt (không tính vào định mức)`
                    : `${teacher.assigned} tiết dạy`
                }
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-32 shrink-0 truncate text-[var(--text-primary)]">{teacher.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--border-light)]">
                  <div
                    className={`h-full rounded-full ${teacher.overQuota ? 'bg-red-500' : 'bg-violet-500'}`}
                    style={{ width: `${Math.min(100, (teacher.assigned / teacher.quota) * 100)}%` }}
                  />
                </div>
                <span className={`w-16 shrink-0 text-right ${teacher.overQuota ? 'font-bold text-red-600' : 'text-[var(--text-muted)]'}`}>
                  {teacher.assigned}/{teacher.quota}
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-[var(--text-muted)]">
                  {teacher.daysAtSchool} ngày/tuần
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sử dụng phòng */}
      {(data?.rooms ?? []).length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <DoorOpen size={18} className="text-amber-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Tỉ lệ lấp đầy phòng</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {data!.rooms.slice(0, 18).map((room) => (
              <div key={room.name} className="rounded-lg bg-[var(--bg-surface-hover)] p-2 text-center">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{room.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{room.used} tiết · {room.rate}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
