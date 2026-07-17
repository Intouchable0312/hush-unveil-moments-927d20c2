import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

type Props = {
  label: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "destructive";
};

/**
 * Premium slide-to-confirm.
 * - Tall pill with animated gradient sheen inside the track
 * - Progress reveals a gradient fill under the knob
 * - Knob has a soft glow; arrows animate in a subtle chevron cue
 * - On confirm, morphs to a check with a success wash
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
    const update = () => { if (trackRef.current) setMaxX(trackRef.current.clientWidth - 64); };
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
      if (xRef.current >= maxX * 0.85) {
        setX(maxX);
        setState("confirming");
        try {
          await onConfirm();
          setState("done");
          setTimeout(() => { setState("idle"); setX(0); }, 900);
        } catch {
          setState("idle");
          setX(0);
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

  const trackGradient = destructive
    ? "from-destructive/15 via-destructive/5 to-destructive/15"
    : "from-primary/10 via-transparent to-primary/10";
  const fillGradient = destructive
    ? "from-destructive via-destructive to-rose-500"
    : "from-primary via-primary to-fuchsia-500";
  const knobBg = destructive
    ? "bg-gradient-to-br from-rose-500 to-destructive text-destructive-foreground"
    : "bg-gradient-to-br from-primary to-fuchsia-500 text-primary-foreground";
  const glow = destructive ? "shadow-[0_0_24px_-4px_hsl(var(--destructive)/0.7)]" : "shadow-[0_0_28px_-4px_hsl(var(--primary)/0.55)]";

  return (
    <div
      ref={trackRef}
      className={`group relative h-16 w-full select-none overflow-hidden rounded-full border border-border/60 bg-secondary/60 backdrop-blur ${disabled ? "opacity-50" : ""}`}
    >
      {/* Ambient sheen */}
      <div className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r ${trackGradient}`} />
      {!dragging && state === "idle" && (
        <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 animate-[shimmer_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      )}

      {/* Progress fill */}
      <div
        className={`absolute inset-y-1 left-1 rounded-full bg-gradient-to-r ${fillGradient} transition-opacity`}
        style={{
          width: `${Math.max(56, x + 56)}px`,
          opacity: state === "done" ? 1 : 0.85,
          transition: dragging ? "none" : "width 0.35s cubic-bezier(.34,1.56,.64,1)",
        }}
      />

      {/* Label */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-14 text-[13px] font-bold uppercase tracking-[0.2em]"
        style={{
          color: state === "done" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
          opacity: state === "done" ? 1 : Math.max(0.35, 1 - progress * 1.2),
          transition: "opacity 0.2s ease",
        }}
      >
        {state === "done" ? "Confirmé" : state === "confirming" ? "…" : label}
      </div>

      {/* Knob */}
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onMouseDown={(e) => start(e.clientX)}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        style={{
          transform: `translateX(${x}px) scale(${dragging ? 1.05 : 1})`,
          transition: dragging ? "transform 0s" : "transform 0.35s cubic-bezier(.34,1.56,.64,1)",
        }}
        className={`absolute left-1 top-1 flex h-14 w-14 cursor-grab items-center justify-center rounded-full ${knobBg} ${glow} ring-1 ring-white/20 active:cursor-grabbing`}
      >
        {state === "done" ? (
          <Check className="h-6 w-6" strokeWidth={3} />
        ) : (
          <>
            <ArrowRight className="h-5 w-5 -translate-x-0.5" strokeWidth={2.5} />
            <ArrowRight className="absolute h-5 w-5 translate-x-1.5 opacity-40" strokeWidth={2.5} />
          </>
        )}
      </div>
    </div>
  );
}
