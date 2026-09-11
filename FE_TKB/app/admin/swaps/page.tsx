'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { API_URL } from '@/lib/api';
import SwapRequestPanel from '../../components/SwapRequestPanel';

interface SemesterOption {
  id: string;
  name: string;
  yearName: string;
}

/**
 * The admin's side of a swap: the last sign-off before the timetable changes.
 *
 * The constraints are re-checked at the moment Duyệt is pressed, not when the teachers
 * agreed, so a trade that has since become impossible is refused here with a reason rather
 * than written into the timetable.
 */
export default function AdminSwapsPage() {
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [semesterId, setSemesterId] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_URL}/system/years`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((years: any[]) => {
        const options: SemesterOption[] = [];
        years.forEach((year) =>
          (year.semesters ?? []).forEach((semester: any) =>
            options.push({ id: semester.id, name: semester.name, yearName: year.name }),
          ),
        );
        setSemesters(options);
        if (options.length) setSemesterId(options[0].id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <ArrowLeftRight size={24} className="text-blue-500" />
            Duyệt đổi tiết
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Hai giáo viên đã thỏa thuận với nhau. Duyệt thì thời khóa biểu đổi ngay, kèm một
            bản ghi đè để lưu vết.
          </p>
        </div>

        {semesters.length > 0 && (
          <select
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {semesters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.yearName} — {option.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {semesterId && <SwapRequestPanel key={semesterId} role="ADMIN" semesterId={semesterId} />}
    </div>
  );
}
