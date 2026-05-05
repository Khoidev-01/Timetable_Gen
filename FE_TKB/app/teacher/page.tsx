'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarDays, Bell, GraduationCap, Clock, CheckCircle, XCircle, Users } from 'lucide-react';
import { API_URL } from '@/lib/api';

const JS_DAY_TO_SYSTEM: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };
const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

export default function TeacherDashboard() {
  const [user, setUser] = useState<any>(null);
  const [todaySlots, setTodaySlots] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem('token') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Profile
      const profileRes = await fetch(`${API_URL}/auth/profile`, { headers: { Authorization: `Bearer ${token()}` } });
      const profile = await profileRes.json();
      setUser(profile);
      const teacherId: string = profile.teacherId || profile.teacher_profile?.id || '';

      // Notifications (latest 5)
      const notifRes = await fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token()}` } });
      if (notifRes.ok) setNotifications((await notifRes.json()).slice(0, 5));

      // Busy requests (pending count)
      const yearsRes = await fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token()}` } });
      const years: any[] = yearsRes.ok ? await yearsRes.json() : [];

      // Find current semester by date
      const now = Date.now();
      let currentSemester: any = null;
      for (const y of years) {
        for (const s of y.semesters ?? []) {
          if (s.start_date && s.end_date) {
            if (new Date(s.start_date).getTime() <= now && now <= new Date(s.end_date).getTime()) {
              currentSemester = s;
              break;
            }
          }
        }
        if (currentSemester) break;
      }
      if (!currentSemester) currentSemester = years[0]?.semesters?.[0];

      if (currentSemester && teacherId) {
        // Compute current week
        let week = 1;
        if (currentSemester.start_date) {
          const msPerWeek = 7 * 24 * 3600 * 1000;
          week = Math.max(1, Math.floor((now - new Date(currentSemester.start_date).getTime()) / msPerWeek) + 1);
        }

        // Fetch timetable for current week
        const tkbRes = await fetch(`${API_URL}/algorithm/result/${currentSemester.id}?week=${week}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (tkbRes.ok) {
          const data = await tkbRes.json();
          const todaySystemDay = JS_DAY_TO_SYSTEM[new Date().getDay()];
          const slots = (data.bestSchedule ?? [])
            .filter((s: any) => s.teacherId === teacherId && s.day === todaySystemDay)
            .sort((a: any, b: any) => a.period - b.period);
          setTodaySlots(slots);
        }

        // Pending busy requests count
        const busyRes = await fetch(`${API_URL}/busy-schedule/my?semesterId=${currentSemester.id}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (busyRes.ok) {
          const busy = await busyRes.json();
          setPendingCount(busy.filter((r: any) => r.status === 'PENDING').length);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayLabel = DAY_LABELS[JS_DAY_TO_SYSTEM[new Date().getDay()]] ?? 'Hôm nay';

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-600/20">
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap size={26} />
          <h1 className="text-2xl font-bold">Cổng Giáo viên</h1>
        </div>
        <p className="text-emerald-100 text-sm">
          {user ? `Xin chào, ${user.full_name || user.username}!` : 'Chúc Thầy/Cô một ngày giảng dạy hiệu quả!'}
        </p>
        {user?.teacher_profile?.homeroom_classes?.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
            <Users size={14} />
            <span className="text-sm font-semibold">
              Chủ nhiệm: {user.teacher_profile.homeroom_classes.map((c: any) => c.name).join(', ')}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Schedule */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
            <CalendarDays size={16} className="text-emerald-500" />
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Lịch dạy {todayLabel}</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-[var(--text-muted)] text-sm italic">Đang tải...</p>
            ) : todaySlots.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm italic">Không có tiết dạy hôm nay</p>
            ) : (
              <div className="space-y-2">
                {todaySlots.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-surface-hover)]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: s.subject?.color || '#059669' }}>
                      {s.period}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.subjectName}</p>
                      <p className="text-xs text-[var(--text-muted)]">Lớp {s.className}{s.roomName ? ` · ${s.roomName}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications + Busy status */}
        <div className="space-y-4">
          {/* Pending busy requests */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Clock size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                {pendingCount} yêu cầu bận đang chờ duyệt
              </p>
            </div>
          )}

          {/* Recent Notifications */}
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
              <Bell size={16} className="text-amber-500" />
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">Thông báo gần đây</h3>
            </div>
            <div>
              {loading ? (
                <p className="px-4 py-4 text-[var(--text-muted)] text-sm italic">Đang tải...</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-4 text-[var(--text-muted)] text-sm italic">Không có thông báo mới</p>
              ) : notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 border-b border-[var(--border-light)] last:border-b-0 ${!n.is_read ? 'bg-blue-500/5' : ''}`}>
                  <div className="flex items-start gap-2">
                    {n.title.includes('✅') || n.status === 'APPROVED' ? (
                      <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                    ) : n.title.includes('❌') ? (
                      <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Bell size={14} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{n.title}</p>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-[var(--text-muted)] opacity-60 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
