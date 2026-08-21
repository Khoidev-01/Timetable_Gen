'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { API_URL } from '@/lib/api';

type CoverageMode = 'SUBSTITUTE' | 'MERGED' | 'SELF_STUDY' | 'CANCELLED';

interface Candidate {
  teacherId: string;
  teacherName: string;
  code: string;
  reason: string;
}

interface Period {
  slotId: string;
  period: number;
  className: string;
  subjectName: string;
  roomName?: string;
  candidates: Candidate[];
}

const FALLBACKS: Array<{ mode: CoverageMode; label: string }> = [
  { mode: 'MERGED', label: 'Ghép lớp' },
  { mode: 'SELF_STUDY', label: 'Tự học có giám thị' },
  { mode: 'CANCELLED', label: 'Cho nghỉ tiết' },
];

/**
 * The 6:45 problem: a teacher rings in sick and the first period starts at 7:00.
 * Schools solve this with a paper register and a phone; this turns it into one screen.
 */
export default function AbsencePage() {
  const [years, setYears] = useState<any[]>([]);
  const [semesterId, setSemesterId] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [choice, setChoice] = useState<Record<string, { mode: CoverageMode; substituteTeacherId?: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    try {
      const [yearRes, teacherRes] = await Promise.all([
        fetch(`${API_URL}/system/years`, { headers: authHeaders() }),
        fetch(`${API_URL}/resources/teachers`, { headers: authHeaders() }),
      ]);
      if (yearRes.ok) {
        const data = await yearRes.json();
        setYears(data);
        setSemesterId(data[0]?.semesters?.[0]?.id ?? '');
      }
      if (teacherRes.ok) {
        const data = await teacherRes.json();
        setTeachers(data);
        setTeacherId(data[0]?.id ?? '');
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const findCover = async () => {
    if (!semesterId || !teacherId || !date) return;
    setIsLoading(true);
    setMessage(null);
    setPeriods(null);

    try {
      const response = await fetch(
        `${API_URL}/schedule/absence-plan?semesterId=${semesterId}&teacherId=${teacherId}&date=${date}`,
        { headers: authHeaders() },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({ text: body?.message ?? 'Không lập được phương án.', ok: false });
        return;
      }

      setTeacherName(body.teacherName);
      setPeriods(body.periods);

      // Preselect the best stand-in for each period so one click covers the whole day
      const preset: Record<string, { mode: CoverageMode; substituteTeacherId?: string }> = {};
      for (const period of body.periods as Period[]) {
        preset[period.slotId] = period.candidates[0]
          ? { mode: 'SUBSTITUTE', substituteTeacherId: period.candidates[0].teacherId }
          : { mode: 'SELF_STUDY' };
      }
      setChoice(preset);
    } catch (error) {
      console.error(error);
      setMessage({ text: 'Lỗi kết nối.', ok: false });
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    if (!periods) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/schedule/absence`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          semesterId,
          teacherId,
          date,
          reason: reason || undefined,
          coverage: periods.map((period) => ({ slotId: period.slotId, ...choice[period.slotId] })),
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage({ text: body?.message ?? 'Không ghi nhận được.', ok: false });
        return;
      }

      setMessage({
        text: `Đã áp dụng: ${body.covered}/${body.total} tiết có người dạy thay. Lịch ngày ${date} đã cập nhật, hôm sau tự trở lại bình thường.`,
        ok: true,
      });
      setPeriods(null);
    } catch (error) {
      console.error(error);
      setMessage({ text: 'Lỗi kết nối.', ok: false });
    } finally {
      setIsLoading(false);
    }
  };

  const covered = useMemo(
    () => Object.values(choice).filter((c) => c.mode === 'SUBSTITUTE').length,
    [choice],
  );

  const inputClass =
    'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Xử lý giáo viên vắng</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Chọn giáo viên và ngày vắng, hệ thống tìm người dạy thay cho từng tiết. Thời khóa biểu gốc
          không bị sửa — chỉ ngày đó thay đổi, hôm sau tự trở lại bình thường.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Học kỳ</span>
            <select className={inputClass} value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              {years.flatMap((year) =>
                (year.semesters ?? []).map((semester: any) => (
                  <option key={semester.id} value={semester.id}>
                    {year.name} — {semester.name}
                  </option>
                )),
              )}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Giáo viên vắng</span>
            <select className={inputClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.code} — {teacher.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Ngày vắng</span>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-muted)]">Lý do</span>
            <input
              className={inputClass}
              placeholder="Ốm đột xuất"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>

        <button
          onClick={findCover}
          disabled={isLoading || !semesterId || !teacherId}
          className="rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading ? 'Đang tìm…' : 'Tìm người dạy thay'}
        </button>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {periods && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="font-bold text-[var(--text-primary)]">
              {teacherName} — {periods.length} tiết cần phủ ngày {date}
            </span>
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 size={14} /> {covered}/{periods.length} có người dạy thay
            </span>
          </div>

          <div className="space-y-3">
            {periods.map((period) => (
              <div key={period.slotId} className="rounded-lg border border-[var(--border-default)] p-3">
                <p className="mb-2 font-semibold text-[var(--text-primary)]">
                  Tiết {period.period} · {period.className} · {period.subjectName}
                  {period.roomName && (
                    <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                      phòng {period.roomName}
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap gap-2">
                  {period.candidates.map((candidate) => {
                    const active =
                      choice[period.slotId]?.mode === 'SUBSTITUTE' &&
                      choice[period.slotId]?.substituteTeacherId === candidate.teacherId;
                    return (
                      <button
                        key={candidate.teacherId}
                        onClick={() =>
                          setChoice((prev) => ({
                            ...prev,
                            [period.slotId]: { mode: 'SUBSTITUTE', substituteTeacherId: candidate.teacherId },
                          }))
                        }
                        className={`rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <span className="block font-medium">{candidate.teacherName}</span>
                        <span className="block text-xs text-[var(--text-muted)]">{candidate.reason}</span>
                      </button>
                    );
                  })}

                  {FALLBACKS.map((fallback) => {
                    const active = choice[period.slotId]?.mode === fallback.mode;
                    return (
                      <button
                        key={fallback.mode}
                        onClick={() =>
                          setChoice((prev) => ({ ...prev, [period.slotId]: { mode: fallback.mode } }))
                        }
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-dashed border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        {fallback.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={submit}
            disabled={isLoading}
            className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={16} /> Áp dụng cho ngày {date}
          </button>
        </div>
      )}
    </div>
  );
}
