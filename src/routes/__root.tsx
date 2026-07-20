import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { GlobalLogo } from "@/components/GlobalLogo";
import { BottomNav } from "@/components/BottomNav";
import { HushLogo } from "@/components/HushLogo";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-foreground">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">Réessayer</button>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 h-16 w-40 text-foreground"><HushLogo className="h-full w-full" /></div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Page introuvable</p>
        <a href="/" className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">Accueil</a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: "Hush — Créateurs & abonnés" },
      { name: "description", content: "Hush : plateforme d'abonnement pour créateurs. Publiez, échangez et monétisez vos contenus." },
      { property: "og:title", content: "Hush — Créateurs & abonnés" },
      { property: "og:description", content: "Hush : plateforme d'abonnement pour créateurs. Publiez, échangez et monétisez vos contenus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Hush — Créateurs & abonnés" },
      { name: "twitter:description", content: "Hush : plateforme d'abonnement pour créateurs. Publiez, échangez et monétisez vos contenus." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b1530fc7-206d-4c2f-824c-b2598dde9df4/id-preview-670b7e37--06eeef33-0956-4d84-9d68-3c17e225802f.lovable.app-1784254163315.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b1530fc7-206d-4c2f-824c-b2598dde9df4/id-preview-670b7e37--06eeef33-0956-4d84-9d68-3c17e225802f.lovable.app-1784254163315.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.ico" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body style={{ touchAction: "manipulation", WebkitTextSizeAdjust: "100%" }}>
        <div id="app-root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Shell() {
  const [logoPhase, setLogoPhase] = useState<"cover" | "settling" | "done">("cover");
  const { session, ban, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const showBackdrop = logoPhase === "cover" || !ready;
  const isAuthRoute = pathname === "/auth";
  const isSearchRoute = pathname === "/search";
  const target: "corner" | "auth" = session && !isAuthRoute ? "corner" : "auth";

  if (ban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-6 h-10 w-32 text-foreground"><HushLogo className="h-full w-full" /></div>
          <h1 className="text-2xl font-bold">Compte suspendu</h1>
          <p className="mt-3 text-sm text-muted-foreground">Votre accès à Hush a été révoqué pour la raison suivante :</p>
          <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-medium">{ban.reason}</p>
        </div>
      </div>
    );
  }

  const isLogged = !!session;
  const showChrome = isLogged && !isAuthRoute && logoPhase !== "cover";
  const showHeader = showChrome && !isSearchRoute;
  const showNav = showChrome && !isSearchRoute;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Backdrop while drawing */}
      {showBackdrop && (
        <div className="fixed inset-0 z-[90] bg-background transition-opacity duration-500" />
      )}

      {/* Fixed header (logo lands here when connected) */}
      {showHeader && (
        <header
          className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl"
          style={{ height: "var(--hush-header-h)" }}
        />
      )}

      {/* Persistent logo (drawing → settling → settled) */}
      <GlobalLogo
        target={target}
        replayKey={pathname}
        onSettleStart={() => setLogoPhase("settling")}
        onSettled={() => setLogoPhase("done")}
      />

      {/* App content — the only scrollable region */}
      <main
        className="relative flex-1 overflow-y-auto overflow-x-hidden transition-opacity duration-500"
        style={{
          opacity: logoPhase === "cover" ? 0 : 1,
          paddingTop: showHeader ? "var(--hush-header-h)" : undefined,
          paddingBottom: showNav ? "var(--hush-nav-h)" : undefined,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Outlet />
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}
