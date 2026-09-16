import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, BadgeCheck, ListChecks, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { type Activite, type Departement, type DeptMembre, enRetard, fullName, statsActivites } from "@/lib/departement";
import { activiteStatutLabel } from "@/lib/constants";

export function DeptDashboard({ dept, activites }: { dept: Departement; activites?: Activite[] | null }) {
  const membresQuery = useQuery({
    queryKey: ["dept-membres", dept.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_membres")
        .select("id,departement_id,membre_id,date_ajout,membres(id,nom,prenoms,matricule,categorie,actif,telephone)")
        .eq("departement_id", dept.id);
      if (error) throw error;
      return (data ?? []) as unknown as DeptMembre[];
    },
  });

  const bureauQuery = useQuery({
    queryKey: ["dept-bureau-count", dept.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("departement_bureau")
        .select("id", { count: "exact", head: true })
        .eq("departement_id", dept.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const membres: DeptMembre[] = membresQuery.data ?? [];
  const bureauCount = bureauQuery.data ?? 0;
  const acts: Activite[] = Array.isArray(activites) ? activites : [];
  const loading = membresQuery.isLoading || bureauQuery.isLoading;
  const failed = membresQuery.isError || bureauQuery.isError;

  const s = statsActivites(acts);
  const actifs = membres.filter((m) => m.membres?.actif).length;
  const retards = acts.filter(enRetard);

  if (failed) {
    return (
      <Card className="p-6 border-0 shadow-elegant text-center space-y-3">
        <p className="font-semibold">Impossible de charger les données du département</p>
        <p className="text-sm text-muted-foreground">Vérifiez votre connexion, puis réessayez.</p>
        <Button
          className="gradient-brand text-primary-foreground border-0"
          onClick={() => { membresQuery.refetch(); bureauQuery.refetch(); }}
        >
          Réessayer
        </Button>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membres du département" value={membres.length} icon={Users} />
        <StatCard label="Membres actifs" value={actifs} icon={UserCheck} variant="success" />
        <StatCard label="Membres du bureau" value={bureauCount} icon={BadgeCheck} variant="gold" />
        <StatCard label="Activités enregistrées" value={s.total} icon={ListChecks} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="À faire" value={s.aFaire} icon={ListChecks} />
        <StatCard label="En cours" value={s.enCours} icon={Clock} />
        <StatCard label="Réalisées" value={s.realise} icon={CheckCircle2} variant="success" />
        <StatCard label="En retard" value={s.retard} icon={AlertTriangle} variant="warning" />
        <StatCard label="Annulées" value={s.annule} icon={XCircle} />
      </div>

      <Card className="p-5 border-0 shadow-elegant space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Taux d'avancement global du département</span>
          <span className="text-lg font-bold">{s.avancement}%</span>
        </div>
        <Progress value={s.avancement} />
        <p className="text-xs text-muted-foreground">
          Moyenne du niveau d'avancement des {s.total} activité(s) — {s.reporte} reportée(s).
        </p>
      </Card>

      <Card className="p-5 border-0 shadow-elegant">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 text-warning" /> Activités nécessitant une action
        </h3>
        {retards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité en retard. Bon travail !</p>
        ) : (
          <ul className="space-y-2">
            {retards.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{a.titre}</div>
                  <div className="text-xs text-muted-foreground">
                    Prévue le {a.date_prevue ? format(new Date(a.date_prevue), "d MMM yyyy", { locale: fr }) : "—"}
                    {a.responsable ? ` — ${a.responsable}` : ""}
                  </div>
                </div>
                <Badge variant="secondary">{activiteStatutLabel(a.statut)} · {a.avancement}%</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 border-0 shadow-elegant">
        <h3 className="mb-3 font-semibold">Aperçu des membres</h3>
        {membres.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre encore rattaché à ce département.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {membres.slice(0, 20).map((m) => (
              <Badge key={m.id} variant="secondary">{fullName(m.membres)}</Badge>
            ))}
            {membres.length > 20 && <Badge variant="outline">+{membres.length - 20}</Badge>}
          </div>
        )}
      </Card>
    </div>
  );
}
