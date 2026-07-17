import { useEffect, useRef, useState } from "react";
import { ChevronsRight } from "lucide-react";

type Props = {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
};

export function PaymentSlider({ label, onConfirm, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [maxX, setMaxX] = useState(240);
  const [confirming, setConfirming] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const update = () => {
      if (trackRef.current) setMaxX(trackRef.current.clientWidth - 56);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const start = (clientX: number) => {
    if (disabled || confirming) return;
    draggingRef.current = true;
    const origin = clientX - x;
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
      if (x >= maxX * 0.9) {
        setX(maxX);
        setConfirming(true);
        try { await onConfirm(); } finally { setConfirming(false); setTimeout(() => setX(0), 400); }
      } else {
        setX(0);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
  };

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border border-border bg-secondary ${disabled ? "opacity-50" : ""}`}
    >
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {confirming ? "..." : label}
      </div>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((x / maxX) * 100)}
        onMouseDown={(e) => start(e.clientX)}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        style={{ transform: `translateX(${x}px)`, transition: draggingRef.current ? "none" : "transform 0.3s ease" }}
        className="absolute left-1 top-1 flex h-12 w-12 cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:cursor-grabbing"
      >
        <ChevronsRight className="h-5 w-5" />
      </div>
    </div>
  );
}
