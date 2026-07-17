import { useEffect, useRef, useState } from "react";
import { ChevronRight, Check } from "lucide-react";

type Props = {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "destructive";
};

/**
 * Monochrome slide-to-confirm. Black/white only, subtle motion.
 * - Rounded rectangle (not pill) for a sharper, editorial feel
 * - Track: transparent with hairline border, subtle inner grain
 * - Progress: solid ink filling from the left
 * - Knob: contrasting square with rounded corners, animated chevrons
 * - Success: morphs to check with a soft ink wash
 */
export function ActionSlider({ label, onConfirm, disabled, variant = "primary" }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [maxX, setMaxX] = useState(240);
  const [state, setState] = useState<"idle" | "confirming" | "done">("idle");
  const draggingRef = useRef(false);
  const xRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const update = () => { if (trackRef.current) setMaxX(trackRef.current.clientWidth - 60); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { xRef.current = x; }, [x]);

  const start = (clientX: number) => {
    if (disabled || state !== "idle") return;
    draggingRef.current = true;
    setDragging(true);
    const origin = clientX - xRef.current;
    const move = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const cx = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      setX(Math.max(0, Math.min(maxX, cx - origin)));
    };
    const end = async () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
      if (xRef.current >= maxX * 0.9) {
        setX(maxX);
        setState("confirming");
        try {
          await onConfirm();
          setState("done");
          setTimeout(() => { setState("idle"); setX(0); }, 1100);
        } catch (err) {
          setState("idle");
          setX(0);
          if (err instanceof Error && err.message) alert(err.message);
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

  const progress = maxX ? x / maxX : 0;
  const destructive = variant === "destructive";

  // Monochrome palette — inverts on destructive to keep it strictly B/W.
  const inkBg = destructive ? "bg-foreground" : "bg-foreground";
  const inkFg = "text-background";

  return (
    <div
      ref={trackRef}
      className={`group relative h-14 w-full select-none overflow-hidden rounded-2xl border border-foreground/20 bg-transparent ${disabled ? "opacity-40" : ""}`}
    >
      {/* subtle grain / gradient hint */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(127,127,127,0.06),transparent)]" />

      {/* Progress fill (solid ink) */}
      <div
        className={`absolute inset-y-0 left-0 ${inkBg}`}
        style={{
          width: `${x + 56}px`,
          transition: dragging ? "none" : "width 0.4s cubic-bezier(.22,1,.36,1)",
        }}
      />

      {/* Label */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-14 text-[11px] font-semibold uppercase tracking-[0.28em]"
        style={{
          color: state === "done" ? "hsl(var(--background))" : "hsl(var(--foreground))",
          opacity: state === "done" ? 1 : Math.max(0.4, 1 - progress * 1.3),
          transition: "opacity 0.2s ease, color 0.2s ease",
        }}
      >
        {state === "done" ? "Confirmé" : state === "confirming" ? "…" : label}
      </div>

      {/* Slide hint arrows — only when idle */}
      {state === "idle" && !dragging && (
        <div className="pointer-events-none absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-40">
          <span className="animate-[slidehint_1.6s_ease-in-out_infinite] text-foreground">›</span>
          <span className="animate-[slidehint_1.6s_ease-in-out_0.15s_infinite] text-foreground">›</span>
          <span className="animate-[slidehint_1.6s_ease-in-out_0.3s_infinite] text-foreground">›</span>
        </div>
      )}

      {/* Knob */}
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onMouseDown={(e) => start(e.clientX)}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? "transform 0s" : "transform 0.4s cubic-bezier(.22,1,.36,1)",
        }}
        className={`absolute left-1 top-1 flex h-12 w-12 cursor-grab items-center justify-center rounded-xl ${inkBg} ${inkFg} active:cursor-grabbing`}
      >
        {state === "done" ? (
          <Check className="h-5 w-5 animate-[scale-in_0.25s_ease-out]" strokeWidth={3} />
        ) : (
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        )}
      </div>
    </div>
  );
}
