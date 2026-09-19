"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppLogo from "../AppLogo";

/** Cuộn ít hơn chừng này thì coi như rung tay, không đổi trạng thái. */
const MOVE_THRESHOLD = 6;
/** Chưa qua khỏi vùng đầu trang thì luôn hiện, để lúc mới vào không thấy header nhấp nháy. */
const TOP_ZONE = 96;

/**
 * Header ẩn khi cuộn xuống, hiện lại khi cuộn lên.
 *
 * Bàn phím và trình đọc màn hình không cuộn bằng chuột: nếu người dùng tab tới một liên kết
 * đang bị giấu, header phải hiện lại, nếu không họ đang thao tác với thứ không nhìn thấy.
 */
export default function LandingHeader() {
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    lastScroll.current = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const current = window.scrollY;
        const delta = current - lastScroll.current;
        if (Math.abs(delta) < MOVE_THRESHOLD) return;
        lastScroll.current = current;
        setHidden(current > TOP_ZONE && delta > 0);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="landing-header" data-hidden={hidden ? "true" : undefined} onFocus={() => setHidden(false)}>
      <div className="landing-container flex h-[72px] items-center justify-between gap-6">
        <Link href="/" aria-label="MiKiTimetable, trang chủ" className="landing-brand-link">
          <AppLogo size="lg" tone="light" showSubtitle={false} />
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden items-center gap-8 md:flex">
          <a className="landing-nav-link" href="#tinh-nang">Tính năng</a>
          <a className="landing-nav-link" href="#cach-hoat-dong">Cách hoạt động</a>
          <a className="landing-nav-link" href="#tro-ly-miki">Trợ lý Miki</a>
        </nav>

        <Link className="landing-button landing-button--header" href="/login">
          Đăng nhập
        </Link>
      </div>
    </header>
  );
}
