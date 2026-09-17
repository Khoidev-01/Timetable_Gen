'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileText, Loader2, Send, X } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface Step {
  tool: string;
  ok: boolean;
  note?: string;
}

interface Citation {
  source: string;
  article: string | null;
  title: string;
  body: string;
}

interface Confirmation {
  action: string;
  summary: string;
  payload: Record<string, unknown>;
}

interface Turn {
  question: string;
  steps: Step[];
  answer?: string;
  error?: string;
  citations?: Citation[];
  confirmation?: Confirmation;
  confirmed?: 'saving' | 'done' | string;
}

/** What each tool is doing, in words a teacher would use. */
const STEP_LABEL: Record<string, string> = {
  get_my_schedule: 'Đang tra lịch dạy',
  get_class_schedule: 'Đang tra lịch của lớp',
  get_teacher_workload: 'Đang tính tải giảng dạy',
  find_free_teachers: 'Đang tìm giáo viên rảnh',
  find_swap_candidates: 'Đang tìm tiết đổi được',
  check_swap_feasibility: 'Đang kiểm tra ràng buộc',
  explain_slot: 'Đang xem vì sao tiết nằm ở đó',
  search_regulations: 'Đang tra quy định',
  create_busy_registration: 'Đang soạn đơn xin nghỉ',
};

const TEACHER_SUGGESTIONS = [
  'Tuần này tôi dạy bao nhiêu tiết?',
  'Tuần này tôi có tiết trống nào?',
  'Lịch dạy của tôi thứ hai có gì?',
];

const ADMIN_SUGGESTIONS = [
  'Thứ năm tiết 3 có giáo viên nào rảnh không?',
  'Lịch của lớp 10A1 trong tuần này thế nào?',
  'Định mức tiết dạy của giáo viên THPT là bao nhiêu?',
];

/**
 * The assistant, inside the app.
 *
 * Streams what it is doing rather than what it is typing. "Đang tra lịch dạy…" tells a
 * teacher which data the answer will come from; a stream of half-formed words tells them
 * nothing and makes a wrong answer look authoritative while it is still forming.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [showInitialSuggestions, setShowInitialSuggestions] = useState(false);
  const [role, setRole] = useState<'ADMIN' | 'TEACHER' | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const suggestions = role === 'TEACHER' ? TEACHER_SUGGESTIONS : ADMIN_SUGGESTIONS;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
      setRole(savedUser.role === 'TEACHER' ? 'TEACHER' : 'ADMIN');
    } catch {
      setRole('ADMIN');
    }
  }, []);

  useEffect(() => {
    if (!open || ready !== null) return;
    fetch(`${API_URL}/ai/status`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        setReady(Boolean(body?.ready));
      })
      .catch(() => setReady(false));
  }, [open, ready]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isAsking]);

  const openAssistant = () => {
    setShowInitialSuggestions(!hasOpenedRef.current);
    hasOpenedRef.current = true;
    setOpen(true);
  };

  const closeAssistant = () => {
    setShowInitialSuggestions(false);
    setOpen(false);
  };

  const ask = useCallback(
    async (text: string) => {
      const asked = text.trim();
      if (!asked || isAsking) return;

      setQuestion('');
      setIsAsking(true);
      setTurns((prev) => [...prev, { question: asked, steps: [] }]);

      const update = (patch: (turn: Turn) => Turn) =>
        setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? patch(t) : t)));

      try {
        const response = await fetch(`${API_URL}/ai/ask`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ question: asked }),
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => ({}));
          update((t) => ({ ...t, error: body.message ?? 'Trợ lý không trả lời được.' }));
          return;
        }

        // Server-sent events, parsed by hand: EventSource cannot send an Authorization
        // header, and the token is not going in the query string where it would be logged
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const event = chunk.match(/^event: (.+)$/m)?.[1];
            const raw = chunk.match(/^data: (.+)$/m)?.[1];
            if (!event || !raw) continue;

            const data = JSON.parse(raw);
            if (event === 'step') update((t) => ({ ...t, steps: [...t.steps, data] }));
            if (event === 'answer') {
              update((t) => ({
                ...t,
                answer: data.answer,
                confirmation: data.confirmation,
                citations: data.citations,
              }));
            }
            if (event === 'error') update((t) => ({ ...t, error: data.message }));
          }
        }
      } catch {
        update((t) => ({ ...t, error: 'Mất kết nối tới máy chủ.' }));
      } finally {
        setIsAsking(false);
      }
    },
    [isAsking],
  );

  const confirm = async (index: number, confirmation: Confirmation) => {
    setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, confirmed: 'saving' } : t)));
    try {
      const res = await fetch(`${API_URL}/ai/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: confirmation.action, payload: confirmation.payload }),
      });
      const body = await res.json().catch(() => ({}));
      setTurns((prev) =>
        prev.map((t, i) =>
          i === index ? { ...t, confirmed: res.ok ? 'done' : (body.message ?? 'Không gửi được') } : t,
        ),
      );
    } catch {
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, confirmed: 'Mất kết nối' } : t)));
    }
  };

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <div className="shrink-0 motion-safe:animate-[assistant-breathe_4s_ease-in-out_infinite]">
          <button
            type="button"
            onClick={openAssistant}
            aria-label="Mở trợ lý MiKi"
            className="group relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 shadow-[0_10px_22px_rgba(37,99,235,0.3)] ring-[3px] ring-white/80 transition-[transform,box-shadow] duration-200 hover:scale-[1.03] hover:shadow-[0_12px_26px_rgba(37,99,235,0.36)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 active:scale-95"
          >
            <span className="absolute inset-1 rounded-full bg-white/10" aria-hidden="true" />
            <Image
              src="/images/assistant/miki-assistant-3d.png"
              alt=""
              width={64}
              height={64}
              priority
              className="relative h-[52px] w-[52px] select-none object-contain drop-shadow-[0_4px_6px_rgba(15,23,42,0.22)] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            <span className="absolute right-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[min(34rem,80vh)] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl">
      <header className="flex items-center gap-2 border-b border-[var(--border-default)] bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-white">
        <Image src="/images/assistant/miki-assistant-3d.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Trợ lý thời khóa biểu</p>
        </div>
        <button onClick={closeAssistant} aria-label="Đóng" className="rounded p-1 hover:bg-white/20">
          <X size={17} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {ready === false && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Trợ lý chưa được cấu hình trên máy chủ. Mọi chức năng khác vẫn hoạt động bình thường.
          </p>
        )}

        {turns.length === 0 && showInitialSuggestions && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-muted)]">Thử hỏi:</p>
            {suggestions.map((text) => (
              <button
                key={text}
                onClick={() => ask(text)}
                disabled={ready === false}
                className="block w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {turns.map((turn, index) => (
          <div key={index} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-sm text-white">
              {turn.question}
            </p>

            {turn.steps.map((step, i) => (
              <p key={i} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className={`h-1.5 w-1.5 rounded-full ${step.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {STEP_LABEL[step.tool] ?? step.tool}
                {!step.ok && step.note && <span className="italic"> - {step.note}</span>}
              </p>
            ))}

            {turn.answer && (
              <p className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[var(--bg-surface-hover)] px-3 py-2 text-sm text-[var(--text-primary)]">
                {turn.answer}
              </p>
            )}

            {turn.citations && turn.citations.length > 0 && (
              <div className="max-w-[92%] space-y-1">
                {turn.citations.map((citation, i) => (
                  <details
                    key={i}
                    className="group rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <FileText size={12} className="shrink-0 text-blue-500" />
                      <span className="font-medium">{citation.source}</span>
                      {citation.article && <span className="text-[var(--text-muted)]">· {citation.article}</span>}
                      <ChevronDown size={12} className="ml-auto shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-1.5 text-xs font-medium text-[var(--text-primary)]">{citation.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                      {citation.body}
                    </p>
                  </details>
                ))}
              </div>
            )}

            {turn.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{turn.error}</p>
            )}

            {turn.confirmation && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">{turn.confirmation.summary}</p>
                <p className="mt-1 text-xs text-amber-800">
                  Trợ lý không tự gửi. Bấm xác nhận thì đơn mới được tạo.
                </p>

                {turn.confirmed === 'done' ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
                    <Check size={15} /> Đã gửi, chờ quản trị viên duyệt
                  </p>
                ) : (
                  <button
                    onClick={() => confirm(index, turn.confirmation!)}
                    disabled={turn.confirmed === 'saving'}
                    className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {turn.confirmed === 'saving' ? 'Đang gửi…' : 'Xác nhận gửi'}
                  </button>
                )}

                {typeof turn.confirmed === 'string' &&
                  !['saving', 'done'].includes(turn.confirmed) && (
                    <p className="mt-2 text-sm text-red-700">{turn.confirmed}</p>
                  )}
              </div>
            )}
          </div>
        ))}

        {isAsking && (
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 size={15} className="animate-spin" /> Đang suy nghĩ…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2 border-t border-[var(--border-default)] p-3"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Hỏi về thời khóa biểu…"
          maxLength={500}
          disabled={ready === false}
          className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isAsking || !question.trim() || ready === false}
          className="rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
