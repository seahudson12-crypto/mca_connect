import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { TEMPLE_FULL_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

type SearchParams = { space?: "super" | "admin" | "user" };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    space: (s.space as SearchParams["space"]) ?? undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { space } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [templeId, setTempleId] = useState<string>("");
  const [temples, setTemples] = useState<Array<{ id: string; nom_temple: string; ville: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  useEffect(() => {
    supabase.from("temples").select("id,nom_temple,ville").eq("actif", true).order("nom_temple").then(({ data }) => {
      setTemples(data ?? []);
    });
  }, []);

  const needsTemple = space === "admin" || space === "user";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (needsTemple && !templeId) {
      toast.error("Veuillez sélectionner votre temple");
      return;
    }
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

  const spaceLabel =
    space === "super" ? "Super Administration"
    : space === "admin" ? "Administration Temple"
    : space === "user" ? "Utilisateur"
    : "Connexion";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
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
            Plateforme multi-temples <span className="text-gold">MCA</span>
          </h1>
          <p className="text-base opacity-90 max-w-md">
            Pointage des présences, suivi des membres, finances et statistiques en temps réel.
          </p>
        </div>
        <div className="relative text-xs opacity-70">© Mission de Christ en Action</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8 shadow-elegant border-0">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-3 w-3" /> Changer d'espace
          </Link>
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <Logo size={48} />
            <div>
              <div className="text-lg font-bold">MCA Connect</div>
              <div className="text-xs text-muted-foreground">{TEMPLE_FULL_NAME}</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">{spaceLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace de gestion</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {needsTemple && (
              <div className="space-y-2">
                <Label>Temple</Label>
                <Select value={templeId} onValueChange={setTempleId}>
                  <SelectTrigger><SelectValue placeholder="Choisissez votre temple" /></SelectTrigger>
                  <SelectContent>
                    {temples.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nom_temple}{t.ville ? ` — ${t.ville}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@mca.ci" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Mot de passe oublié ?</Link>
              </div>
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
