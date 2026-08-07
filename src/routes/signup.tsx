import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nom, setNom] = useState("");
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
    supabase.from("temples_public").select("id,nom_temple,ville").order("nom_temple").then(({ data }) => {
      setTemples(data ?? []);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!templeId) return toast.error("Veuillez sélectionner votre temple");
    setLoading(true);
    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom, temple_id: templeId },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // Override profile temple_id with the selected one
    if (signupData.user) {
      await supabase.from("profiles").update({ temple_id: templeId, nom }).eq("id", signupData.user.id);
    }
    setLoading(false);
    toast.success("Compte créé. Bienvenue !");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8 shadow-elegant border-0">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} />
          <div>
            <div className="text-lg font-bold">MCA Connect</div>
            <div className="text-xs text-muted-foreground">{APP_TAGLINE}</div>
          </div>
        </div>
        <h2 className="text-2xl font-bold">Créer un compte</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rejoignez l'équipe de gestion de votre temple</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet</Label>
            <Input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Temple d'appartenance</Label>
            {temples.length === 0 ? (
              <p className="text-xs text-destructive">
                Aucun temple disponible. Veuillez contacter l'administrateur.
              </p>
            ) : (
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
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground border-0">
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">Se connecter</Link>
        </p>
      </Card>
    </div>
  );
}
