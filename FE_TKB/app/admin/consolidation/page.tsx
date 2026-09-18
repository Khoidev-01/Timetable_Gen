'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FolderInput, Layers, Loader2, Sparkles } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Issue {
  level: 'ERROR' | 'WARNING';
  message: string;
}

interface DepartmentRow {
  department: string;
  head: { code: string; name: string } | null;
  subjects: Array<{ code: string; name: string }>;
  expectedRows: number;
  submission?: {
    fileName: string;
    submittedAt: string;
    filled: number;
    errors: number;
    warnings: number;
    issues: Issue[];
  } | null;
}

interface Report {
  yearName: string;
  classes: number;
  teachers: number;
  totalRows: number;
  stats: { fromDepartments: number; homeroom: number; auto: number; unassigned: number };
  submittedDepartments: string[];
  missingDepartments: string[];
  errors: Issue[];
  warnings: Issue[];
  loads: Array<{ code: string; name: string; capacity: number; hk1: number; hk2: number }>;
}

interface Overview {
  yearId: string;
  yearName: string;
  departments: DepartmentRow[];
  latestConsolidation: null | { id: string; createdAt: string };
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
const card = 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6';

/**
 * Admin tổng hợp bảng phân công các tổ trưởng đã nộp, rồi bấm "Phân công tự động": hệ thống
 * giữ đúng phân công của tổ, điền phần còn thiếu, nhập bảng hoàn chỉnh và xếp thời khóa biểu.
 */
export default function ConsolidationPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [done, setDone] = useState<null | { consolidationId: string; imported: any; scheduling: Array<{ semester: string; error?: string }> }>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/department-assignments/overview`, { headers: authHeader() });
      if (res.ok) setOverview(await res.json());
    } catch {
      toast('Không tải được danh sách tổ', 'error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const consolidate = async () => {
    setIsConsolidating(true);
    setDone(null);
    try {
      const res = await fetch(`${API_URL}/department-assignments/consolidate`, { method: 'POST', headers: authHeader() });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message);
      setReport(body);
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'Không tổng hợp được', 'error');
    } finally {
      setIsConsolidating(false);
    }
  };

  const autoAssign = async () => {
    if (!confirm('Nhập bảng phân công hoàn chỉnh vào hệ thống (thay phân công hiện có) và xếp thời khóa biểu cả hai học kỳ?')) return;
    setIsAssigning(true);
    try {
      const res = await fetch(`${API_URL}/department-assignments/auto-assign`, { method: 'POST', headers: authHeader() });
      const body = await res.json();
      if (!res.ok) {
        if (body?.report) setReport(body.report);
        throw new Error(body?.message);
      }
      setReport(body.report);
      setDone(body);
      toast('Đã phân công và bắt đầu xếp thời khóa biểu', 'success');
      load();
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : 'Phân công tự động thất bại', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const download = async (id: string) => {
    const res = await fetch(`${API_URL}/department-assignments/consolidations/${id}/download`, { headers: authHeader() });
    if (!res.ok) {
      toast('Không tải được file', 'error');
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `bang-phan-cong-hoan-chinh-${overview?.yearName ?? ''}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!overview) return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>;

  const submittedCount = overview.departments.filter((d) => d.submission).length;
  const latestId = done?.consolidationId ?? overview.latestConsolidation?.id;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <FolderInput size={24} className="text-indigo-500" />
            Tổng hợp phân công
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Năm học {overview.yearName} · {submittedCount}/{overview.departments.length} tổ đã nộp bảng phân công
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={consolidate}
            disabled={isConsolidating || isAssigning}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
          >
            {isConsolidating ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
            Tổng hợp
          </button>
          <button
            type="button"
            onClick={autoAssign}
            disabled={!report || report.errors.length > 0 || isAssigning || isConsolidating}
            title={!report ? 'Bấm Tổng hợp trước' : report.errors.length ? 'Còn lỗi, chưa phân công được' : ''}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAssigning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isAssigning ? 'Đang phân công…' : 'Phân công tự động'}
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" aria-labelledby="departments">
        <h2 id="departments" className="px-6 pb-3 pt-5 font-semibold text-[var(--text-primary)]">Bài nộp của các tổ</h2>
        <table className="data-table">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Tổ chuyên môn</th>
              <th>Tổ trưởng</th>
              <th>Môn phụ trách</th>
              <th>Trạng thái</th>
              <th>Kiểm tra</th>
            </tr>
          </thead>
          <tbody>
            {overview.departments.map((d) => (
              <tr key={d.department} data-department={d.department}>
                <td className="text-[var(--text-primary)]">{d.department}</td>
                <td>{d.head ? `${d.head.name} (${d.head.code})` : 'Chưa có tổ trưởng'}</td>
                <td>{d.subjects.map((s) => s.name).join(', ')}</td>
                <td>
                  {d.submission
                    ? `Đã nộp ${new Date(d.submission.submittedAt).toLocaleString('vi-VN')} · ${d.submission.filled}/${d.expectedRows} dòng`
                    : 'Chưa nộp - hệ thống sẽ tự phân công'}
                </td>
                <td>
                  {d.submission ? (
                    d.submission.errors + d.submission.warnings === 0 ? (
                      'Không có vấn đề'
                    ) : (
                      <button type="button" className="row-action" onClick={() => setExpanded(expanded === d.department ? null : d.department)}>
                        {d.submission.errors} lỗi, {d.submission.warnings} cảnh báo
                      </button>
                    )
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expanded && (
          <div className="border-t border-[var(--border-default)] px-6 py-4 text-sm">
            <p className="mb-2 font-semibold text-[var(--text-primary)]">{expanded}</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {overview.departments.find((d) => d.department === expanded)?.submission?.issues.map((issue, i) => (
                <li key={i} className={issue.level === 'ERROR' ? 'text-red-700' : 'text-amber-700'}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report && (
        <section className={card} aria-labelledby="report">
          <h2 id="report" className="font-semibold text-[var(--text-primary)]">Kết quả tổng hợp</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Tổ trưởng đã chốt', value: report.stats.fromDepartments },
              { label: 'Giao cho GVCN', value: report.stats.homeroom, hint: 'HĐTN, chào cờ, sinh hoạt' },
              { label: 'Hệ thống tự phân công', value: report.stats.auto },
              { label: 'Chưa phân công được', value: report.stats.unassigned },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[var(--bg-surface-hover)] p-4">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{item.value}</p>
                <p className="text-sm text-[var(--text-secondary)]">{item.label}</p>
                {item.hint && <p className="text-xs text-[var(--text-muted)]">{item.hint}</p>}
              </div>
            ))}
          </div>
          {report.missingDepartments.length > 0 && (
            <p className="mt-4 text-sm text-amber-700">Chưa nộp: {report.missingDepartments.join(', ')} - phần việc của các tổ này sẽ do hệ thống tự phân công.</p>
          )}
          {report.errors.length > 0 ? (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">{report.errors.length} lỗi phải xử lý trước khi phân công</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {report.errors.slice(0, 30).map((issue, i) => <li key={i}>{issue.message}</li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> Không có lỗi: mọi lớp - môn đều có giáo viên, không ai vượt định mức. Có thể bấm Phân công tự động.
            </p>
          )}
        </section>
      )}

      {(done || latestId) && (
        <section className={card} aria-labelledby="final">
          <h2 id="final" className="font-semibold text-[var(--text-primary)]">Bảng phân công hoàn chỉnh</h2>
          {done && (
            <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              <p>Đã nhập vào hệ thống: {done.imported?.assignments?.created ?? '?'} dòng phân công cho cả hai học kỳ.</p>
              <p>
                Xếp thời khóa biểu: {done.scheduling.map((s) => `${s.semester} ${s.error ? `(lỗi: ${s.error})` : 'đang xếp'}`).join(', ')}. Mỗi học kỳ mất vài phút;
                xem tiến độ và công bố ở trang{' '}
                <Link href="/admin/timetable" className="font-semibold text-[var(--accent)] underline">Thời khóa biểu</Link>.
              </p>
            </div>
          )}
          {latestId && (
            <button
              type="button"
              onClick={() => download(latestId)}
              className="mt-4 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
            >
              <Download size={16} />
              Tải bảng hoàn chỉnh (mẫu nhập)
            </button>
          )}
        </section>
      )}
    </div>
  );
}
