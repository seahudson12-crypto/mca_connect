import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, canAccessPath, defaultRoute } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  // Redirection si le rôle n'a pas accès au chemin demandé (l'URL seule ne donne aucun droit)
  useEffect(() => {
    if (!loading && user && !canAccessPath(path)) {
      navigate({ to: defaultRoute, replace: true });
    }
  }, [loading, user, path, canAccessPath, defaultRoute, navigate]);


  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} />
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}
