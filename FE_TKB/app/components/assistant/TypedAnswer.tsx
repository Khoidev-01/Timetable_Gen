'use client';

import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Câu trả lời của trợ lý hiện dần từng chữ như đang gõ, rồi đứng yên khi gõ xong.
 *
 * Máy chủ trả cả câu một lần (nó chỉ phát các bước tra cứu theo thời gian thực), nên hiệu
 * ứng gõ nằm ở phía trình duyệt. Chữ hiện theo nhịp đều, dài ngắn gì cũng xong trong vài giây;
 * bấm vào câu trả lời thì hiện hết ngay.
 */
export default function TypedAnswer({
  text,
  animate = true,
  onProgress,
}: {
  text: string;
  /** false: hiện ngay (câu trả lời cũ khi mở lại hộp thoại) */
  animate?: boolean;
  /** Gọi mỗi lần thêm chữ, để khung chat cuộn theo */
  onProgress?: () => void;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    // Khoảng 45 ký tự mỗi giây, nhưng câu dài thì gõ nhanh hơn để không quá 6 giây
    const step = Math.max(1, Math.ceil(text.length / (6000 / 22)));
    timer.current = setInterval(() => {
      setShown((current) => {
        const next = Math.min(text.length, current + step);
        if (next >= text.length && timer.current) clearInterval(timer.current);
        return next;
      });
      onProgress?.();
    }, 22);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  const done = shown >= text.length;
  const visible = text.slice(0, shown);

  return (
    <div
      onClick={() => {
        if (timer.current) clearInterval(timer.current);
        setShown(text.length);
      }}
      title={done ? undefined : 'Bấm để hiện hết'}
      className={done ? undefined : 'cursor-pointer'}
    >
      {renderLightMarkdown(visible)}
      {!done && <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-current align-text-bottom" aria-hidden="true" />}
    </div>
  );
}

/** Chỉ hỗ trợ **đậm**, gạch đầu dòng "- " và xuống dòng: đủ cho câu trả lời của trợ lý. */
export function renderLightMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(<ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">{bullets}</ul>);
      bullets = [];
    }
  };
  lines.forEach((line, i) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      bullets.push(<li key={i}>{inline(bullet[1])}</li>);
      return;
    }
    flushBullets();
    if (line.trim() === '') {
      blocks.push(<div key={i} className="h-2" />);
      return;
    }
    blocks.push(<p key={i}>{inline(line)}</p>);
  });
  flushBullets();
  return <>{blocks}</>;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  );
}
