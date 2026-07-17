import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { HushLoader } from "@/components/HushLoader";
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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Hush — Créateurs & abonnés" },
      { name: "description", content: "Hush : plateforme d'abonnement pour créateurs. Publiez, échangez et monétisez vos contenus." },
      { property: "og:title", content: "Hush" },
      { property: "og:description", content: "Plateforme d'abonnement pour créateurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <body><div id="app-root">{children}</div><Scripts /></body>
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
  const [loading, setLoading] = useState(true);
  const { session, ban, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading || !ready) {
    return <HushLoader onDone={() => setLoading(false)} />;
  }

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

  const showNav = !!session && pathname !== "/auth";

  return (
    <div className={`min-h-screen bg-background ${showNav ? "pb-32" : ""}`}>
      <Outlet />
      {showNav && <BottomNav />}
    </div>
  );
}

