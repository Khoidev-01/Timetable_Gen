'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, School, BookOpen, DoorOpen, CalendarDays, ClipboardList, Clock, ArrowRight } from 'lucide-react';
import { API_URL } from '@/lib/api';

const statConfig = [
  { key: 'teachers', label: 'Giáo viên', icon: Users, href: '/admin/teachers' },
  { key: 'classes', label: 'Lớp học', icon: School, href: '/admin/classes' },
  { key: 'subjects', label: 'Môn học', icon: BookOpen, href: '/admin/subjects' },
  { key: 'rooms', label: 'Phòng học', icon: DoorOpen, href: '/admin/configuration' },
];

const quickActions = [
  { label: 'Phân công giảng dạy', desc: 'Nhập phân công hoặc import Excel', icon: ClipboardList, href: '/admin/assignments' },
  { label: 'Xếp thời khóa biểu', desc: 'Chạy thuật toán và chỉnh tay', icon: CalendarDays, href: '/admin/timetable' },
  { label: 'Lịch bận giáo viên', desc: 'Duyệt yêu cầu nghỉ của giáo viên', icon: Clock, href: '/admin/busy-schedule' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, number>>({
    teachers: 0, classes: 0, subjects: 0, rooms: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/resources/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-sidebar)] p-6 md:p-8 text-white shadow-[var(--shadow-lg)]">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--accent)]/25 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3 mb-2">
          <CalendarDays size={28} strokeWidth={1.8} />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">MiKiTimetable</h1>
        </div>
        <p className="relative text-white/70 text-sm md:text-base">
          Hệ thống xếp thời khóa biểu tự động cho trường THPT
        </p>
      </div>

      {/* Stat cards — single accent, tabular numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map((stat, idx) => {
          const Icon = stat.icon;
          const value = stats[stat.key] ?? 0;
          return (
            <Link
              key={stat.key}
              href={stat.href}
              style={{ animationDelay: `${idx * 60}ms` }}
              className="tactile animate-rise group bg-[var(--bg-surface)] p-5 rounded-[var(--radius-md)] border border-[var(--border-default)]
                hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <ArrowRight size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
              </div>
              <p className="font-mono text-3xl font-semibold text-[var(--text-primary)] tabular-nums">
                {loading ? <span className="inline-block h-8 w-12 rounded bg-[var(--bg-surface-hover)] animate-pulse" /> : value}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick actions — real navigation, no fake activity feed */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Tác vụ nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="tactile group flex items-start gap-4 bg-[var(--bg-surface)] p-5 rounded-[var(--radius-md)]
                  border border-[var(--border-default)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
              >
                <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    {action.label}
                    <ArrowRight size={14} className="text-[var(--accent)] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{action.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
