'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_URL } from '@/lib/api';

interface Period {
  period: number;
  className: string;
  subjectName: string;
  teacherName: string;
  roomName?: string;
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

/**
 * The page behind the QR code on the staff noticeboard: today's real schedule, no login.
 * It shows the effective day, so an absence covered at 6:45 is visible here at 7:00.
 */
export default function PublicSchedulePage() {
  const params = useParams();
  const token = String(params.token ?? '');

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<'class' | 'teacher'>('class');
  const [who, setWho] = useState('');
  const [data, setData] = useState<DayView | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const query = new URLSearchParams({ date });
      if (who) query.set(mode === 'class' ? 'class' : 'teacher', who);

      const response = await fetch(`${API_URL}/schedule/public/${token}?${query}`);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.message ?? 'Không tải được lịch.');
        setData(null);
        return;
      }
      setData(body);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối.');
    }
  }, [token, date, mode, who]);

  useEffect(() => {
    load();
  }, [load]);

  const options = mode === 'class' ? (data?.classNames ?? []) : (data?.teacherNames ?? []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4">
      <header className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Thời khóa biểu hôm nay</h1>
        <p className="text-sm text-slate-500">
          {data?.timetableName ?? 'Đang tải…'}
        </p>
      </header>

      <div className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
        />

        <div className="flex gap-2">
          {(['class', 'teacher'] as const).map((option) => (
            <button
              key={option}
              onClick={() => {
                setMode(option);
                setWho('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === option ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {option === 'class' ? 'Theo lớp' : 'Theo giáo viên'}
            </button>
          ))}
        </div>

        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
        >
          <option value="">— Xem tất cả —</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {data?.notes?.map((note, index) => (
        <p key={index} className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {note}
        </p>
      ))}

      {data && !data.isSchoolDay && (
        <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">Hôm nay không có lịch học</p>
      )}

      {data && data.isSchoolDay && data.periods.length === 0 && !error && (
        <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm">
          Không có tiết nào cho lựa chọn này
        </p>
      )}

      <ul className="space-y-2">
        {data?.periods.map((period, index) => (
          <li
            key={`${period.className}-${period.period}-${index}`}
            className={`rounded-xl bg-white p-3 shadow-sm ${period.change ? 'border-l-4 border-amber-400' : ''}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-bold text-blue-600">{period.period}</span>
              <span className="font-semibold text-slate-800">{period.subjectName}</span>
              <span className="ml-auto text-sm text-slate-500">{period.className}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-600">
              <span>{period.teacherName}</span>
              {period.roomName && <span>· phòng {period.roomName}</span>}
            </div>
            {period.change && (
              <p className="mt-1 text-xs font-medium text-amber-700">{period.change.note}</p>
            )}
          </li>
        ))}
      </ul>

      <footer className="mt-6 pb-6 text-center text-xs text-slate-400">
        Lịch này đã tính cả các thay đổi trong ngày
      </footer>
    </main>
  );
}
