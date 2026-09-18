'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Printer, RefreshCw } from 'lucide-react';
import { API_URL } from '@/lib/api';
import Select from '@/app/components/ui/Select';

interface Slot {
  id: string;
  classId: string;
  className?: string;
  subjectName?: string;
  subject?: { name: string; code: string };
  teacherId: string;
  teacherName?: string;
  roomName?: string;
  roomLabel?: string;
  day: number;
  period: number;
}

type PrintTarget = 'CLASS' | 'TEACHER';

const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};

function isoWeekValue(date = new Date()): string {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekDetails(value: string) {
  const [yearText, weekText] = value.split('-W');
  const year = Number(yearText);
  const week = Number(weekText);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (week - 1) * 7);
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  const format = (date: Date) => date.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
  return { week, label: `${format(monday)} - ${format(saturday)}` };
}

export default function PrintPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [target, setTarget] = useState<PrintTarget>('CLASS');
  const [selectedId, setSelectedId] = useState('');
  const [schoolName, setSchoolName] = useState('TRƯỜNG THPT');
  const [semesterLabel, setSemesterLabel] = useState('');
  const [weekValue, setWeekValue] = useState(() => isoWeekValue());
  const [isLoading, setIsLoading] = useState(true);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const yearResponse = await fetch(`${API_URL}/system/years`, { headers: authHeaders() });
      if (!yearResponse.ok) return;
      const years = await yearResponse.json();
      const semester = years[0]?.semesters?.[0];
      if (!semester) return;
      setSemesterLabel(`${years[0].name} - ${semester.name}`);

      const resultResponse = await fetch(`${API_URL}/algorithm/result/${semester.id}`, { headers: authHeaders() });
      if (!resultResponse.ok) return;
      const data = await resultResponse.json();
      setSlots(data.bestSchedule ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const classes = useMemo(
    () => [...new Map(slots.map((slot) => [slot.classId, slot.className ?? slot.classId])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'vi')),
    [slots],
  );
  const teachers = useMemo(
    () => [...new Map(slots.map((slot) => [slot.teacherId, slot.teacherName ?? slot.teacherId])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'vi')),
    [slots],
  );
  const options = target === 'CLASS' ? classes : teachers;
  const effectiveSelectedId = options.some(([id]) => id === selectedId)
    ? selectedId
    : (options[0]?.[0] ?? '');
  const selectedName = options.find(([id]) => id === effectiveSelectedId)?.[1] ?? '';
  const selectedSlots = slots.filter((slot) => target === 'CLASS'
    ? slot.classId === effectiveSelectedId
    : slot.teacherId === effectiveSelectedId);
  const week = weekDetails(weekValue || isoWeekValue());

  if (isLoading) return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải dữ liệu in...</p>;
  if (slots.length === 0) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Chưa có thời khóa biểu để in. Hãy xếp lịch trước.</p>;

  return (
    <div className="print-page-shell">
      <section className="no-print mb-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <Printer size={24} className="text-blue-600" /> In thời khóa biểu tuần
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Chọn đối tượng và tuần. Mỗi lần in xuất đúng một trang A4 nằm ngang.</p>
          </div>
          <button type="button" onClick={load} className="tactile flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]">
            <RefreshCw size={16} /> Tải lại
          </button>
        </div>

        <div className="grid gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-sm lg:grid-cols-[auto_minmax(220px,1fr)_minmax(190px,0.7fr)_minmax(190px,0.7fr)_auto] lg:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Đối tượng</p>
            <div className="flex rounded-lg bg-[var(--bg-surface-hover)] p-1">
              {(['CLASS', 'TEACHER'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setTarget(value)} className={`min-h-10 rounded-md px-3 text-sm font-semibold transition-[transform,background-color,color,box-shadow] ${target === value ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)]'}`}>
                  {value === 'CLASS' ? 'Theo lớp' : 'Theo giáo viên'}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">{target === 'CLASS' ? 'Lớp học' : 'Giáo viên'}</span>
            <Select
              value={effectiveSelectedId}
              onChange={setSelectedId}
              placeholder={target === 'CLASS' ? 'Chọn lớp' : 'Chọn giáo viên'}
              searchPlaceholder={target === 'CLASS' ? 'Tìm lớp...' : 'Tìm giáo viên...'}
              options={options.map(([id, name]) => ({ value: String(id), label: String(name) }))}
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]"><CalendarDays size={14} /> Tuần in</span>
            <input type="week" value={weekValue} onChange={(event) => setWeekValue(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-blue-500" />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">Tên trường</span>
            <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-blue-500" />
          </label>

          <button type="button" onClick={() => window.print()} className="tactile flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Printer size={17} /> In A4
          </button>
        </div>
      </section>

      <div className="print-preview-frame">
        <WeeklySheet schoolName={schoolName} semesterLabel={semesterLabel} target={target} selectedName={selectedName} weekNumber={week.week} weekRange={week.label} slots={selectedSlots} />
      </div>
      <PrintStyles />
    </div>
  );
}

function WeeklySheet({ schoolName, semesterLabel, target, selectedName, weekNumber, weekRange, slots }: {
  schoolName: string; semesterLabel: string; target: PrintTarget; selectedName: string; weekNumber: number; weekRange: string; slots: Slot[];
}) {
  const at = (day: number, period: number) => slots.find((slot) => slot.day === day && slot.period === period);
  return (
    <article className="weekly-sheet">
      <header className="weekly-sheet-head">
        <div><p className="weekly-school">{schoolName}</p><p className="weekly-semester">{semesterLabel}</p></div>
        <div className="weekly-title"><h2>THỜI KHÓA BIỂU TUẦN {weekNumber}</h2><p>{weekRange}</p></div>
        <div className="weekly-owner"><span>{target === 'CLASS' ? 'Lớp' : 'Giáo viên'}</span><strong>{selectedName}</strong></div>
      </header>

      <table className="weekly-grid">
        <thead><tr><th className="weekly-period-head">Buổi / Tiết</th>{DAYS.map((day) => <th key={day}>{DAY_LABEL[day]}</th>)}</tr></thead>
        <tbody>
          {PERIODS.map((period) => (
            <Fragment key={period}>
              {period === 6 && <tr className="weekly-session-divider"><td colSpan={DAYS.length + 1}>BUỔI CHIỀU</td></tr>}
              <tr>
                <th className="weekly-period"><span>{period <= 5 ? 'Sáng' : 'Chiều'}</span>Tiết {period <= 5 ? period : period - 5}</th>
                {DAYS.map((day) => {
                  const slot = at(day, period);
                  const subjectName = slot?.subject?.name ?? slot?.subjectName;
                  return <td key={day} className={slot ? 'has-slot' : ''}>{slot && <div className="weekly-cell"><strong>{subjectName === 'Giáo dục quốc phòng và an ninh' ? <>Giáo dục<br />quốc phòng và an ninh</> : subjectName}</strong><span>{target === 'CLASS' ? slot.teacherName : slot.className}</span>{(slot.roomLabel || slot.roomName) && <small>{slot.roomLabel || slot.roomName}</small>}</div>}</td>;
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <footer className="weekly-foot"><span>MiKiTimetable</span><span>Khổ giấy A4 nằm ngang</span></footer>
    </article>
  );
}

function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: `
    .print-preview-frame { overflow-x: auto; border-radius: 16px; background: #e9eef6; padding: 24px; }
    .weekly-sheet { box-sizing: border-box; width: 297mm; min-height: 210mm; margin: 0 auto; padding: 10mm; background: #fff; color: #111827; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; box-shadow: 0 16px 42px rgba(15, 23, 42, 0.12); }
    .weekly-sheet-head { display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: center; gap: 8mm; margin-bottom: 5mm; }
    .weekly-school { margin: 0; font-size: 10pt; font-weight: 700; text-transform: uppercase; }
    .weekly-semester { margin: 1mm 0 0; font-size: 8pt; color: #64748b; }
    .weekly-title { text-align: center; }
    .weekly-title h2 { margin: 0; font-size: 17pt; line-height: 1.15; }
    .weekly-title p { margin: 1mm 0 0; font-size: 9pt; color: #475569; }
    .weekly-owner { text-align: right; }
    .weekly-owner span { display: block; font-size: 8pt; color: #64748b; }
    .weekly-owner strong { display: block; margin-top: 1mm; font-size: 12pt; }
    .weekly-grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
    .weekly-grid th, .weekly-grid td { border: 0.35mm solid #334155; text-align: center; vertical-align: middle; }
    .weekly-grid thead th { height: 10mm; background: #eaf2ff; font-size: 9pt; font-weight: 700; }
    .weekly-period-head, .weekly-period { width: 24mm; }
    .weekly-period { background: #f1f5f9; font-size: 8pt; }
    .weekly-period span { display: block; margin-bottom: 0.5mm; color: #64748b; font-size: 7pt; font-weight: 500; }
    .weekly-grid tbody tr:not(.weekly-session-divider) { height: 13mm; }
    .weekly-grid td { padding: 1mm; }
    .weekly-grid td.has-slot { background: #f8fbff; }
    .weekly-cell { display: flex; flex-direction: column; gap: 0.4mm; line-height: 1.15; }
    .weekly-cell strong { font-size: 8.5pt; }
    .weekly-cell span { font-size: 7.5pt; color: #334155; }
    .weekly-cell small { font-size: 6.8pt; color: #64748b; font-style: italic; }
    .weekly-session-divider td { height: 5mm; background: #dbeafe; font-size: 7pt; font-weight: 700; letter-spacing: 0.08em; }
    .weekly-foot { display: flex; justify-content: space-between; margin-top: 3mm; font-size: 7pt; color: #64748b; }
    @media print {
      html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
      [data-app-shell], [data-app-main], [data-app-content] { display: block !important; height: auto !important; overflow: visible !important; padding: 0 !important; }
      [data-print-hide], .no-print { display: none !important; }
      .print-preview-frame { overflow: visible; padding: 0; background: #fff; }
      .weekly-sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      .weekly-grid tr { break-inside: avoid; page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { size: A4 landscape; margin: 8mm; }
  ` }} />;
}
