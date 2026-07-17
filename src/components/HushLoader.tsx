import { useEffect, useRef, useState } from "react";
import { HUSH_PATHS } from "./HushLogo";

type Props = { onDone: () => void; minDuration?: number };

const CONFIG = [
  { dur: 1.05, delay: 0.05 },
  { dur: 1.35, delay: 0.42 },
  { dur: 1.75, delay: 0.9 },
  { dur: 1.05, delay: 1.85 },
];

export function HushLoader({ onDone, minDuration = 3400 }: Props) {
  const refs = useRef<(SVGPathElement | null)[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = Date.now();

    if (reduced) {
      const t = setTimeout(onDone, minDuration);
      return () => clearTimeout(t);
    }

    refs.current.forEach((p, i) => {
      if (!p) return;
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.fillOpacity = "0";
      p.style.strokeOpacity = "1";
    });

    // force reflow
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

    const total = Math.max(...CONFIG.map((c) => c.delay + c.dur)) * 1000 + 500;
    const settleT = setTimeout(() => setSettled(true), total);
    const doneT = setTimeout(() => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minDuration - elapsed);
      setTimeout(onDone, wait);
    }, total);

    return () => {
      clearTimeout(settleT);
      clearTimeout(doneT);
    };
  }, [onDone, minDuration]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="w-[min(78vw,640px)]">
        <svg
          className={settled ? "hush-settled block w-full h-auto" : "block w-full h-auto"}
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
    </div>
  );
}
