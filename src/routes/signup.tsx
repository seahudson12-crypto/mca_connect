import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Clock, CheckCircle2 } from "lucide-react";
import { submitRoleRequest } from "@/lib/role-requests.functions";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Créer un compte — MCA Connect" },
      { name: "description", content: "Rejoignez MCA Connect : utilisateur, responsable de département ou responsable finances." },
      { property: "og:title", content: "Créer un compte — MCA Connect" },
      { property: "og:description", content: "Rejoignez MCA Connect : utilisateur, responsable de département ou responsable finances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ProfilType = "utilisateur" | "responsable_departement" | "finances";

const PROFIL_OPTIONS: Array<{ value: ProfilType; label: string; hint: string }> = [
  { value: "utilisateur", label: "Utilisateur normal", hint: "Pointage et présences de votre temple" },
  { value: "responsable_departement", label: "Responsable département", hint: "Un ou plusieurs départements — validation requise" },
  { value: "finances", label: "Responsable finances", hint: "Données financières du temple — validation requise" },
];

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nom, setNom] = useState("");
  const [prenoms, setPrenoms] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [templeId, setTempleId] = useState<string>("");
  const [profil, setProfil] = useState<ProfilType>("utilisateur");
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [temples, setTemples] = useState<Array<{ id: string; nom_temple: string; ville: string | null }>>([]);
  const [departements, setDepartements] = useState<Array<{ id: string; nom: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<null | ProfilType>(null);

  useEffect(() => {
    if (user && !pending) navigate({ to: "/dashboard" });
  }, [user, pending, navigate]);

  useEffect(() => {
    supabase.from("temples_public").select("id,nom_temple,ville").order("nom_temple").then(({ data }) => {
      setTemples(
        (data ?? [])
          .filter((t) => t.id && t.nom_temple)
          .map((t) => ({ id: t.id!, nom_temple: t.nom_temple!, ville: t.ville })),
      );
    });
  }, []);

  // Départements du temple sélectionné (liste publique, noms uniquement)
  useEffect(() => {
    setDeptIds([]);
    if (!templeId) return setDepartements([]);
    supabase
      .from("departements_public")
      .select("id,nom")
      .eq("temple_id", templeId)
      .order("nom")
      .then(({ data }) => {
        setDepartements((data ?? []).filter((d) => d.id && d.nom).map((d) => ({ id: d.id!, nom: d.nom! })));
      });
  }, [templeId]);

  const toggleDept = (id: string) =>
    setDeptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!templeId) return toast.error("Veuillez sélectionner votre temple");
    if (profil === "responsable_departement" && deptIds.length === 0) {
      return toast.error("Sélectionnez au moins un département");
    }
    setLoading(true);
    const fullName = `${nom} ${prenoms}`.trim();
    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom: fullName, temple_id: templeId },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const newUser = signupData.user;
    if (newUser) {
      await supabase.from("profiles").update({ temple_id: templeId, nom: fullName }).eq("id", newUser.id);
    }

    if (profil !== "utilisateur" && newUser) {
      try {
        await submitRoleRequest({
          data: {
            userId: newUser.id,
            email,
            templeId,
            requestedRole: profil,
            nom,
            prenoms,
            telephone,
            departementIds: profil === "responsable_departement" ? deptIds : [],
          },
        });
      } catch (err) {
        setLoading(false);
        toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la demande");
        return;
      }
      setPending(profil);
      setLoading(false);
      await supabase.auth.signOut();
      return;
    }

    setLoading(false);
    toast.success("Compte créé. Bienvenue !");
    navigate({ to: "/dashboard" });
  };

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8 shadow-elegant border-0 text-center space-y-4">
          <div className="flex justify-center"><Logo size={56} /></div>
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="text-xl font-bold">Votre demande a bien été enregistrée.</h2>
          <p className="text-sm text-muted-foreground">
            Votre compte est en attente de validation par l'administration
            {pending === "responsable_departement" ? " (responsable de département)" : " (responsable finances)"}.
          </p>
          <Badge variant="secondary" className="mx-auto">
            <Clock className="mr-1 h-3 w-3" /> En attente de validation
          </Badge>
          <p className="text-xs text-muted-foreground">
            Vous serez informé dès qu'un administrateur de votre temple aura traité votre demande.
            Aucun accès n'est accordé avant la validation.
          </p>
          <Button asChild className="w-full gradient-brand text-primary-foreground border-0">
            <Link to="/login">Retour à la connexion</Link>
          </Button>
        </Card>
      </div>
    );
  }

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
            <Label>Type de compte</Label>
            <div className="space-y-2">
              {PROFIL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    profil === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="profil"
                    className="mt-1"
                    checked={profil === o.value}
                    onChange={() => setProfil(o.value)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Les rôles Admin Temple et Super Admin sont attribués uniquement par l'administration.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prenoms">Prénoms</Label>
              <Input id="prenoms" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} />
            </div>
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

          {profil === "responsable_departement" && (
            <div className="space-y-2">
              <Label>Département(s) dont vous êtes responsable</Label>
              {!templeId ? (
                <p className="text-xs text-muted-foreground">Sélectionnez d'abord votre temple.</p>
              ) : departements.length === 0 ? (
                <p className="text-xs text-destructive">
                  Aucun département n'est encore créé pour ce temple. Contactez l'administration.
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {departements.map((d) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input type="checkbox" checked={deptIds.includes(d.id)} onChange={() => toggleDept(d.id)} />
                      {d.nom}
                    </label>
                  ))}
                </div>
              )}
              {deptIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {deptIds.map((id) => (
                    <Badge key={id} variant="secondary">{departements.find((d) => d.id === id)?.nom}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tel">Téléphone (optionnel)</Label>
            <Input id="tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+225 ..." />
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
          {profil !== "utilisateur" && (
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              Votre compte sera créé avec le statut <strong>En attente de validation</strong>. Aucun accès
              {profil === "finances" ? " financier" : " départemental"} ne sera accordé avant l'approbation d'un administrateur.
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground border-0">
            {loading ? "Création..." : profil === "utilisateur" ? "Créer mon compte" : "Envoyer ma demande"}
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
