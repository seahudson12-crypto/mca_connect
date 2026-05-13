import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { TEMPLE_FULL_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Identifiants incorrects");
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between gradient-brand p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo size={56} className="ring-2 ring-gold" />
            <div>
              <div className="text-2xl font-bold">MCA Connect</div>
              <div className="text-sm opacity-80">{APP_TAGLINE}</div>
            </div>
          </div>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            La plateforme de gestion <span className="text-gold">des temples MCA</span>
          </h1>
          <p className="text-base opacity-90 max-w-md">
            Pointage des présences, suivi des membres, communication WhatsApp et statistiques en temps réel.
          </p>
        </div>
        <div className="relative text-xs opacity-70">© Mission de Christ en Action</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8 shadow-elegant border-0">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <Logo size={48} />
            <div>
              <div className="text-lg font-bold">MCA Connect</div>
              <div className="text-xs text-muted-foreground">{TEMPLE_FULL_NAME}</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace de gestion</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@mca.ci" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground border-0 shadow-elegant">
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">Créer un compte</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
