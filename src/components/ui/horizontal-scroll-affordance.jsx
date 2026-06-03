import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_FADE_LEFT =
  "linear-gradient(90deg, #f1f5f9 15%, rgba(241, 245, 249, 0) 100%)";
const DEFAULT_FADE_RIGHT =
  "linear-gradient(270deg, #f1f5f9 15%, rgba(241, 245, 249, 0) 100%)";

const PROVIDER_FADE_LEFT =
  "linear-gradient(90deg, #f5f2ff 15%, rgba(245, 242, 255, 0) 100%)";
const PROVIDER_FADE_RIGHT =
  "linear-gradient(270deg, #f5f2ff 15%, rgba(245, 242, 255, 0) 100%)";

const SCROLL_BTN_CLASS =
  "absolute top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-90";

const SCROLL_BTN_STYLE = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(30,37,53,0.1)",
  boxShadow: "0 2px 10px rgba(30,37,53,0.12)",
};

const SCROLL_ICON_COLOR = "rgba(30,37,53,0.38)";

export function HorizontalScrollAffordance({
  children,
  className,
  variant = "default",
  fadeLeft,
  fadeRight,
}) {
  const resolvedFadeLeft =
    fadeLeft ?? (variant === "provider" ? PROVIDER_FADE_LEFT : DEFAULT_FADE_LEFT);
  const resolvedFadeRight =
    fadeRight ?? (variant === "provider" ? PROVIDER_FADE_RIGHT : DEFAULT_FADE_RIGHT);

  const scrollRef = useRef(null);
  const [scrollHints, setScrollHints] = useState({
    overflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const refreshScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setScrollHints({
      overflow,
      canScrollLeft: overflow && el.scrollLeft > 4,
      canScrollRight: overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    refreshScrollHints();
    el.addEventListener("scroll", refreshScrollHints, { passive: true });
    const observer = new ResizeObserver(refreshScrollHints);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", refreshScrollHints);
      observer.disconnect();
    };
  }, [refreshScrollHints]);

  const scrollContent = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -el.clientWidth * 0.65 : el.clientWidth * 0.65,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative min-w-0", className)}>
      {scrollHints.overflow && scrollHints.canScrollLeft ? (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-11 z-10 pointer-events-none"
            style={{ background: resolvedFadeLeft }}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollContent("left")}
            aria-label="Scroll left"
            className={cn(SCROLL_BTN_CLASS, "left-0")}
            style={SCROLL_BTN_STYLE}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: SCROLL_ICON_COLOR }} />
          </button>
        </>
      ) : null}

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide scroll-smooth"
        style={{
          paddingLeft: scrollHints.overflow && scrollHints.canScrollLeft ? 34 : 0,
          paddingRight: scrollHints.overflow && scrollHints.canScrollRight ? 4 : 0,
        }}
      >
        {children}
      </div>

      {scrollHints.overflow && scrollHints.canScrollRight ? (
        <>
          <div
            className="absolute right-0 top-0 bottom-0 w-14 z-10 pointer-events-none"
            style={{ background: resolvedFadeRight }}
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollContent("right")}
            aria-label="Scroll right"
            className={cn(SCROLL_BTN_CLASS, "right-0")}
            style={SCROLL_BTN_STYLE}
          >
            <ChevronRight className="w-4 h-4" style={{ color: SCROLL_ICON_COLOR }} />
          </button>
        </>
      ) : null}
    </div>
  );
}
