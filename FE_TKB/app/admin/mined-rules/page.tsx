'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, RefreshCw, Check, Users, BookOpen, School } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface MinedPattern {
  kind: 'TEACHER_AVOIDS_CELL' | 'SUBJECT_AVOIDS_CELL' | 'CLASS_AVOIDS_CELL';
  title: string;
  detail: string;
  suggestion: string;
  observations: number;
  confidence: number;
  proposal?: { teacherId?: string; teacherCode?: string; day: number; period: number; session: number };
}

const ICONS = {
  TEACHER_AVOIDS_CELL: Users,
  SUBJECT_AVOIDS_CELL: BookOpen,
  CLASS_AVOIDS_CELL: School,
};

export default function MinedRulesPage() {
  const [patterns, setPatterns] = useState<MinedPattern[]>([]);
  const [facts, setFacts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [accepted, setAccepted] = useState<Record<number, 'saving' | 'done' | string>>({});

  const authHeaders = () => ({
    'Content-Type': 'application/json',
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

      const res = await fetch(`${API_URL}/algorithm/mined-rules/${semester.id}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns ?? []);
        setFacts(data.facts ?? 0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (index: number, pattern: MinedPattern) => {
    if (!pattern.proposal?.teacherId) return;
    setAccepted((prev) => ({ ...prev, [index]: 'saving' }));

    try {
      const res = await fetch(`${API_URL}/algorithm/mined-rules/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          teacherId: pattern.proposal.teacherId,
          day: pattern.proposal.day,
          period: pattern.proposal.period,
          session: pattern.proposal.session,
        }),
      });
      const body = await res.json().catch(() => ({}));
      setAccepted((prev) => ({
        ...prev,
        [index]: res.ok ? 'done' : (body.message ?? 'Không lưu được'),
      }));
    } catch {
      setAccepted((prev) => ({ ...prev, [index]: 'Không kết nối được máy chủ' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            <Lightbulb size={24} className="text-amber-500" />
            Quy luật ẩn
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Mỗi lần bạn kéo một tiết đi chỗ khác là một điều bạn biết về trường mà phần mềm
            chưa biết. Đây là những gì hệ thống đọc được từ {facts} lần chỉnh tay gần nhất.
          </p>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          Phân tích lại
        </button>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">Đang phân tích…</p>
      ) : patterns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-default)] p-10 text-center">
          <Lightbulb size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-primary)]">Chưa đủ dữ liệu để rút ra quy luật</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Cần ít nhất 3 lần chỉnh cùng một khung giờ. Càng dùng lâu, hệ thống càng hiểu trường bạn.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {patterns.map((pattern, index) => {
            const Icon = ICONS[pattern.kind];
            const state = accepted[index];

            return (
              <li
                key={`${pattern.kind}-${index}`}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2">
                    <Icon size={18} className="text-amber-600" />
                  </div>

                  <div className="min-w-56 flex-1">
                    <p className="font-semibold text-[var(--text-primary)]">{pattern.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{pattern.detail}</p>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{pattern.suggestion}</p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        pattern.confidence >= 80
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {pattern.confidence}% · {pattern.observations} lần
                    </span>

                    {pattern.proposal?.teacherId &&
                      (state === 'done' ? (
                        <span className="flex items-center gap-1 text-sm text-emerald-600">
                          <Check size={15} /> Đã thêm lịch bận
                        </span>
                      ) : (
                        <button
                          onClick={() => accept(index, pattern)}
                          disabled={state === 'saving'}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {state === 'saving' ? 'Đang lưu…' : 'Đúng, thêm ràng buộc'}
                        </button>
                      ))}

                    {typeof state === 'string' && state !== 'saving' && state !== 'done' && (
                      <span className="max-w-48 text-right text-xs text-red-600">{state}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Hệ thống chỉ đặt câu hỏi, không tự thêm ràng buộc — cùng một thao tác kéo có thể do
        nhiều lý do khác nhau, chỉ người xếp lịch mới biết lý do thật.
      </p>
    </div>
  );
}
