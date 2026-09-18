'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import AdminSidebar from '../components/admin/Sidebar';
import { Bell, Check, FileSpreadsheet, Calendar, MessageSquare, Clock, Monitor } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useLiveNotifications } from '@/lib/useLiveNotifications';
import { Toaster } from '@/lib/toast';
import AssistantWidget from '../components/AssistantWidget';
import OverlayScrollArea from '../components/ui/OverlayScrollArea';
import { formatDisplayName } from '@/lib/format-display-name';
import UserMenu from '../components/account/UserMenu';

interface Notification {
  id: string;
  category: 'IMPORT' | 'TIMETABLE' | 'FEEDBACK' | 'BUSY_SCHEDULE' | 'SYSTEM';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  IMPORT: { icon: FileSpreadsheet, color: 'text-green-500', label: 'Import' },
  TIMETABLE: { icon: Calendar, color: 'text-blue-500', label: 'TKB' },
  FEEDBACK: { icon: MessageSquare, color: 'text-purple-500', label: 'Phản hồi' },
  BUSY_SCHEDULE: { icon: Clock, color: 'text-orange-500', label: 'Lịch bận' },
  SYSTEM: { icon: Monitor, color: 'text-gray-400', label: 'Hệ thống' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) { router.push('/'); return; }
    const userData = JSON.parse(savedUser);
    if (userData.role !== 'ADMIN') { router.push('/'); return; }
    setUser(userData);
  }, [router]);

  // Nhan day tu may chu thay vi hoi lai moi 30 giay
  const {
    notifications,
    unreadCount,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useLiveNotifications(Boolean(user));

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };



  const filteredNotifications = activeCategory
    ? notifications.filter(n => n.category === activeCategory)
    : notifications;

  if (!user) return null;

  return (
    // data-* attributes drive the print rules on /admin/in. The shell is a fixed-height,
    // overflow-hidden flexbox, which prints as a single clipped screen unless it is
    // unwound first; class names alone could not target it without coupling print CSS to
    // Tailwind utilities that change whenever the layout is restyled.
    <div
      data-app-shell
      className="flex h-[100dvh] w-screen bg-[var(--bg-base)] overflow-hidden transition-colors"
    >
      <div className="grain-overlay" data-print-hide aria-hidden />
      <Toaster />
      <div data-print-hide className="contents">
        <AdminSidebar onLogout={handleLogout} />
      </div>
      <div data-app-main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header data-print-hide className="h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]
          flex items-center justify-between px-4 md:px-6 z-20 transition-colors">
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Xin chào,{' '}
            <span className="text-[var(--text-primary)] font-semibold">
              {formatDisplayName(user.full_name || user.username)}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) fetchNotifications(); }}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center
                  bg-[var(--bg-surface-hover)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                    bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="dropdown-enter absolute right-0 top-full mt-2 w-[28rem] origin-top-right rounded-[var(--radius-md)] border border-[var(--border-default)]
                  bg-[var(--bg-surface)] shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">Thông báo</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">
                        <Check size={12} /> Đọc tất cả
                      </button>
                    )}
                  </div>

                  {/* Category Tabs */}
                  <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[var(--border-default)]">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                        ${!activeCategory ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'}`}
                    >
                      Tất cả
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setActiveCategory(activeCategory === key ? null : key)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                          ${activeCategory === key ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'}`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Notification List */}
                  <div className="dropdown-stagger scrollbar-hidden max-h-80 overflow-y-auto">
                    {filteredNotifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                        <p className="text-sm text-[var(--text-muted)]">Chưa có thông báo nào</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        const cfg = CATEGORY_CONFIG[notif.category ?? 'SYSTEM'] ?? CATEGORY_CONFIG.SYSTEM;
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={`px-4 py-3 flex gap-3 border-b border-[var(--border-light)] cursor-pointer
                              hover:bg-[var(--bg-surface-hover)] transition-colors
                              ${!notif.is_read ? 'bg-[var(--accent-soft)]' : ''}`}
                          >
                            <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {notif.title}
                                </p>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1 opacity-60">{timeAgo(notif.created_at)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <UserMenu
              user={user}
              onLogout={handleLogout}
              onOpenSettings={() => router.push('/admin/configuration')}
              onProfileChange={(account) => account.profile.full_name && setUser({ ...user, full_name: account.profile.full_name })}
            />
          </div>
        </header>

        <OverlayScrollArea data-app-content className="p-4 md:p-6">
          {children}
        </OverlayScrollArea>
        <AssistantWidget />
      </div>
    </div>
  );
}
