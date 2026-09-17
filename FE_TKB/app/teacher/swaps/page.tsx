'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, Send } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { describeChange } from '../../components/admin/QualityGrade';
import SwapRequestPanel from '../../components/SwapRequestPanel';

interface Slot {
  id: string;
  day: number;
  period: number;
  subject?: { name: string };
  subjectName?: string;
  className?: string;
  teacherId: string;
  is_locked?: boolean;
}

interface Suggestion {
  slotId: string;
  teacherName: string;
  subjectName: string;
  className: string;
  day: number;
  period: number;
  scoreDelta: number;
  feasible: boolean;
}

const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};

/**
 * A teacher arranging a trade with a colleague.
 *
 * The suggestions come from the server's own constraint check, so a teacher is never
 * offered a trade the admin would have to refuse - and when one does get refused later, it
 * is because the timetable genuinely moved on, not because the two screens disagreed.
 */
export default function TeacherSwapsPage() {
  const [mySlots, setMySlots] = useState<Slot[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [partner, setPartner] = useState<Suggestion | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const me = await fetch(`${API_URL}/auth/profile`, { headers: authHeaders() });
      if (!me.ok) return;
      const profile = await me.json();
      const id = profile.teacherId ?? profile.teacher_profile?.id;
      if (!id) return;
      setTeacherId(id);

      const years = await (await fetch(`${API_URL}/system/years`, { headers: authHeaders() })).json();
      const semester = years.flatMap((year: any) => year.semesters ?? [])[0];
      if (!semester) return;
      setSemesterId(semester.id);

      const result = await (
        await fetch(`${API_URL}/algorithm/result/${semester.id}`, { headers: authHeaders() })
      ).json();

      // A locked period cannot be traded, so it is left out here rather than shown and
      // then refused three clicks later
      setMySlots(
        (result.bestSchedule ?? []).filter((slot: Slot) => slot.teacherId === id && !slot.is_locked),
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickSlot = async (slot: Slot) => {
    setChosen(slot);
    setPartner(null);
    setSuggestions(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/doi-tiet/goi-y/${slot.id}`, { headers: authHeaders() });
      const body = await res.json().catch(() => []);
      setSuggestions(res.ok ? body : []);
      if (!res.ok) setMessage({ text: body.message ?? 'Không lấy được gợi ý.', ok: false });
    } catch {
      setMessage({ text: 'Mất kết nối tới máy chủ.', ok: false });
    }
  };

  const send = async () => {
    if (!chosen || !partner) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/doi-tiet`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ requesterSlotId: chosen.id, partnerSlotId: partner.slotId, reason }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ text: body.message ?? 'Không gửi được yêu cầu.', ok: false });
        return;
      }
      setMessage({ text: `Đã gửi yêu cầu tới ${partner.teacherName}, chờ trả lời.`, ok: true });
      setChosen(null);
      setPartner(null);
      setSuggestions(null);
      setReason('');
      setReloadKey((k) => k + 1);
    } catch {
      setMessage({ text: 'Mất kết nối tới máy chủ.', ok: false });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <ArrowLeftRight size={24} className="text-blue-500" />
          Đổi tiết với đồng nghiệp
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Chọn tiết của bạn, hệ thống gợi ý những tiết đổi được mà không sinh lỗi. Đồng nghiệp
          đồng ý rồi quản trị viên duyệt thì thời khóa biểu mới thay đổi.
        </p>
      </div>

      {message && (
        <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="mb-3 font-semibold text-[var(--text-primary)]">1. Chọn tiết của bạn</h2>

        {mySlots.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Bạn chưa có tiết nào trong thời khóa biểu.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...mySlots]
              .sort((a, b) => a.day - b.day || a.period - b.period)
              .map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => pickSlot(slot)}
                  className={`rounded-lg border-2 px-3 py-2 text-left text-sm transition-all ${
                    chosen?.id === slot.id
                      ? 'border-blue-600 bg-blue-500/10'
                      : 'border-[var(--border-default)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <span className="block font-medium text-[var(--text-primary)]">
                    {DAY_LABEL[slot.day]} · tiết {slot.period}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {slot.subject?.name ?? slot.subjectName} · {slot.className}
                  </span>
                </button>
              ))}
          </div>
        )}
      </section>

      {chosen && (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-1 font-semibold text-[var(--text-primary)]">2. Chọn tiết muốn đổi</h2>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Chỉ hiện những tiết đổi được mà không sinh lỗi cứng. Nhãn bên phải cho biết thời khóa
            biểu chung sẽ tốt hơn hay kém đi sau khi đổi.
          </p>

          {suggestions === null ? (
            <p className="text-sm text-[var(--text-muted)]">Đang tìm…</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Không có tiết nào đổi được với tiết này mà không sinh lỗi.
            </p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((option) => (
                <li key={option.slotId}>
                  <button
                    onClick={() => setPartner(option)}
                    className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                      partner?.slotId === option.slotId
                        ? 'border-blue-600 bg-blue-500/10'
                        : 'border-[var(--border-default)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {option.teacherName} · {option.subjectName} {option.className}
                      </span>
                      <span className={`text-sm ${describeChange(option.scoreDelta)?.tone}`}>
                        {describeChange(option.scoreDelta)?.text}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">
                      {DAY_LABEL[option.day]} · tiết {option.period}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {chosen && partner && (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="mb-3 font-semibold text-[var(--text-primary)]">3. Gửi yêu cầu</h2>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do xin đổi - đồng nghiệp sẽ đọc dòng này"
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button
            onClick={send}
            disabled={isBusy || reason.trim().length < 3}
            className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Gửi cho {partner.teacherName}
          </button>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-[var(--text-primary)]">Yêu cầu của bạn</h2>
        <SwapRequestPanel key={reloadKey} role="TEACHER" teacherId={teacherId} semesterId={semesterId} />
      </section>
    </div>
  );
}
