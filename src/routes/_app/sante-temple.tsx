import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/StatCard";
import { Activity, HeartPulse, TrendingUp, ClipboardCheck, Users, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { differenceInDays, parseISO, subDays } from "date-fns";
import { isEcodimAllowed, ECODIM_CATEGORY } from "@/lib/constants";

export const Route = createFileRoute("/_app/sante-temple")({ component: SanteTemplePage });

type Temple = { id: string; nom_temple: string; ville: string | null; pays: string | null };

function SanteTemplePage() {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const { activeTempleId } = useActiveTemple();

  const { data: temples = [] } = useQuery({
    queryKey: ["sante-temples", isSuperAdmin, activeTempleId],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from("temples").select("id,nom_temple,ville,pays").eq("actif", true).order("nom_temple");
      if (!isSuperAdmin && activeTempleId) q = q.eq("id", activeTempleId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Temple[];
    },
  });

  const { data: membres = [] } = useQuery({
    queryKey: ["sante-membres"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,temple_id,actif,categorie,date_ajout")
        .eq("actif", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cultes = [] } = useQuery({
    queryKey: ["sante-cultes"],
    enabled: isAdmin,
    queryFn: async () => {
      const since = subDays(new Date(), 90).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("cultes")
        .select("id,temple_id,date,type_culte,statut,validated_at,created_at")
        .gte("date", since)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: presences = [] } = useQuery({
    queryKey: ["sante-presences", cultes.map((c) => c.id).join(",")],
    enabled: isAdmin && cultes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("culte_id,membre_id,statut")
        .in("culte_id", cultes.map((c) => c.id));
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inscriptions = [] } = useQuery({
    queryKey: ["sante-inscriptions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscriptions_formation")
        .select("id,programme_id,statut,programme:programmes_formation(temple_id)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const scores = useMemo(() => {
    return temples.map((t) => {
      const tMembres = membres.filter((m) => m.temple_id === t.id);
      const tCultes = cultes.filter((c) => c.temple_id === t.id);
      const culteIds = new Set(tCultes.map((c) => c.id));
      const tPres = presences.filter((p) => culteIds.has(p.culte_id));

      // 1. Taux de présence (40 pts)
      let attendanceScore = 0;
      if (tCultes.length > 0 && tMembres.length > 0) {
        let totalExpected = 0;
        let totalPresent = 0;
        tCultes.forEach((c) => {
          const eligibles = isEcodimAllowed(c.type_culte)
            ? tMembres
            : tMembres.filter((m) => m.categorie !== ECODIM_CATEGORY);
          totalExpected += eligibles.length;
          const presIds = new Set(
            tPres.filter((p) => p.culte_id === c.id && p.statut === "present").map((p) => p.membre_id),
          );
          totalPresent += eligibles.filter((m) => presIds.has(m.id)).length;
        });
        const rate = totalExpected > 0 ? totalPresent / totalExpected : 0;
        attendanceScore = Math.round(rate * 40);
      }

      // 2. Régularité des rapports (20 pts) — % de cultes validés sur 90j
      let reportScore = 0;
      if (tCultes.length > 0) {
        const validRate = tCultes.filter((c) => c.statut === "valide" || c.statut === "corrige_admin").length / tCultes.length;
        reportScore = Math.round(validRate * 20);
      }

      // 3. Croissance des membres (20 pts) — nouveaux sur 90j vs effectif
      const since = subDays(new Date(), 90);
      const nouveaux = tMembres.filter((m) => m.date_ajout && parseISO(m.date_ajout) >= since).length;
      const growthRate = tMembres.length > 0 ? nouveaux / tMembres.length : 0;
      const growthScore = Math.min(20, Math.round(growthRate * 100));

      // 4. Activité (formations + cultes/mois) (20 pts)
      const tInscr = inscriptions.filter((i) => (i.programme as { temple_id?: string } | null)?.temple_id === t.id);
      const culteFreq = tCultes.length / 3; // par mois
      const activityScore = Math.min(20, Math.round(Math.min(culteFreq / 4, 1) * 12) + Math.min(8, tInscr.length));

      const total = attendanceScore + reportScore + growthScore + activityScore;
      const niveau: "excellent" | "bon" | "moyen" | "faible" =
        total >= 80 ? "excellent" : total >= 60 ? "bon" : total >= 40 ? "moyen" : "faible";

      return {
        temple: t,
        total,
        niveau,
        details: {
          attendance: attendanceScore,
          report: reportScore,
          growth: growthScore,
          activity: activityScore,
          membres: tMembres.length,
          cultes: tCultes.length,
          nouveaux,
          inscriptions: tInscr.length,
        },
      };
    }).sort((a, b) => b.total - a.total);
  }, [temples, membres, cultes, presences, inscriptions]);

  const moyenne = scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.total, 0) / scores.length) : 0;
  const excellents = scores.filter((s) => s.niveau === "excellent").length;
  const faibles = scores.filter((s) => s.niveau === "faible").length;

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const niveauBadge = (n: "excellent" | "bon" | "moyen" | "faible") => {
    const cls = n === "excellent" ? "bg-success text-success-foreground"
      : n === "bon" ? "bg-primary text-primary-foreground"
      : n === "moyen" ? "bg-warning text-warning-foreground"
      : "bg-destructive text-destructive-foreground";
    return <Badge className={cls}>{n.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><HeartPulse className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indice de santé du temple</h1>
          <p className="text-sm text-muted-foreground">
            Score composite sur 90 jours : présence (40), rapports (20), croissance (20), activité (20)
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Score moyen" value={`${moyenne}/100`} icon={Activity} variant="gold" />
        <StatCard label="Temples évalués" value={scores.length} icon={Users} />
        <StatCard label="Excellents" value={excellents} icon={TrendingUp} variant="success" />
        <StatCard label="À soutenir" value={faibles} icon={ClipboardCheck} variant="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {scores.map(({ temple, total, niveau, details }) => (
          <Card key={temple.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{temple.nom_temple}</div>
                <div className="text-xs text-muted-foreground">
                  {[temple.ville, temple.pays].filter(Boolean).join(" – ") || "Lieu non renseigné"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground">{total}<span className="text-base text-muted-foreground">/100</span></div>
                <div className="mt-1">{niveauBadge(niveau)}</div>
              </div>
            </div>

            <Progress value={total} className="h-2" />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Metric label="Présence" value={details.attendance} max={40} icon={Users} />
              <Metric label="Rapports validés" value={details.report} max={20} icon={ClipboardCheck} />
              <Metric label="Croissance" value={details.growth} max={20} icon={TrendingUp} />
              <Metric label="Activité" value={details.activity} max={20} icon={BookOpen} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
              <span>{details.membres} membres</span>
              <span>•</span>
              <span>{details.cultes} cultes/90j</span>
              <span>•</span>
              <span>+{details.nouveaux} nouveaux</span>
              <span>•</span>
              <span>{details.inscriptions} formations</span>
            </div>
          </Card>
        ))}
        {scores.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground lg:col-span-2">
            Aucun temple à évaluer.
          </Card>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, max, icon: Icon }: { label: string; value: number; max: number; icon: typeof Activity }) {
  const pct = Math.round((value * 100) / max);
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <span className="font-semibold text-foreground">{value}/{max}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
