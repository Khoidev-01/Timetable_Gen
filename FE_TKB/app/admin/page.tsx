'use client';

import { Users, School, BookOpen, DoorOpen, CalendarDays, Activity } from 'lucide-react';

const stats = [
  { label: 'Giáo viên', value: '45', icon: Users, gradient: 'from-blue-500 to-blue-600' },
  { label: 'Lớp học', value: '24', icon: School, gradient: 'from-emerald-500 to-emerald-600' },
  { label: 'Môn học', value: '12', icon: BookOpen, gradient: 'from-violet-500 to-violet-600' },
  { label: 'Phòng học', value: '30', icon: DoorOpen, gradient: 'from-amber-500 to-amber-600' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-blue-600/20">
        <div className="flex items-center gap-3 mb-2">
          <CalendarDays size={28} />
          <h1 className="text-2xl md:text-3xl font-bold">TKB Pro</h1>
        </div>
        <p className="text-blue-100 text-sm md:text-base">Hệ thống xếp thời khóa biểu tự động cho trường THPT</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-default)]
              hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <Icon size={20} className="text-white" />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{stat.value}</p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-blue-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Trạng thái Xếp TKB</h3>
          </div>
          <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
            Chưa có dữ liệu xếp lịch
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Hoạt động gần đây</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center text-sm text-[var(--text-secondary)]">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 shrink-0" />
              Đã cập nhật cấu hình ràng buộc
            </li>
            <li className="flex items-center text-sm text-[var(--text-secondary)]">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 shrink-0" />
              Giáo viên đã gửi yêu cầu bận
            </li>
            <li className="flex items-center text-sm text-[var(--text-secondary)]">
              <span className="w-2 h-2 bg-violet-500 rounded-full mr-3 shrink-0" />
              Hệ thống sẵn sàng xếp lịch
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
