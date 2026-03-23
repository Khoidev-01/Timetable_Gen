'use client';

import { CalendarDays, Bell, GraduationCap } from 'lucide-react';

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-emerald-600/20">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap size={28} />
          <h1 className="text-2xl md:text-3xl font-bold">Cổng Giáo viên</h1>
        </div>
        <p className="text-emerald-100 text-sm md:text-base">Chúc Thầy/Cô một ngày giảng dạy hiệu quả!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-emerald-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Lịch dạy hôm nay</h3>
          </div>
          <p className="text-[var(--text-muted)] text-sm italic">Chưa có dữ liệu...</p>
        </div>

        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-amber-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">Thông báo</h3>
          </div>
          <p className="text-[var(--text-muted)] text-sm italic">Không có thông báo mới.</p>
        </div>
      </div>
    </div>
  );
}
