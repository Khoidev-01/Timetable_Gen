'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/api';
import Select from '@/app/components/ui/Select';

interface Period {
  period: number;
  className: string;
  subjectName: string;
  teacherName: string;
  roomName?: string;
  roomLabel?: string;
  change?: { note: string; originalTeacherName?: string };
}

interface DayView {
  date: string;
  dayOfWeek: number;
  isSchoolDay: boolean;
  notes: string[];
  periods: Period[];
  classNames: string[];
  teacherNames: string[];
  timetableName: string;
}

interface WeekSlot {
  day: number;
  period: number;
  className: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  roomLabel?: string;
}

interface WeekView {
  timetableName: string;
  semesterName: string;
  schoolYear: string;
  classNames: string[];
  teacherNames: string[];
  slots: WeekSlot[];
}

const DAYS = [2, 3, 4, 5, 6, 7];
const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
const SESSIONS = [
  { label: 'Sáng', periods: [1, 2, 3, 4, 5] },
  { label: 'Chiều', periods: [6, 7, 8, 9, 10] },
];

/**
 * Trang sau mã QR trên bảng tin: thời khóa biểu đã xếp, không cần đăng nhập.
 *
 * Mặc định là lưới cả tuần của một lớp hoặc một giáo viên - thứ người quét mã muốn tra. Tab
 * "Hôm nay" giữ lịch thực tế trong ngày, đã tính các tiết dạy thay.
 */
export default function PublicSchedulePage() {
  const params = useParams();
  const search = useSearchParams();
  const token = String(params.token ?? '');

  // Mã QR in riêng cho một người mang sẵn ?teacher=<tên> hoặc ?class=<lớp>
  const initialTeacher = search.get('teacher') ?? '';
  const initialClass = search.get('class') ?? '';

  const [tab, setTab] = useState<'week' | 'today'>('week');
  const [mode, setMode] = useState<'class' | 'teacher'>(initialTeacher ? 'teacher' : 'class');
  const [who, setWho] = useState(initialTeacher || initialClass);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [week, setWeek] = useState<WeekView | null>(null);
  const [day, setDay] = useState<DayView | null>(null);
  const [error, setError] = useState('');

  const fetchJson = useCallback(async (url: string) => {
    const response = await fetch(url);
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? 'Không tải được thời khóa biểu.');
    return body;
  }, []);

  // Danh sách lớp/giáo viên để chọn: lấy một lần, rồi chọn sẵn lớp đầu tiên cho lưới tuần
  useEffect(() => {
    fetchJson(`${API_URL}/schedule/public/${token}/week?class=__none__`)
      .then((body: WeekView) => {
        setWeek(body);
        setWho((current) => current || body.classNames[0] || '');
      })
      .catch((err: Error) => setError(err.message));
  }, [token, fetchJson]);

  const loadWeek = useCallback(async () => {
    if (!who) return;
    setError('');
    try {
      const query = new URLSearchParams({ [mode]: who });
      setWeek(await fetchJson(`${API_URL}/schedule/public/${token}/week?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối.');
    }
  }, [token, mode, who, fetchJson]);

  const loadDay = useCallback(async () => {
    setError('');
    try {
      const query = new URLSearchParams({ date });
      if (who) query.set(mode, who);
      setDay(await fetchJson(`${API_URL}/schedule/public/${token}?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối.');
    }
  }, [token, date, mode, who, fetchJson]);

  useEffect(() => {
    if (tab === 'week') loadWeek();
    else loadDay();
  }, [tab, loadWeek, loadDay]);

  const options = mode === 'class' ? (week?.classNames ?? []) : (week?.teacherNames ?? []);

  const cells = useMemo(() => {
    const map = new Map<string, WeekSlot[]>();
    for (const slot of week?.slots ?? []) {
      const key = `${slot.day}-${slot.period}`;
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [week]);
  // Chỉ vẽ buổi có tiết, để lớp học sáng không kéo theo năm hàng chiều trống (trừ tiết trái buổi)
  const sessions = SESSIONS.filter((session) => (week?.slots ?? []).some((slot) => session.periods.includes(slot.period)));

  const segment = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`;

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 p-4">
      <header className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Thời khóa biểu</h1>
        <p className="text-sm text-slate-500">
          {week ? `${week.semesterName} - Năm học ${week.schoolYear}` : 'Đang tải…'}
        </p>
      </header>

      <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex gap-2" role="tablist" aria-label="Kiểu xem">
          <button type="button" role="tab" aria-selected={tab === 'week'} onClick={() => setTab('week')} className={segment(tab === 'week')}>
            Cả tuần
          </button>
          <button type="button" role="tab" aria-selected={tab === 'today'} onClick={() => setTab('today')} className={segment(tab === 'today')}>
            Theo ngày
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex gap-2">
            {(['class', 'teacher'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  setWho(option === 'class' ? (week?.classNames[0] ?? '') : (week?.teacherNames[0] ?? ''));
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === option ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {option === 'class' ? 'Theo lớp' : 'Theo giáo viên'}
              </button>
            ))}
          </div>
          <Select
            value={who}
            onChange={setWho}
            aria-label={mode === 'class' ? 'Chọn lớp' : 'Chọn giáo viên'}
            searchPlaceholder={mode === 'class' ? 'Tìm lớp...' : 'Tìm giáo viên...'}
            options={[
              ...(tab === 'today' ? [{ value: '', label: 'Xem tất cả' }] : []),
              ...options.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>

        {tab === 'today' && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Chọn ngày"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
          />
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {tab === 'week' && week && (
        <section aria-label={`Thời khóa biểu cả tuần của ${who}`} className="overflow-hidden rounded-xl bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">
            {mode === 'class' ? `Lớp ${who}` : who}
          </h2>
          {week.slots.length === 0 ? (
            <p className="p-6 text-center text-slate-500">Không có tiết nào cho lựa chọn này</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-sm" data-week-grid>
                <colgroup>
                  <col style={{ width: '4.5rem' }} />
                  {DAYS.map((d) => <col key={d} />)}
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-200 px-2 py-2 font-semibold">Tiết</th>
                    {DAYS.map((d) => (
                      <th key={d} className="border border-slate-200 px-2 py-2 font-semibold">{DAY_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                {sessions.map((session) => (
                  <tbody key={session.label}>
                    {session.periods.map((period, index) => (
                      <tr key={period}>
                        <th className="border border-slate-200 bg-slate-50 px-2 py-2 text-center font-normal text-slate-600">
                          <span className="block text-xs text-slate-400">{session.label}</span>
                          Tiết {index + 1}
                        </th>
                        {DAYS.map((d) => {
                          const list = cells.get(`${d}-${period}`) ?? [];
                          return (
                            <td key={d} className="h-20 border border-slate-200 p-1.5 align-top">
                              {list.map((slot, i) => (
                                <div key={i} className="mb-1 rounded-lg bg-blue-50 px-2 py-1.5 last:mb-0">
                                  <p className="font-semibold leading-tight text-slate-800">{slot.subjectName}</p>
                                  <p className="text-xs text-slate-600">{mode === 'class' ? slot.teacherName : `Lớp ${slot.className}`}</p>
                                  {slot.roomLabel && <p className="text-xs text-slate-500">{slot.roomLabel}</p>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'today' && (
        <>
          {day?.notes?.map((note, index) => (
            <p key={index} className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {note}
            </p>
          ))}

          {day && !day.isSchoolDay && (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">Ngày này không có lịch học</p>
          )}

          {day && day.isSchoolDay && day.periods.length === 0 && !error && (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">Không có tiết nào cho lựa chọn này</p>
          )}

          <ul className="space-y-2">
            {day?.periods.map((period, index) => (
              <li
                key={`${period.className}-${period.period}-${index}`}
                className={`rounded-xl bg-white p-3 shadow-sm ${period.change ? 'border-l-4 border-amber-400' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-lg font-bold text-blue-600">{period.period > 5 ? period.period - 5 : period.period}</span>
                  <span className="font-semibold text-slate-800">{period.subjectName}</span>
                  <span className="ml-auto text-sm text-slate-500">{period.className}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
                  <span>{period.teacherName}</span>
                  {(period.roomLabel || period.roomName) && <span>· {period.roomLabel ?? `Phòng ${period.roomName}`}</span>}
                </div>
                {period.change && <p className="mt-1 text-xs font-medium text-amber-700">{period.change.note}</p>}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-slate-400">Lịch theo ngày đã tính cả các tiết dạy thay</p>
        </>
      )}
    </main>
  );
}
