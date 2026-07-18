import { useEffect, useRef, useState } from "react";
import { HUSH_PATHS } from "./HushLogo";

type LogoState = "drawing" | "settling" | "settled";

type Props = {
  /** Called once the intro draw finishes and the logo starts settling. */
  onSettleStart?: () => void;
  /** Called after the settle transition completes. */
  onSettled?: () => void;
  /** Where the logo lands: top-left small (connected) or top-centered medium (auth). */
  target?: "corner" | "auth";
};

const CONFIG = [
  { dur: 1.05, delay: 0.05 },
  { dur: 1.35, delay: 0.42 },
  { dur: 1.75, delay: 0.9 },
  { dur: 1.05, delay: 1.85 },
];

const TOTAL_DRAW_MS = Math.max(...CONFIG.map((c) => c.delay + c.dur)) * 1000 + 400;

export function GlobalLogo({ onSettleStart, onSettled, target = "corner" }: Props) {
  const refs = useRef<(SVGPathElement | null)[]>([]);
  const [state, setState] = useState<LogoState>("drawing");

  // Draw animation
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      refs.current.forEach((p) => { if (p) { p.style.fillOpacity = "1"; p.style.strokeOpacity = "0"; } });
      setState("settling");
      onSettleStart?.();
      return;
    }
    refs.current.forEach((p) => {
      if (!p) return;
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.fillOpacity = "0";
      p.style.strokeOpacity = "1";
    });
    void document.body.getBoundingClientRect();
    refs.current.forEach((p, i) => {
      if (!p) return;
      const { dur, delay } = CONFIG[i];
      const fillDelay = delay + dur * 0.72;
      p.style.transition = `stroke-dashoffset ${dur}s cubic-bezier(.65,.03,.34,1) ${delay}s, fill-opacity 1s ease ${fillDelay}s, stroke-opacity 0.7s ease ${fillDelay}s`;
      p.style.strokeDashoffset = "0";
      p.style.fillOpacity = "1";
      p.style.strokeOpacity = "0";
    });

    const t = setTimeout(() => {
      setState("settling");
      onSettleStart?.();
    }, TOTAL_DRAW_MS);
    return () => clearTimeout(t);
  }, [onSettleStart]);

  // After transitionend of the wrapper
  const onWrapperTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName === "transform" && state === "settling") {
      setState("settled");
      onSettled?.();
    }
  };

  // Choose layout classes based on state + target
  const drawing = state === "drawing";
  const corner = target === "corner";

  const wrapperStyle: React.CSSProperties = drawing
    ? {
        // Centered, large
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%) scale(1)",
        width: "min(78vw, 640px)",
        transition: "transform 0.9s cubic-bezier(.65,.03,.34,1), width 0.9s cubic-bezier(.65,.03,.34,1), left 0.9s cubic-bezier(.65,.03,.34,1), top 0.9s cubic-bezier(.65,.03,.34,1)",
      }
    : corner
    ? {
        position: "fixed",
        left: "1rem",
        top: "1rem",
        transform: "translate(0, 0) scale(1)",
        width: "5.5rem",
        transition: "transform 0.9s cubic-bezier(.65,.03,.34,1), width 0.9s cubic-bezier(.65,.03,.34,1), left 0.9s cubic-bezier(.65,.03,.34,1), top 0.9s cubic-bezier(.65,.03,.34,1)",
      }
    : {
        position: "fixed",
        left: "50%",
        top: "3.5rem",
        transform: "translate(-50%, 0) scale(1)",
        width: "min(60vw, 260px)",
        transition: "transform 0.9s cubic-bezier(.65,.03,.34,1), width 0.9s cubic-bezier(.65,.03,.34,1), left 0.9s cubic-bezier(.65,.03,.34,1), top 0.9s cubic-bezier(.65,.03,.34,1)",
      };

  return (
    <div
      className="pointer-events-none z-[100] text-foreground"
      style={wrapperStyle}
      onTransitionEnd={onWrapperTransitionEnd}
    >
      <svg
        className="block h-auto w-full"
        viewBox="200 320 1400 260"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="HUSH"
      >
        {HUSH_PATHS.map((d, i) => (
          <path
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            d={d}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ fillOpacity: 0 }}
          />
        ))}
      </svg>
    </div>
  );
}
