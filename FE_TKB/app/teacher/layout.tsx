'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, CalendarDays, Clock, KeyRound, LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import AppLogo from '../components/AppLogo';
import ThemeToggle from '../components/ThemeToggle';

const teacherMenuItems = [
  { name: 'Tổng quan', href: '/teacher', icon: LayoutDashboard },
  { name: 'Thời khóa biểu', href: '/teacher/schedule', icon: CalendarDays },
  { name: 'Đăng ký bận', href: '/teacher/feedback', icon: Clock },
  { name: 'Đổi mật khẩu', href: '/teacher/profile', icon: KeyRound },
];

function TeacherSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 z-30 md:hidden ${collapsed ? 'hidden' : 'block'}`}
        onClick={() => setCollapsed(true)} />

      <div className={`${collapsed ? 'w-[68px]' : 'w-64'} h-full bg-[var(--bg-sidebar)] text-white flex flex-col shadow-xl transition-all duration-200 z-40
        fixed md:relative`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-4 border-b border-white/10`}>
          {!collapsed && <AppLogo size="sm" />}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-sidebar)] transition-colors">
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {teacherMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                  ${isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-medium'
                    : 'text-[var(--text-sidebar)] hover:bg-white/8 hover:text-white'}
                  ${collapsed ? 'justify-center' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-white/10">
          <button onClick={onLogout} title={collapsed ? 'Đăng xuất' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
              text-red-400 hover:bg-red-500/15 hover:text-red-300 ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={20} strokeWidth={1.8} />
            {!collapsed && <span className="text-sm">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </>
  );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) { router.push('/'); return; }
    const userData = JSON.parse(savedUser);
    if (userData.role !== 'TEACHER') { router.push('/'); return; }
    setUser(userData);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-base)] overflow-hidden transition-colors">
      <TeacherSidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]
          flex items-center justify-between px-4 md:px-6 z-10 transition-colors">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Xin chào, <span className="text-[var(--text-primary)] font-semibold">
              {user.full_name || user.ho_ten || user.username}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600
              flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {user.username[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
