'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminSidebar from '../components/admin/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import { Bell, Menu } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) { router.push('/'); return; }
    const userData = JSON.parse(savedUser);
    if (userData.role !== 'ADMIN') { router.push('/'); return; }
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
      <AdminSidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]
          flex items-center justify-between px-4 md:px-6 z-10 transition-colors">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Xin chào, <span className="text-[var(--text-primary)] font-semibold">{user.username}</span>
          </h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="relative w-9 h-9 rounded-lg flex items-center justify-center
              bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600
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
