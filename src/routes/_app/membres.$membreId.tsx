import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logChange } from "@/lib/audit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { ArrowLeft, UserCheck, UserX, Percent, CalendarDays, Sparkles, Phone, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel, culteTypeLabel } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/membres/$membreId")({
  component: FicheMembrePage,
  head: () => ({
    meta: [
      { title: "Fiche membre — MCA Connect" },
      { name: "description", content: "Fiche détaillée d'un membre MCA : matricule, informations personnelles, historique des présences et suivi." },
      { property: "og:title", content: "Fiche membre — MCA Connect" },
      { property: "og:description", content: "Matricule, informations personnelles et historique de présence du membre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Membre = {
  id: string; matricule: string | null; nom: string; prenoms: string; sexe: "M" | "F" | null;
  telephone: string | null; whatsapp: string | null; email: string | null; categorie: string;
  profession: string | null; secteur_activite: string | null; entreprise: string | null;
  adresse: string | null; date_naissance: string | null; date_entree: string | null;
  date_ajout: string; actif: boolean; photo_url: string | null; observations: string | null;
  temple_id: string;
  temple?: { nom_temple: string; ville: string | null; pays: string | null; code_pays: string | null; code_temple: string | null } | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function FicheMembrePage() {
  const { membreId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user, role } = useAuth();
  const [newCat, setNewCat] = useState<string>("");
  const [editMat, setEditMat] = useState(false);
  const [matValue, setMatValue] = useState("");
  const [confirmMat, setConfirmMat] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  const { data: membre, isLoading } = useQuery({
    queryKey: ["membre", membreId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("*,temple:temples(nom_temple,ville,pays,code_pays,code_temple)")
        .eq("id", membreId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Membre | null;
    },
  });

  // Cultes du temple du membre (isolation stricte par temple_id)
  const { data: cultes = [] } = useQuery({
    queryKey: ["membre-cultes", membre?.temple_id],
    enabled: !!membre?.temple_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cultes")
        .select("id,date,type_culte")
        .eq("temple_id", membre!.temple_id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; date: string; type_culte: string }>;
    },
  });

  const { data: presences = [] } = useQuery({
    queryKey: ["membre-presences", membreId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("culte_id,statut,created_at")
        .eq("membre_id", membreId);
      if (error) throw error;
      return data as Array<{ culte_id: string; statut: string }>;
    },
  });

  const historique = useMemo(() => {
    const map = new Map(presences.map((p) => [p.culte_id, p.statut]));
    return cultes
      .filter((c) => map.has(c.id))
      .map((c) => ({ ...c, statut: map.get(c.id)! }));
  }, [cultes, presences]);

  const stats = useMemo(() => {
    const total = historique.length;
    const present = historique.filter((h) => h.statut === "present").length;
    const absent = historique.filter((h) => h.statut === "absent").length;
    const taux = total > 0 ? Math.round((present * 100) / total) : 0;
    const premiere = [...historique].reverse().find((h) => h.statut === "present")?.date ?? null;
    return { total, present, absent, taux, premiere };
  }, [historique]);

  // Évolution : taux de présence cumulé, du plus ancien au plus récent
  const evolution = useMemo(() => {
    const asc = [...historique].reverse();
    let p = 0;
    return asc.map((h, i) => {
      if (h.statut === "present") p++;
      return {
        date: format(new Date(h.date), "dd/MM"),
        taux: Math.round((p * 100) / (i + 1)),
      };
    });
  }, [historique]);

  const changeCategorie = async () => {
    if (!newCat || !membre) return;
    const { error } = await supabase.from("membres").update({ categorie: newCat as never }).eq("id", membre.id);
    if (error) return toast.error(error.message);
    toast.success(`Catégorie changée : ${categoryLabel(newCat)}`);
    setNewCat("");
    qc.invalidateQueries({ queryKey: ["membre", membreId] });
    qc.invalidateQueries({ queryKey: ["membres"] });
  };

  const templePrefix = membre?.temple
    ? `MCA-${(membre.temple.code_pays || "").toUpperCase()}-${(membre.temple.code_temple || "").toUpperCase()}`
    : null;

  const saveMatricule = async () => {
    if (!membre) return;
    const value = matValue.trim().toUpperCase();
    if (!/^MCA-[A-Z]{2,3}-[A-Z0-9]{2,4}-\d{4,}$/.test(value)) {
      return toast.error("Format invalide. Exemple attendu : MCA-CI-TR-0001");
    }
    if (templePrefix && templePrefix.length > 8 && !value.startsWith(`${templePrefix}-`)) {
      return toast.error(`Le matricule doit correspondre au temple du membre (${templePrefix}-XXXX).`);
    }
    setSavingMat(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from("membres")
        .select("id")
        .eq("matricule", value)
        .neq("id", membre.id)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        return toast.error("Ce matricule est déjà attribué à un autre membre.");
      }

      const { data: updated, error } = await supabase
        .from("membres")
        .update({ matricule: value })
        .eq("id", membre.id)
        .select("id,matricule")
        .maybeSingle();
      if (error) {
        if ((error as { code?: string }).code === "23505") {
          return toast.error("Ce matricule est déjà attribué à un autre membre.");
        }
        throw error;
      }
      if (!updated || updated.matricule !== value) {
        return toast.error("Modification refusée : vous n'avez pas les droits nécessaires sur ce membre.");
      }

      if (user) {
        await logChange({
          userId: user.id,
          table: "membres",
          recordId: membre.id,
          action: "update",
          before: { matricule: membre.matricule },
          after: { matricule: value },
        });
        await supabase.from("activites_utilisateurs").insert({
          utilisateur_id: user.id,
          temple_id: membre.temple_id,
          type_action: "matricule_update",
          description: `Matricule modifié : ${membre.matricule ?? "—"} → ${value} (${membre.nom} ${membre.prenoms})`,
          metadata: {
            membre_id: membre.id,
            ancien_matricule: membre.matricule,
            nouveau_matricule: value,
            role: role,
            temple_id: membre.temple_id,
          },
        });
      }

      toast.success("Matricule modifié avec succès.");
      setConfirmMat(false);
      setEditMat(false);
      setMatValue("");
      qc.invalidateQueries({ queryKey: ["membre", membreId] });
      qc.invalidateQueries({ queryKey: ["membres"] });
      qc.invalidateQueries({ queryKey: ["historique"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la modification du matricule.");
    } finally {
      setSavingMat(false);
    }
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Chargement...</div>;
  if (!membre) return <div className="py-12 text-center text-muted-foreground">Membre introuvable ou hors de votre temple.</div>;

  const initials = `${membre.nom.charAt(0)}${membre.prenoms.charAt(0)}`.toUpperCase();
  const isNouvelleAme = membre.categorie === "nouvelles_ames";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/membres" })}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold truncate">{membre.nom} {membre.prenoms}</h1>
          <p className="font-mono text-sm text-primary">{membre.matricule ?? "Matricule en attente"}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 border-0 shadow-elegant lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar className="h-24 w-24">
              {membre.photo_url && <AvatarImage src={membre.photo_url} alt={`Photo de ${membre.nom} ${membre.prenoms}`} />}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{membre.nom} {membre.prenoms}</div>
              <Badge variant="secondary" className="mt-1">{categoryLabel(membre.categorie)}</Badge>
            </div>
            <div className="flex gap-2">
              {membre.telephone && (
                <Button asChild size="sm" variant="outline"><a href={`tel:${membre.telephone}`}><Phone className="mr-1.5 h-3.5 w-3.5" /> Appeler</a></Button>
              )}
              {membre.whatsapp && (
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/${membre.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>

          <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations personnelles</h2>
          <Row label="Matricule" value={<span className="font-mono">{membre.matricule ?? "—"}</span>} />
          {isAdmin && (
            <div className="py-2">
              {!editMat ? (
                <Button size="sm" variant="outline" onClick={() => { setMatValue(membre.matricule ?? templePrefix ? `${membre.matricule ?? templePrefix + "-"}` : ""); setEditMat(true); }}>
                  Modifier le matricule
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={matValue}
                    onChange={(e) => setMatValue(e.target.value.toUpperCase())}
                    placeholder={templePrefix ? `${templePrefix}-0001` : "MCA-CI-TR-0001"}
                    className="font-mono"
                    aria-label="Nouveau matricule"
                  />
                  <p className="text-xs text-muted-foreground">Format attendu : {templePrefix ? `${templePrefix}-0001` : "MCA-CI-TR-0001"}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setConfirmMat(true)} disabled={!matValue.trim() || matValue.trim().toUpperCase() === (membre.matricule ?? "")}>
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditMat(false); setMatValue(""); }}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Dialog open={confirmMat} onOpenChange={(o) => !o && setConfirmMat(false)}>
            <DialogContent className="w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Voulez-vous vraiment modifier le matricule de ce membre ?</DialogTitle>
                <DialogDescription>Le membre, son historique de présence et ses informations restent inchangés.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <Row label="Ancien matricule" value={<span className="font-mono">{membre.matricule ?? "—"}</span>} />
                <Row label="Nouveau matricule" value={<span className="font-mono">{matValue.trim().toUpperCase()}</span>} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmMat(false)}>Annuler</Button>
                <Button onClick={saveMatricule} disabled={savingMat} className="gradient-brand text-primary-foreground border-0">
                  {savingMat ? "Enregistrement..." : "Confirmer la modification"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Row label="Nom" value={membre.nom} />
          <Row label="Prénoms" value={membre.prenoms} />
          <Row label="Sexe" value={membre.sexe === "M" ? "Masculin" : membre.sexe === "F" ? "Féminin" : "—"} />
          <Row label="Profession" value={membre.profession} />
          <Row label="Secteur d'activité" value={membre.secteur_activite} />
          <Row label="Entreprise" value={membre.entreprise} />
          <Row label="Téléphone" value={membre.telephone} />
          <Row label="WhatsApp" value={membre.whatsapp} />
          <Row label="Email" value={membre.email} />
          <Row label="Adresse" value={membre.adresse} />
          <Row label="Date de naissance" value={membre.date_naissance ? format(new Date(membre.date_naissance), "dd/MM/yyyy") : "—"} />
          <Row label="Temple" value={membre.temple?.nom_temple} />
          <Row label="Catégorie" value={categoryLabel(membre.categorie)} />
          <Row label="Date d'ajout" value={format(new Date(membre.date_ajout), "dd/MM/yyyy")} />
          <Row label="Statut" value={<Badge variant={membre.actif ? "default" : "secondary"}>{membre.actif ? "Actif" : "Inactif"}</Badge>} />
          <Row label="Observations" value={membre.observations} />
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Cultes suivis" value={stats.total} icon={CalendarDays} />
            <StatCard label="Présences" value={stats.present} icon={UserCheck} variant="success" />
            <StatCard label="Absences" value={stats.absent} icon={UserX} variant="warning" />
            <StatCard label="Taux de présence" value={`${stats.taux}%`} icon={Percent} variant="gold" />
          </div>

          {isNouvelleAme && (
            <Card className="p-5 border-0 shadow-elegant">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-4 w-4" /> Suivi nouvelle âme
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Première présence" value={stats.premiere ? format(new Date(stats.premiere), "dd/MM/yyyy") : "—"} />
                <Row label="Présences" value={stats.present} />
                <Row label="Absences" value={stats.absent} />
                <Row label="Évolution" value={`${stats.taux}% de présence`} />
                <Row label="Catégorie actuelle" value={categoryLabel(membre.categorie)} />
              </div>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Select value={newCat} onValueChange={setNewCat}>
                      <SelectTrigger><SelectValue placeholder="Changer de catégorie" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter((c) => c.value !== membre.categorie).map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={changeCategorie} disabled={!newCat} className="gradient-brand text-primary-foreground border-0">
                    Appliquer
                  </Button>
                  <p className="w-full text-xs text-muted-foreground">Le matricule reste inchangé après un changement de catégorie.</p>
                </div>
              )}
            </Card>
          )}

          <Card className="p-5 border-0 shadow-elegant">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Évolution de la présence</h2>
            {evolution.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée de présence.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="taux" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-5 border-0 shadow-elegant">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique des présences et absences</h2>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Culte</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historique.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Aucun pointage enregistré</TableCell></TableRow>
                  )}
                  {historique.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{format(new Date(h.date), "EEE d MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>{culteTypeLabel(h.type_culte)}</TableCell>
                      <TableCell>
                        <Badge variant={h.statut === "present" ? "default" : "destructive"}>
                          {h.statut === "present" ? "Présent" : h.statut === "absent" ? "Absent" : h.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
