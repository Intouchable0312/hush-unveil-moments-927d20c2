import { useEffect, useRef, useState } from "react";
import { ChevronsRight } from "lucide-react";

type Props = {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "destructive";
};

export function ActionSlider({ label, onConfirm, disabled, variant = "primary" }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [maxX, setMaxX] = useState(240);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const draggingRef = useRef(false);
  const xRef = useRef(0);

  useEffect(() => {
    const update = () => { if (trackRef.current) setMaxX(trackRef.current.clientWidth - 56); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { xRef.current = x; }, [x]);

  const start = (clientX: number) => {
    if (disabled || confirming || done) return;
    draggingRef.current = true;
    const origin = clientX - xRef.current;
    const move = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const cx = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const nx = Math.max(0, Math.min(maxX, cx - origin));
      setX(nx);
    };
    const end = async () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
      if (xRef.current >= maxX * 0.88) {
        setX(maxX);
        setConfirming(true);
        try {
          await onConfirm();
          setDone(true);
          setTimeout(() => { setDone(false); setX(0); }, 800);
        } catch {
          setX(0);
        } finally {
          setConfirming(false);
        }
      } else {
        setX(0);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
  };

  const bg = variant === "destructive" ? "bg-destructive/10" : "bg-secondary";
  const knob = variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground";
  const progress = Math.round((x / maxX) * 100);

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border border-border ${bg} ${disabled ? "opacity-50" : ""}`}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-none ${variant === "destructive" ? "bg-destructive/25" : "bg-primary/15"}`}
        style={{ width: `${x + 28}px` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {done ? "✓" : confirming ? "…" : label}
      </div>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        onMouseDown={(e) => start(e.clientX)}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        style={{ transform: `translateX(${x}px)`, transition: draggingRef.current ? "none" : "transform 0.3s cubic-bezier(.4,1.4,.5,1)" }}
        className={`absolute left-1 top-1 flex h-12 w-12 cursor-grab items-center justify-center rounded-full shadow-md active:cursor-grabbing ${knob}`}
      >
        <ChevronsRight className="h-5 w-5" />
      </div>
    </div>
  );
}
