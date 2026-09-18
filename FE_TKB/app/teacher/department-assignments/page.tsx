'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Send, TriangleAlert, Upload } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Issue {
  level: 'ERROR' | 'WARNING';
  message: string;
}

interface Mine {
  yearName: string;
  department: string;
  head: { code: string; name: string };
  subjects: Array<{ code: string; name: string }>;
  rowCount: number;
  teacherCount: number;
  latest: null | { fileName: string; submittedAt: string; rows: number; issues: Issue[] };
}

interface SubmitResult {
  submittedAt: string;
  rows: number;
  filled: number;
  issues: Issue[];
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 size={16} /> Không có lỗi hay cảnh báo nào.
      </p>
    );
  }
  const errors = issues.filter((i) => i.level === 'ERROR');
  const warnings = issues.filter((i) => i.level === 'WARNING');
  return (
    <div className="space-y-3 text-sm">
      {errors.length > 0 && (
        <div>
          <p className="font-semibold text-red-700">{errors.length} lỗi - sửa file rồi nộp lại</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700">
            {errors.map((issue, i) => <li key={i}>{issue.message}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="font-semibold text-amber-700">{warnings.length} cảnh báo</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-700">
            {warnings.map((issue, i) => <li key={i}>{issue.message}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Tổ trưởng nộp bảng phân công của tổ: tải mẫu đã điền sẵn lớp và môn, điền mã giáo viên,
 * tải lên, nộp. Bài nộp được gửi về admin để tổng hợp.
 */
export default function DepartmentAssignmentsPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/department-assignments/mine`, { headers: authHeader() });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? 'Không tải được thông tin tổ.');
        return;
      }
      setMine(body);
    } catch {
      setError('Lỗi kết nối.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_URL}/department-assignments/mine/template`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      // Header tên file không đọc được khi gọi khác cổng (CORS), nên đặt tên theo tổ
      const name = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? `phan-cong-${mine?.department ?? 'to'}-${mine?.yearName ?? ''}.xlsx`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Không tải được mẫu', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const submit = async () => {
    if (!file) return;
    setIsSubmitting(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/department-assignments/mine/submit`, { method: 'POST', headers: authHeader(), body: form });
      const body = await res.json();
      if (!res.ok) {
        toast(body?.message ?? 'Nộp không thành công', 'error');
        return;
      }
      setResult(body);
      setFile(null);
      toast('Đã nộp bảng phân công của tổ', 'success');
      load();
    } catch {
      toast('Lỗi kết nối', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">{error}</p>;
  }
  if (!mine) {
    return <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang tải…</p>;
  }

  const card = 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
          <FileSpreadsheet size={24} className="text-emerald-600" />
          Phân công tổ
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {mine.department} · Năm học {mine.yearName} · Tổ trưởng {mine.head.name}
        </p>
      </div>

      <section className={card} aria-labelledby="step-1">
        <h2 id="step-1" className="font-semibold text-[var(--text-primary)]">1. Tải mẫu của tổ</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Mẫu đã có sẵn {mine.rowCount} dòng Lớp - Môn mà tổ phụ trách ({mine.subjects.map((s) => s.name).join(', ')}).
          Chỉ cần điền mã giáo viên cho học kỳ 1 (và học kỳ 2 nếu đổi người). Dòng bỏ trống hệ thống sẽ tự phân công.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={isDownloading}
          className="mt-4 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
        >
          {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Tải mẫu phân công
        </button>
      </section>

      <section className={card} aria-labelledby="step-2">
        <h2 id="step-2" className="font-semibold text-[var(--text-primary)]">2. Tải file đã điền lên và nộp</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            data-department-file
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <Upload size={16} />
            {file ? 'Chọn file khác' : 'Chọn file .xlsx'}
          </button>
          {file && <span className="text-sm text-[var(--text-primary)]">{file.name}</span>}
          <button
            type="button"
            onClick={submit}
            disabled={!file || isSubmitting}
            className="ml-auto flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Nộp
          </button>
        </div>
        {result && (
          <div className="mt-5 border-t border-[var(--border-light)] pt-4">
            <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
              Đã nộp: {result.filled}/{result.rows} dòng có giáo viên
            </p>
            <IssueList issues={result.issues} />
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="latest">
        <h2 id="latest" className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          {mine.latest ? <CheckCircle2 size={18} className="text-emerald-600" /> : <TriangleAlert size={18} className="text-amber-500" />}
          Bài nộp gần nhất
        </h2>
        {mine.latest ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {mine.latest.fileName} · {new Date(mine.latest.submittedAt).toLocaleString('vi-VN')} · {mine.latest.rows} dòng
            </p>
            <IssueList issues={mine.latest.issues} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Tổ chưa nộp bảng phân công cho năm học này.</p>
        )}
      </section>
    </div>
  );
}
