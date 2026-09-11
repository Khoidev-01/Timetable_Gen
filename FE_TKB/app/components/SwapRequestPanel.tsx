'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Check, Inbox, Loader2, X } from 'lucide-react';
import { API_URL } from '@/lib/api';

type SwapStatus =
  | 'PENDING_PARTNER'
  | 'PARTNER_REJECTED'
  | 'PENDING_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

interface SlotSummary {
  when: string;
  subjectName: string;
  className: string;
}

interface SwapRequest {
  id: string;
  status: SwapStatus;
  reason: string;
  partner_note?: string | null;
  admin_note?: string | null;
  requester_teacher_id: string;
  partner_teacher_id: string;
  created_at: string;
  requester_teacher: { code: string; full_name: string };
  partner_teacher: { code: string; full_name: string };
  requester_slot: SlotSummary | null;
  partner_slot: SlotSummary | null;
}

const STATUS: Record<SwapStatus, { label: string; tone: string }> = {
  PENDING_PARTNER: { label: 'Chờ đồng nghiệp trả lời', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  PENDING_ADMIN: { label: 'Chờ quản trị viên duyệt', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  PARTNER_REJECTED: { label: 'Đồng nghiệp từ chối', tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  APPROVED: { label: 'Đã duyệt và áp dụng', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  REJECTED: { label: 'Quản trị viên không duyệt', tone: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  CANCELLED: { label: 'Đã rút lại', tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

/**
 * Swap requests, from whichever side the viewer is on.
 *
 * One component for both roles because the list is the same list - a teacher sees the
 * requests they are part of, an admin sees all of them, and the buttons differ only by what
 * that person is allowed to do next. Splitting it in two would mean two places to keep the
 * status wording honest.
 */
export default function SwapRequestPanel({
  role,
  teacherId,
  semesterId,
}: {
  role: 'ADMIN' | 'TEACHER';
  teacherId?: string;
  semesterId?: string;
}) {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = semesterId ? `?semesterId=${semesterId}` : '';
      const res = await fetch(`${API_URL}/doi-tiet${query}`, { headers: authHeaders() });
      if (res.ok) setRequests(await res.json());
    } catch {
      setError('Không tải được danh sách yêu cầu.');
    } finally {
      setIsLoading(false);
    }
  }, [semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, path: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`${API_URL}/doi-tiet/${id}/${path}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The server re-checks constraints at approval, so this is where a teacher finds
        // out the timetable moved on since they agreed
        setError(payload.message ?? 'Không xử lý được yêu cầu này.');
        return;
      }
      await load();
    } catch {
      setError('Mất kết nối tới máy chủ.');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-default)] p-4">
        <Inbox size={18} className="text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Chưa có yêu cầu đổi tiết nào.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {requests.map((request) => {
        const status = STATUS[request.status];
        const iAmPartner = teacherId === request.partner_teacher_id;
        const iAmRequester = teacherId === request.requester_teacher_id;

        const canAnswer = request.status === 'PENDING_PARTNER' && iAmPartner;
        const canDecide = request.status === 'PENDING_ADMIN' && role === 'ADMIN';
        const canCancel =
          ['PENDING_PARTNER', 'PENDING_ADMIN'].includes(request.status) && (iAmRequester || role === 'ADMIN');

        return (
          <article
            key={request.id}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {request.requester_teacher.full_name}
                <ArrowLeftRight size={15} className="text-[var(--text-muted)]" />
                {request.partner_teacher.full_name}
              </p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                {status.label}
              </span>
            </div>

            {request.requester_slot && request.partner_slot && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg bg-[var(--bg-surface-hover)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <span className="block font-medium text-[var(--text-primary)]">
                    {request.requester_slot.when}
                  </span>
                  {request.requester_slot.subjectName} · {request.requester_slot.className}
                </p>
                <p className="rounded-lg bg-[var(--bg-surface-hover)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  <span className="block font-medium text-[var(--text-primary)]">
                    {request.partner_slot.when}
                  </span>
                  {request.partner_slot.subjectName} · {request.partner_slot.className}
                </p>
              </div>
            )}

            <p className="mt-2 text-sm italic text-[var(--text-muted)]">Lý do: {request.reason}</p>
            {request.partner_note && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Đồng nghiệp ghi: {request.partner_note}
              </p>
            )}
            {request.admin_note && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Quản trị viên ghi: {request.admin_note}
              </p>
            )}

            {(canAnswer || canDecide) && (
              <input
                value={notes[request.id] ?? ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))}
                placeholder="Ghi chú (không bắt buộc)"
                className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
              />
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {canAnswer && (
                <>
                  <button
                    onClick={() => act(request.id, 'tra-loi', { accept: true, note: notes[request.id] ?? '' })}
                    disabled={busyId === request.id}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === request.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Đồng ý đổi
                  </button>
                  <button
                    onClick={() => act(request.id, 'tra-loi', { accept: false, note: notes[request.id] ?? '' })}
                    disabled={busyId === request.id}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
                  >
                    <X size={15} /> Từ chối
                  </button>
                </>
              )}

              {canDecide && (
                <>
                  <button
                    onClick={() => act(request.id, 'duyet', { approve: true, note: notes[request.id] ?? '' })}
                    disabled={busyId === request.id}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busyId === request.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Duyệt và áp dụng
                  </button>
                  <button
                    onClick={() => act(request.id, 'duyet', { approve: false, note: notes[request.id] ?? '' })}
                    disabled={busyId === request.id}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
                  >
                    <X size={15} /> Không duyệt
                  </button>
                </>
              )}

              {canCancel && !canAnswer && !canDecide && (
                <button
                  onClick={() => act(request.id, 'rut-lai', {})}
                  disabled={busyId === request.id}
                  className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
                >
                  Rút lại yêu cầu
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
