import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Shield, Building2, Users } from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: ChooseSpace,
});

const SPACES = [
  {
    key: "super",
    title: "Espace Super Administration",
    desc: "Contrôle global de tous les temples MCA",
    icon: Shield,
    color: "from-primary to-primary-glow",
  },
  {
    key: "admin",
    title: "Espace Administration Temple",
    desc: "Gestion complète de votre temple",
    icon: Building2,
    color: "from-accent to-gold",
  },
  {
    key: "user",
    title: "Espace Utilisateur",
    desc: "Pointage et rapports de présence",
    icon: Users,
    color: "from-secondary to-primary",
  },
] as const;

function ChooseSpace() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen gradient-brand">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12 text-primary-foreground">
          <div className="flex justify-center mb-4">
            <Logo size={84} className="ring-4 ring-gold" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-2">MCA Connect</h1>
          <p className="text-lg opacity-90">{APP_TAGLINE}</p>
          <p className="mt-6 text-xl font-semibold">Choisissez votre espace</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {SPACES.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.key} to="/login" search={{ space: s.key } as never}>
                <Card className="group h-full p-8 cursor-pointer border-0 shadow-elegant transition-transform hover:-translate-y-1 hover:shadow-gold bg-card">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-elegant`}>
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">{s.title}</h2>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                  <div className="mt-6 text-sm font-semibold text-primary group-hover:underline">
                    Accéder →
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <p className="text-center mt-12 text-sm text-primary-foreground/80">
          © Mission de Christ en Action — Plateforme multi-temples
        </p>
      </div>
    </div>
  );
}
