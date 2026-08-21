'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, School, GraduationCap, BookOpen, ClipboardList, CalendarDays, LogOut, PanelLeftClose, PanelLeft, Settings, Pin, FlaskConical, AlertTriangle, Lightbulb, Clock, Scale, Printer } from 'lucide-react';
import { useState } from 'react';
import AppLogo from '../AppLogo';

const menuItems = [
  { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
  { name: 'Tài khoản', href: '/admin/accounts', icon: Users },
  { name: 'Lớp học', href: '/admin/classes', icon: School },
  { name: 'Giáo viên', href: '/admin/teachers', icon: GraduationCap },
  { name: 'Môn học', href: '/admin/subjects', icon: BookOpen },
  { name: 'Phân công', href: '/admin/assignments', icon: ClipboardList },
  { name: 'Thời khóa biểu', href: '/admin/timetable', icon: CalendarDays },
  { name: 'Tiết cố định', href: '/admin/fixed-periods', icon: Pin },
  { name: 'Lịch bận GV', href: '/admin/busy-schedule', icon: Clock },
  { name: 'Giáo viên vắng', href: '/admin/absence', icon: AlertTriangle },
  { name: 'Công bằng', href: '/admin/fairness', icon: Scale },
  { name: 'Quy luật ẩn', href: '/admin/mined-rules', icon: Lightbulb },
  { name: 'In thời khóa biểu', href: '/admin/in', icon: Printer },
  { name: 'Thử nghiệm', href: '/admin/benchmark', icon: FlaskConical },
  { name: 'Cấu hình', href: '/admin/configuration', icon: Settings },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      <div className={`fixed inset-0 bg-black/50 z-30 md:hidden ${collapsed ? 'hidden' : 'block'}`}
        onClick={() => setCollapsed(true)} />

      <div className={`${collapsed ? 'w-[68px]' : 'w-64'} h-full bg-[var(--bg-sidebar)] text-white flex flex-col shadow-xl transition-all duration-200 z-40
        fixed md:relative`}>

        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-4 border-b border-white/10`}>
          {!collapsed && <AppLogo size="sm" />}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)]/10 text-[var(--text-sidebar)] transition-colors">
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] tactile
                  ${isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-[var(--shadow-md)]'
                    : 'text-[var(--text-sidebar)] hover:bg-white/[0.06] hover:text-white'
                  }
                  ${collapsed ? 'justify-center' : ''}`}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[var(--accent-contrast)]" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-white/10">
          <button
            onClick={onLogout}
            title={collapsed ? 'Đăng xuất' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-colors
              text-red-400 hover:bg-red-500/15 hover:text-red-300
              ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} strokeWidth={1.8} />
            {!collapsed && <span className="text-sm">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </>
  );
}
