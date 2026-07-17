import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Heart, User, Plus } from "lucide-react";
import { useUnreadMessages } from "@/lib/useUnreadMessages";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Tab = { to: string; icon: typeof Home; label: string; center?: boolean; badge?: "messages"; match?: (p: string) => boolean };
const tabs: Tab[] = [
  { to: "/", icon: Home, label: "Accueil", match: (p) => p === "/" },
  { to: "/messages", icon: MessageCircle, label: "Messages", badge: "messages", match: (p) => p.startsWith("/messages") },
  { to: "/post", icon: Plus, label: "Poster", center: true, match: (p) => p === "/post" },
  { to: "/subscriptions", icon: Heart, label: "Abonnements", match: (p) => p.startsWith("/subscriptions") },
  { to: "/account", icon: User, label: "Compte", match: (p) => p.startsWith("/account") },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadMessages();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg px-4 pb-3">
        <div className="flex items-center justify-between rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.match ? t.match(pathname) : pathname === t.to;
            const badgeCount = t.badge === "messages" ? unread : 0;
            if (t.center) {
              return (
                <L key={t.to} to={t.to} className={`-my-4 flex h-14 w-14 items-center justify-center rounded-full shadow-md hover:scale-105 active:scale-95 ${active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-primary text-primary-foreground"}`} aria-label={t.label}>
                  <Icon className="h-6 w-6" />
                </L>
              );
            }
            return (
              <L key={t.to} to={t.to} className={`relative flex h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label={t.label}>
                <Icon className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow ring-2 ring-card animate-scale-in">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </L>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
