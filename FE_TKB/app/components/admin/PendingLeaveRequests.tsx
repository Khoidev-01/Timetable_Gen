'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, X } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface LeaveRequest {
  id: string;
  teacher_id: string;
  week_number: number;
  day_of_week: number;
  period: number;
  reason: string;
  created_at: string;
  teacher: { full_name: string; code: string };
}

const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};

/**
 * Leave requests waiting on a decision, where the decision is acted on.
 *
 * Approving used to happen on a different screen from planning the cover, so an admin
 * could approve a week of absence and never be shown the classes it left uncovered.
 * Approving here refreshes the coverage planner below with the date it resolves to.
 */
export default function PendingLeaveRequests({
  semesterId,
  onApproved,
}: {
  semesterId: string;
  onApproved: (teacherId: string, date: string) => void;
}) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    if (!semesterId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/busy-schedule?semesterId=${semesterId}&status=PENDING`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;

      const list: LeaveRequest[] = await res.json();
      setRequests(list);

      // Ask the server which calendar date each week/day resolves to, rather than
      // repeating the semester-week arithmetic in the browser and risking a different answer
      const resolved: Record<string, string> = {};
      await Promise.all(
        list.map(async (request) => {
          try {
            const preview = await fetch(
              `${API_URL}/schedule/absence-request/${request.id}/preview`,
              { headers: authHeaders() },
            );
            if (preview.ok) resolved[request.id] = (await preview.json()).date;
          } catch {
            /* a request with no resolvable date still shows, just without one */
          }
        }),
      );
      setDates(resolved);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (request: LeaveRequest, approve: boolean) => {
    setBusyId(request.id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/busy-schedule/${request.id}/${approve ? 'approve' : 'reject'}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: approve ? undefined : JSON.stringify({ note: 'Không sắp xếp được' }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.message ?? 'Không xử lý được đơn này');
        return;
      }
      if (approve && body.absence?.note) setError(body.absence.note);

      const date = dates[request.id];
      if (approve && date) onApproved(request.teacher_id, date);
      await load();
    } catch {
      setError('Không kết nối được máy chủ');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
        Đang tải đơn xin nghỉ…
      </p>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-default)] p-4">
        <Inbox size={18} className="text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Không có đơn xin nghỉ nào đang chờ duyệt.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <Inbox size={18} className="text-amber-500" />
        <h2 className="font-semibold text-[var(--text-primary)]">
          Đơn xin nghỉ chờ duyệt ({requests.length})
        </h2>
      </div>
      <p className="mb-4 text-xs text-[var(--text-muted)]">
        Duyệt xong, hệ thống tự ghi vào lịch hiệu lực và mở luôn phần phân dạy thay bên dưới.
      </p>

      {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      <ul className="space-y-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--bg-surface-hover)] p-3"
          >
            <div className="min-w-48 flex-1">
              <p className="font-medium text-[var(--text-primary)]">
                {request.teacher.full_name}{' '}
                <span className="text-xs text-[var(--text-muted)]">({request.teacher.code})</span>
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Tuần {request.week_number} · {DAY_LABEL[request.day_of_week]} · tiết {request.period}
                {dates[request.id] && (
                  <span className="ml-1 text-[var(--text-primary)]">
                    = {new Date(`${dates[request.id]}T00:00:00`).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm italic text-[var(--text-muted)]">{request.reason}</p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => decide(request, true)}
                disabled={busyId === request.id}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busyId === request.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Duyệt
              </button>
              <button
                onClick={() => decide(request, false)}
                disabled={busyId === request.id}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-50"
              >
                <X size={15} />
                Từ chối
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
