import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading, canAccessPath, defaultRoute, signOut } = useAuth();
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


  if (!loading && user && profile?.actif === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-4">
          <Logo size={56} />
          <h1 className="text-xl font-semibold">Accès suspendu</h1>
          <p className="text-sm text-muted-foreground">
            Votre accès à MCA CONNECT a été suspendu. Contactez un administrateur du temple.
          </p>
          <button
            onClick={() => signOut()}
            className="gradient-brand text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

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
