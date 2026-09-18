'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, QrCode, Send } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { GradeBadge } from './QualityGrade';

interface TimetableSummary {
  id: string;
  name: string;
  createdAt: string;
  isOfficial: boolean;
  grade: string;
  hardViolations: number;
  isValid: boolean;
}

interface Props {
  semesterId: string;
  onPublished?: () => void;
}

/**
 * Công bố thời khóa biểu và lấy mã QR cho giáo viên.
 *
 * Thay cho bảng "So sánh phương án": hệ thống đã chốt một thuật toán và mỗi lần xếp chỉ lưu
 * bản tốt nhất, nên không còn gì để so. Nhưng việc công bố vẫn phải có chỗ làm — mỗi lần xếp
 * lại không tự công bố, và giáo viên chỉ thấy bản chính thức.
 */
export default function PublishPanel({ semesterId, onPublished }: Props) {
  const [latest, setLatest] = useState<TimetableSummary | null>(null);
  const [official, setOfficial] = useState<TimetableSummary | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [share, setShare] = useState<{ url: string; qrSvg: string } | null>(null);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const load = useCallback(async () => {
    if (!semesterId) return;
    try {
      const response = await fetch(`${API_URL}/algorithm/variants/${semesterId}`, { headers: authHeaders() });
      if (!response.ok) return;
      const list: TimetableSummary[] = await response.json();
      const newestFirst = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setLatest(newestFirst[0] ?? null);
      setOfficial(newestFirst.find((item) => item.isOfficial) ?? null);
    } catch (error) {
      console.error(error);
    }
  }, [semesterId]);

  useEffect(() => {
    load();
  }, [load]);

  const showShareLink = async (timetableId: string) => {
    try {
      const response = await fetch(`${API_URL}/algorithm/public-link/${timetableId}`, { headers: authHeaders() });
      if (response.ok) setShare(await response.json());
    } catch (error) {
      console.error(error);
    }
  };

  const publish = async (timetable: TimetableSummary) => {
    setPublishing(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/algorithm/publish/${timetable.id}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({ text: body?.message ?? 'Không công bố được thời khóa biểu.', ok: false });
        return;
      }
      setMessage({ text: 'Đã công bố. Giáo viên đã xem được thời khóa biểu này.', ok: true });
      await load();
      await showShareLink(timetable.id);
      onPublished?.();
    } catch (error) {
      console.error(error);
      setMessage({ text: 'Lỗi kết nối.', ok: false });
    } finally {
      setPublishing(false);
    }
  };

  if (!latest) return null;

  const latestIsOfficial = latest.isOfficial;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-[var(--text-primary)]">Công bố</span>

        {latestIsOfficial ? (
          <>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
              <BadgeCheck size={14} /> Bản mới nhất đã được công bố
            </span>
            <GradeBadge grade={latest.grade} />
          </>
        ) : (
          <>
            {/* Bản mới nhất không phải lúc nào cũng tốt hơn: đặt hai bậc cạnh nhau để người công
                bố thấy mình đang đổi bản Tốt lấy bản Khá, nếu đúng là vậy */}
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              Bản mới nhất chưa công bố <GradeBadge grade={latest.grade} />
            </span>
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              {official ? (
                <>
                  · Giáo viên đang xem <GradeBadge grade={official.grade} />
                </>
              ) : (
                '· Giáo viên chưa xem được thời khóa biểu nào'
              )}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {official && (
            <button
              type="button"
              onClick={() => showShareLink(official.id)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title="Mã QR của bản chính thức cho giáo viên quét"
            >
              <QrCode size={15} /> Mã QR
            </button>
          )}
          {!latestIsOfficial && (
            <button
              type="button"
              onClick={() => publish(latest)}
              disabled={!latest.isValid || publishing}
              title={latest.isValid ? 'Đặt bản mới nhất làm thời khóa biểu chính thức' : 'Bản này còn lỗi cứng'}
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={15} /> {publishing ? 'Đang công bố…' : 'Công bố bản mới nhất'}
            </button>
          )}
        </div>
      </div>

      {!latest.isValid && !latestIsOfficial && (
        <p className="mt-2 text-sm text-red-600">
          Bản mới nhất còn {latest.hardViolations} lỗi cứng nên chưa công bố được. Xếp lại hoặc sửa lỗi trước.
        </p>
      )}

      {message && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
      )}

      {share && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="shrink-0 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: share.qrSvg }} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-800">Liên kết công khai cho giáo viên</p>
            <p className="mt-1 text-sm text-emerald-700">
              Dán mã QR này lên bảng tin. Quét mã là xem được thời khóa biểu đã xếp theo từng lớp hoặc từng giáo viên, kèm lịch hôm nay có tính các tiết
              dạy thay - không cần tài khoản.
            </p>
            <code className="mt-2 block truncate rounded bg-white px-2 py-1 text-xs text-gray-600">{share.url}</code>
            <button
              type="button"
              onClick={() => setShare(null)}
              className="mt-4 min-h-11 rounded-lg bg-red-600 px-8 text-base font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
