'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileText, Loader2, MessageSquarePlus, Send, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import TypedAnswer from './assistant/TypedAnswer';
import { AccountAvatar, MyAccount } from './account/MyAccountDialog';

type DockSide = 'left' | 'right';

const DOCK_KEY = 'assistant-dock-side';
/** Kéo quá ngần này điểm ảnh mới tính là kéo; ít hơn là một cú bấm tay run. */
const DRAG_THRESHOLD = 6;

function readDockSide(): DockSide {
  try {
    return localStorage.getItem(DOCK_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

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

const THINKING_MESSAGES = [
  'Đang suy luận…',
  'Đang tìm kiếm dữ liệu phù hợp…',
  'Đang kiểm tra thông tin…',
  'Đang tổng hợp câu trả lời…',
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

  /**
   * Nút trợ lý kéo được, nhưng chỉ đỗ ở hai chỗ: góc dưới bên phải như cũ, hoặc góc dưới bên
   * trái đối diện. Thả ở nửa nào của màn hình thì nhảy về góc bên đó, và nhớ cho lần sau.
   */
  const [dockSide, setDockSide] = useState<DockSide>('right');
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);

  useEffect(() => {
    setDockSide(readDockSide());
  }, []);

  // Ben trai thi dat sat mep phai thanh menu chu khong sat mep man hinh: sat mep man hinh la
  // de len nut Dang xuat. Thanh menu thu gon / mo rong duoc nen do lai moi khi no doi co.
  const [sidebarRight, setSidebarRight] = useState(0);
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>('[data-app-sidebar]');
    if (!sidebar) return;
    const measure = () => {
      const box = sidebar.getBoundingClientRect();
      setSidebarRight(box.width > 0 && box.right > 0 ? box.right : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sidebar);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const [ready, setReady] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  // Only an answer received while this panel is open may use the typing effect.
  // The last history item is still the last item after reopening, so its index alone
  // cannot distinguish a new answer from an old one.
  const [animatingAnswerIndex, setAnimatingAnswerIndex] = useState<number | null>(null);
  const [showInitialSuggestions, setShowInitialSuggestions] = useState(false);
  const [role, setRole] = useState<'ADMIN' | 'TEACHER' | null>(null);
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [displayName, setDisplayName] = useState('Bạn');
  const endRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  // Bối cảnh gửi kèm mỗi câu hỏi: tóm tắt do máy chủ nén + các lượt chưa nén. Dùng ref vì
  // ask() được ghi nhớ theo isAsking, đọc state trực tiếp sẽ bị cũ.
  const turnsRef = useRef<Turn[]>([]);
  const openRef = useRef(false);
  const memoryRef = useRef<{ summary: string | null; folded: number }>({ summary: null, folded: 0 });
  const [foldedTurns, setFoldedTurns] = useState(0);
  turnsRef.current = turns;

  const startNewConversation = () => {
    setTurns([]);
    setAnimatingAnswerIndex(null);
    memoryRef.current = { summary: null, folded: 0 };
    setFoldedTurns(0);
    setShowInitialSuggestions(true);
  };
  const suggestions = role === 'TEACHER' ? TEACHER_SUGGESTIONS : ADMIN_SUGGESTIONS;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
      setRole(savedUser.role === 'TEACHER' ? 'TEACHER' : 'ADMIN');
      setDisplayName(savedUser.full_name || savedUser.username || 'Bạn');
    } catch {
      setRole('ADMIN');
    }
    // Ảnh đại diện cạnh câu hỏi lấy từ "Tài khoản của tôi"; không có thì hiện chữ cái đầu
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setAccount(data);
        if (data.profile?.full_name) setDisplayName(data.profile.full_name);
      })
      .catch(() => undefined);
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

  useEffect(() => {
    if (!isAsking) return;

    const timer = window.setInterval(() => {
      setThinkingMessageIndex((current) => (current + 1) % THINKING_MESSAGES.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isAsking]);

  const openAssistant = () => {
    openRef.current = true;
    setShowInitialSuggestions(!hasOpenedRef.current);
    hasOpenedRef.current = true;
    setOpen(true);
  };

  const closeAssistant = () => {
    openRef.current = false;
    setAnimatingAnswerIndex(null);
    setShowInitialSuggestions(false);
    setOpen(false);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setDragPoint({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;

    if (!drag.moved) {
      openAssistant();
      return;
    }

    const side: DockSide = event.clientX < window.innerWidth / 2 ? 'left' : 'right';
    setDockSide(side);
    setDragPoint(null);
    try {
      localStorage.setItem(DOCK_KEY, side);
    } catch {
      // Không nhớ được vị trí thì lần sau về chỗ mặc định, không sao
    }
  };

  const dockClass = dockSide === 'left' ? '' : 'right-5';
  const dockStyle = dockSide === 'left' ? { left: sidebarRight + 20 } : undefined;
  const ask = useCallback(
    async (text: string) => {
      const asked = text.trim();
      if (!asked || isAsking) return;
      const turnIndex = turnsRef.current.length;

      setQuestion('');
      setThinkingMessageIndex(0);
      setIsAsking(true);
      setTurns((prev) => [...prev, { question: asked, steps: [] }]);

      const update = (patch: (turn: Turn) => Turn) =>
        setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? patch(t) : t)));

      try {
        const response = await fetch(`${API_URL}/ai/ask`, {
          method: 'POST',
          headers: authHeaders(),
          // Tóm tắt cũ + các lượt chưa nén, để trợ lý hiểu câu nối tiếp; "Hội thoại mới" xóa sạch
          body: JSON.stringify({
            question: asked,
            summary: memoryRef.current.summary,
            history: turnsRef.current
              .filter((t) => t.answer)
              .slice(memoryRef.current.folded)
              .map((t) => ({ question: t.question, answer: t.answer })),
          }),
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
              if (openRef.current) setAnimatingAnswerIndex(turnIndex);
              if (data.memory) {
                memoryRef.current = {
                  summary: data.memory.summary ?? null,
                  folded: memoryRef.current.folded + (data.memory.consumed ?? 0),
                };
                setFoldedTurns(memoryRef.current.folded);
              }
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
      <div
        className={dragPoint ? 'fixed z-50' : `fixed bottom-5 z-50 ${dockClass}`}
        style={dragPoint ? { left: dragPoint.x, top: dragPoint.y } : dockStyle}
      >
        <div className="shrink-0 motion-safe:animate-[assistant-breathe_4s_ease-in-out_infinite]">
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragRef.current = null; setDragPoint(null); }}
            // Ảnh bên trong mặc định kéo được: trình duyệt sẽ bắt đầu kéo ảnh và huỷ thao tác kéo nút
            onDragStart={(event) => event.preventDefault()}
            // Bàn phím không kéo được: Enter và Space vẫn mở trợ lý như trước
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openAssistant(); } }}
            aria-label="Mở trợ lý MiKi (kéo sang trái hoặc phải để đổi chỗ)"
            className={`group relative touch-none ${dragPoint ? 'cursor-grabbing' : 'cursor-grab'} flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 shadow-[0_10px_22px_rgba(37,99,235,0.3)] ring-[3px] ring-white/80 transition-[transform,box-shadow] duration-200 hover:scale-[1.03] hover:shadow-[0_12px_26px_rgba(37,99,235,0.36)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 active:scale-95`}
          >
            <span className="absolute inset-1 rounded-full bg-white/10" aria-hidden="true" />
            <Image
              src="/images/assistant/miki-assistant-3d.png"
              alt=""
              width={64}
              height={64}
              priority
              draggable={false}
              className="relative h-[52px] w-[52px] select-none object-contain drop-shadow-[0_4px_6px_rgba(15,23,42,0.22)] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            <span className="absolute right-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={dockStyle} className={`fixed bottom-5 ${dockClass} z-50 flex h-[min(34rem,80vh)] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl`}>
      <header className="flex items-center gap-2 border-b border-[var(--border-default)] bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-white">
        <Image src="/images/assistant/miki-assistant-3d.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Trợ lý thời khóa biểu</p>
        </div>
        <div className="flex items-center gap-1">
          {turns.length > 0 && (
            <button
              type="button"
              onClick={startNewConversation}
              disabled={isAsking}
              title="Xóa hội thoại hiện tại và bắt đầu lại"
              aria-label="Hội thoại mới"
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-white/20 disabled:opacity-50"
            >
              <MessageSquarePlus size={15} /> Hội thoại mới
            </button>
          )}
          {foldedTurns > 0 && (
            <span
              title="Các lượt cũ đã được nén thành ghi nhớ nên trợ lý vẫn nhớ, không cần hỏi lại"
              className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]"
            >
              nhớ {foldedTurns} lượt cũ
            </span>
          )}
          <button onClick={closeAssistant} aria-label="Đóng" className="rounded p-1 hover:bg-white/20">
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {ready === false && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Trợ lý chưa được cấu hình trên máy chủ. Mọi chức năng khác vẫn hoạt động bình thường.
          </p>
        )}

        {turns.length === 0 && showInitialSuggestions && (
          <div className="space-y-2">
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
            <div className="flex items-end justify-end gap-2">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-sm text-white">
                {turn.question}
              </p>
              <AccountAvatar account={account} name={displayName} size={28} className="shrink-0" />
            </div>

            {turn.answer && (
              <div className="flex items-end gap-2">
                <Image
                  src="/images/assistant/miki-assistant-3d.png"
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full bg-white object-contain ring-1 ring-[var(--border-default)]"
                />
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--bg-surface-hover)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {/* Chỉ câu vừa nhận trong lần mở hiện tại gõ dần; mở lại thì lịch sử hiện ngay. */}
                  <TypedAnswer
                    text={turn.answer}
                    animate={index === animatingAnswerIndex}
                    onProgress={() => endRef.current?.scrollIntoView({ block: 'end' })}
                  />
                </div>
              </div>
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
          <div className="flex items-center gap-2">
            <Image src="/images/assistant/miki-assistant-3d.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full bg-white object-contain ring-1 ring-[var(--border-default)]" />
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
            >
              <Loader2 size={15} className="animate-spin" />
              {THINKING_MESSAGES[thinkingMessageIndex]}
            </p>
          </div>
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
