'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Slot {
  id: string;
  classId: string;
  className?: string;
  subjectName?: string;
  subject?: { name: string; code: string; color?: string };
  teacherId: string;
  teacherName?: string;
  roomName?: string;
  day: number;
  period: number;
}

type Layout = 'SCHOOL' | 'CLASS' | 'TEACHER';

const DAYS = [2, 3, 4, 5, 6, 7];
const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};
const MORNING = [1, 2, 3, 4, 5];
const AFTERNOON = [6, 7, 8, 9, 10];

const LAYOUTS: Array<{ key: Layout; label: string; paper: string; note: string }> = [
  { key: 'SCHOOL', label: 'Toàn trường', paper: 'A3 nằm ngang', note: 'Một trang, mọi lớp — dán phòng hội đồng' },
  { key: 'CLASS', label: 'Từng lớp', paper: 'A4 dọc', note: 'Mỗi lớp một trang — dán bảng tin lớp' },
  { key: 'TEACHER', label: 'Từng giáo viên', paper: 'A4 dọc', note: 'Mỗi giáo viên một trang — phát tận tay' },
];

export default function PrintPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [layout, setLayout] = useState<Layout>('SCHOOL');
  const [schoolName, setSchoolName] = useState('TRƯỜNG THPT');
  const [semesterLabel, setSemesterLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const yearRes = await fetch(`${API_URL}/system/years`, { headers: authHeaders() });
      if (!yearRes.ok) return;

      const years = await yearRes.json();
      const semester = years[0]?.semesters?.[0];
      if (!semester) return;
      setSemesterLabel(`${years[0].name} — ${semester.name}`);

      const res = await fetch(`${API_URL}/algorithm/result/${semester.id}`, { headers: authHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      setSlots(data.bestSchedule ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo(
    () =>
      [...new Map(slots.map((s) => [s.classId, s.className ?? s.classId])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], 'vi'),
      ),
    [slots],
  );

  const teachers = useMemo(
    () =>
      [...new Map(slots.map((s) => [s.teacherId, s.teacherName ?? s.teacherId])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], 'vi'),
      ),
    [slots],
  );

  const printedOn = useMemo(() => new Date().toLocaleDateString('vi-VN'), []);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>;
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        Chưa có thời khóa biểu để in. Hãy xếp lịch trước.
      </p>
    );
  }

  return (
    <div>
      {/* Bảng điều khiển — không in ra giấy */}
      <div className="no-print space-y-4 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <Printer size={24} className="text-slate-500" />
              In thời khóa biểu
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              Chọn kiểu trình bày rồi bấm In. Trong hộp thoại in, chọn{' '}
              <strong>&ldquo;Lưu thành PDF&rdquo;</strong> nếu muốn file thay vì giấy.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <RefreshCw size={15} /> Tải lại
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((option) => (
            <button
              key={option.key}
              onClick={() => setLayout(option.key)}
              className={`min-w-56 flex-1 rounded-xl border-2 p-3 text-left transition-all ${
                layout === option.key
                  ? 'border-[var(--text-primary)] bg-[var(--bg-surface-hover)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-[var(--text-primary)]">{option.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{option.paper}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{option.note}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">Tên trường</span>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </label>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900"
          >
            <Printer size={16} />
            In{' '}
            {layout === 'SCHOOL'
              ? '1 trang A3'
              : `${(layout === 'CLASS' ? classes : teachers).length} trang A4`}
          </button>
        </div>
      </div>

      {/* Phần được in */}
      <div className={`print-area layout-${layout.toLowerCase()}`}>
        {layout === 'SCHOOL' && (
          <SchoolSheet
            slots={slots}
            classes={classes}
            schoolName={schoolName}
            semesterLabel={semesterLabel}
            printedOn={printedOn}
          />
        )}

        {layout === 'CLASS' &&
          classes.map(([classId, name]) => (
            <GridSheet
              key={classId}
              title={`THỜI KHÓA BIỂU LỚP ${name}`}
              schoolName={schoolName}
              semesterLabel={semesterLabel}
              printedOn={printedOn}
              slots={slots.filter((s) => s.classId === classId)}
              render={(slot) => (
                <>
                  <strong>{slot.subject?.name ?? slot.subjectName}</strong>
                  <span>{slot.teacherName}</span>
                  {slot.roomName && <span className="room">{slot.roomName}</span>}
                </>
              )}
            />
          ))}

        {layout === 'TEACHER' &&
          teachers.map(([teacherId, name]) => (
            <GridSheet
              key={teacherId}
              title={`THỜI KHÓA BIỂU — ${name.toUpperCase()}`}
              schoolName={schoolName}
              semesterLabel={semesterLabel}
              printedOn={printedOn}
              slots={slots.filter((s) => s.teacherId === teacherId)}
              render={(slot) => (
                <>
                  <strong>{slot.subject?.name ?? slot.subjectName}</strong>
                  <span>{slot.className}</span>
                  {slot.roomName && <span className="room">{slot.roomName}</span>}
                </>
              )}
            />
          ))}
      </div>

      <PrintStyles layout={layout} />
    </div>
  );
}

/** One A4 page: a week grid for a single class or teacher. */
function GridSheet({
  title,
  schoolName,
  semesterLabel,
  printedOn,
  slots,
  render,
}: {
  title: string;
  schoolName: string;
  semesterLabel: string;
  printedOn: string;
  slots: Slot[];
  render: (slot: Slot) => React.ReactNode;
}) {
  const at = (day: number, period: number) => slots.find((s) => s.day === day && s.period === period);
  const usesAfternoon = slots.some((s) => s.period > 5);

  return (
    <section className="sheet">
      <header className="sheet-head">
        <p className="school">{schoolName}</p>
        <h2>{title}</h2>
        <p className="meta">{semesterLabel}</p>
      </header>

      <table className="grid">
        <thead>
          <tr>
            <th className="corner">Tiết</th>
            {DAYS.map((day) => (
              <th key={day}>{DAY_LABEL[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Sáng', periods: MORNING },
            ...(usesAfternoon ? [{ label: 'Chiều', periods: AFTERNOON }] : []),
          ].map((block) => (
            <Fragment key={block.label}>
              <tr className="session-row">
                <td colSpan={DAYS.length + 1}>Buổi {block.label.toLowerCase()}</td>
              </tr>
              {block.periods.map((period) => (
                <tr key={period}>
                  <td className="period">{period > 5 ? period - 5 : period}</td>
                  {DAYS.map((day) => {
                    const slot = at(day, period);
                    return (
                      <td key={day} className={slot ? 'filled' : ''}>
                        {slot ? <div className="cell">{render(slot)}</div> : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      <footer className="sheet-foot">In ngày {printedOn}</footer>
    </section>
  );
}

/** One A3 landscape page: every class side by side, the way it hangs in the staff room. */
function SchoolSheet({
  slots,
  classes,
  schoolName,
  semesterLabel,
  printedOn,
}: {
  slots: Slot[];
  classes: Array<[string, string]>;
  schoolName: string;
  semesterLabel: string;
  printedOn: string;
}) {
  const usesAfternoon = slots.some((s) => s.period > 5);
  const periods = usesAfternoon ? [...MORNING, ...AFTERNOON] : MORNING;
  const at = (classId: string, day: number, period: number) =>
    slots.find((s) => s.classId === classId && s.day === day && s.period === period);

  return (
    <section className="sheet sheet-wide">
      <header className="sheet-head">
        <p className="school">{schoolName}</p>
        <h2>THỜI KHÓA BIỂU TOÀN TRƯỜNG</h2>
        <p className="meta">{semesterLabel}</p>
      </header>

      <table className="grid grid-school">
        <thead>
          <tr>
            <th className="corner">Thứ</th>
            <th className="corner">Tiết</th>
            {classes.map(([id, name]) => (
              <th key={id}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) =>
            periods.map((period, index) => (
              <tr key={`${day}-${period}`} className={index === 0 ? 'day-start' : ''}>
                {index === 0 && (
                  <td className="day" rowSpan={periods.length}>
                    {DAY_LABEL[day]}
                  </td>
                )}
                <td className="period">{period > 5 ? `C${period - 5}` : period}</td>
                {classes.map(([classId]) => {
                  const slot = at(classId, day, period);
                  return (
                    <td key={classId} className={slot ? 'filled' : ''}>
                      {slot && (
                        <div className="cell compact">
                          <strong>{slot.subject?.code ?? slot.subjectName}</strong>
                          <span>{slot.teacherName}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>

      <footer className="sheet-foot">In ngày {printedOn}</footer>
    </section>
  );
}

/**
 * Print rules.
 *
 * The PDF is produced by the browser's own print dialog rather than generated on the
 * server. Server-side PDF libraries ship fonts without Vietnamese diacritics, so
 * "Thời khóa biểu" comes out as "Th?i khóa bi?u" unless a font is embedded and every
 * glyph checked - a whole class of bug avoided by printing the page the school is already
 * looking at, in the font it already renders correctly.
 */
function PrintStyles({ layout }: { layout: Layout }) {
  // A3 landscape only for the whole-school sheet; the rest are ordinary A4
  const page = layout === 'SCHOOL' ? 'A3 landscape' : 'A4 portrait';
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .print-area {
        background: #fff;
        color: #000;
      }
      .sheet {
        /* Set explicitly: printed sheets should not change appearance because the app
           theme changed its font, and every face here covers Vietnamese diacritics. */
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
        background: #fff;
        color: #000;
        padding: 12mm;
        margin: 0 auto 8mm;
        max-width: 210mm;
        border: 1px solid #ddd;
      }
      .sheet-wide {
        max-width: 420mm;
      }
      .sheet-head {
        text-align: center;
        margin-bottom: 6mm;
      }
      .sheet-head .school {
        font-size: 11pt;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .sheet-head h2 {
        font-size: 16pt;
        font-weight: 700;
        margin: 2mm 0 1mm;
      }
      .sheet-head .meta {
        font-size: 10pt;
        color: #444;
      }
      table.grid {
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
      }
      table.grid th,
      table.grid td {
        border: 0.4mm solid #333;
        padding: 1.5mm;
        text-align: center;
        vertical-align: middle;
      }
      table.grid th {
        background: #eee;
        font-weight: 700;
        font-size: 9.5pt;
      }
      table.grid td.period,
      table.grid td.day {
        background: #f4f4f4;
        font-weight: 600;
        width: 12mm;
      }
      table.grid td.day {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
      }
      tr.session-row td {
        background: #ddd;
        font-weight: 700;
        text-align: left;
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      tr.day-start td {
        border-top: 0.8mm solid #000;
      }
      .cell {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
      }
      .cell strong {
        font-weight: 700;
      }
      .cell span {
        font-size: 8pt;
        color: #333;
      }
      .cell .room {
        font-style: italic;
      }
      .cell.compact strong {
        font-size: 8.5pt;
      }
      .cell.compact span {
        font-size: 7pt;
      }
      .sheet-foot {
        margin-top: 4mm;
        text-align: right;
        font-size: 8pt;
        color: #555;
      }

      @media print {
        /* The admin shell is a fixed-height, overflow-hidden flexbox. Left alone it
           prints as one clipped screen, so unwind it before anything else. */
        html,
        body {
          height: auto !important;
          overflow: visible !important;
          background: #fff !important;
        }
        [data-app-shell],
        [data-app-main],
        [data-app-content] {
          display: block !important;
          height: auto !important;
          overflow: visible !important;
          padding: 0 !important;
        }
        [data-print-hide],
        .no-print {
          display: none !important;
        }
        .sheet {
          border: none;
          margin: 0;
          padding: 0;
          max-width: none;
          /* Each class and each teacher starts on its own sheet of paper */
          break-after: page;
          page-break-after: always;
        }
        .sheet:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        /* A row must never be split across two pages */
        table.grid tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        thead {
          display: table-header-group;
        }
        /* Backgrounds carry meaning in the grid, so ask the browser to keep them */
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      @page {
        size: ${page};
        margin: 10mm;
      }
    ` }} />
  );
}
