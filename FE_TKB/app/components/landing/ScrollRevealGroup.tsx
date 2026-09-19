"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollRevealGroupProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export default function ScrollRevealGroup({ children, className = "", ariaLabel }: ScrollRevealGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal-item]"));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        items.forEach((item, index) => {
          const isImage = item.dataset.revealKind === "image";
          item.animate(
            [
              { opacity: 0, transform: isImage ? "translateY(12px) scale(0.97)" : "translateY(16px)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
              duration: isImage ? 650 : 520,
              delay: Math.min(index * 100, 700),
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "both",
            },
          );
        });
        observer.unobserve(group);
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(group);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={groupRef} className={className} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
