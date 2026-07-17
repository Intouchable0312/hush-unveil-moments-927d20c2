import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sparkles, Heart, User, Plus } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Tab = { to: string; icon: typeof Home; label: string; center?: boolean };
const tabs: Tab[] = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/suggestions", icon: Sparkles, label: "Suggestions" },
  { to: "/post", icon: Plus, label: "Poster", center: true },
  { to: "/subscriptions", icon: Heart, label: "Abonnements" },
  { to: "/account", icon: User, label: "Compte" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg px-4 pb-3">
        <div className="flex items-center justify-between rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            if (t.center) {
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="-my-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95"
                  aria-label={t.label}
                >
                  <Icon className="h-6 w-6" />
                </Link>
              );
            }
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label={t.label}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
