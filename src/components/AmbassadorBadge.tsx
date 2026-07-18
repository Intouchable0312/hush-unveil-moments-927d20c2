import { Star } from "lucide-react";

type Props = { size?: "sm" | "md"; className?: string; label?: boolean };

export function AmbassadorBadge({ size = "sm", className = "", label = false }: Props) {
  const dims = size === "md" ? "h-6 px-2 text-xs" : "h-5 px-1.5 text-[10px]";
  return (
    <span
      title="Ambassadeur Hush"
      className={`inline-flex items-center gap-1 rounded-full font-bold ${dims} ${className}`}
      style={{
        background: "linear-gradient(135deg,#f5d16b 0%,#c99a2b 45%,#8b6a1a 100%)",
        color: "#1a1a1a",
        boxShadow: "0 1px 6px rgba(201,154,43,0.4)",
      }}
    >
      <Star className={size === "md" ? "h-3.5 w-3.5 fill-current" : "h-3 w-3 fill-current"} />
      {label && <span>Ambassadeur</span>}
    </span>
  );
}
