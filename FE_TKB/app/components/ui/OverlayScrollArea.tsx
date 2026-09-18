'use client';

import { HTMLAttributes, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Vùng cuộn có thanh cuộn nổi đè lên nội dung.
 *
 * Thanh cuộn gốc của trình duyệt chiếm một dải bề ngang: trang dài thì nó hiện ra và đẩy mọi
 * thứ sang trái, trang ngắn thì mất đi và mọi thứ nhảy lại. Ở đây thanh cuộn gốc bị ẩn, và
 * một thanh mảnh được vẽ nổi ở mép phải, trên cùng mọi lớp — nội dung không bao giờ bị xê dịch.
 * Thanh vẫn kéo được bằng chuột như thanh cuộn thật.
 */
export default function OverlayScrollArea({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [thumb, setThumb] = useState({ top: 0, height: 0, scrollable: false });
  const [shown, setShown] = useState(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ top: 0, height: 0, scrollable: false });
      return;
    }
    const height = Math.max(32, (clientHeight * clientHeight) / scrollHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ top, height, scrollable: true });
  }, []);

  const flash = useCallback(() => {
    setShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragRef.current) setShown(false);
    }, 1200);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const onScroll = () => {
      measure();
      flash();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Nội dung đổi chiều cao (tải xong dữ liệu, mở rộng một khung) thì đo lại
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [measure, flash]);

  const onThumbDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startScroll: el.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
    setShown(true);
  };

  const onThumbMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag) return;
    const travel = el.clientHeight - thumb.height;
    if (travel <= 0) return;
    const ratio = (el.scrollHeight - el.clientHeight) / travel;
    el.scrollTop = drag.startScroll + (event.clientY - drag.startY) * ratio;
  };

  const onThumbUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    flash();
  };

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <main ref={scrollRef} className={`scrollbar-hidden h-full overflow-auto ${className}`} {...rest}>
        <div ref={contentRef}>{children}</div>
      </main>

      {thumb.scrollable && (
        <div
          className="group absolute bottom-0 right-0 top-0 z-[60] w-3 print:hidden"
          onPointerEnter={() => setShown(true)}
          onPointerLeave={() => flash()}
          aria-hidden="true"
        >
          <div
            data-overlay-scroll-thumb
            onPointerDown={onThumbDown}
            onPointerMove={onThumbMove}
            onPointerUp={onThumbUp}
            className={`absolute right-0.5 w-1.5 cursor-default touch-none rounded-full bg-slate-500/50 transition-[opacity,width] duration-200 group-hover:w-2 group-hover:bg-slate-500/70 ${
              shown ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ top: thumb.top, height: thumb.height }}
          />
        </div>
      )}
    </div>
  );
}
