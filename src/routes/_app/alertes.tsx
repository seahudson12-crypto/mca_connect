import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, AlertCircle, Info, Cake, UserX, FileWarning, TrendingDown, Sparkles, Bell } from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { categoryLabel, culteTypeLabel } from "@/lib/constants";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_app/alertes")({ component: AlertesPage });

type Niveau = "info" | "attention" | "critique";
type Alerte = {
  id: string;
  niveau: Niveau;
  type: string;
  titre: string;
  description: string;
  icon: typeof Bell;
  href?: { to: string; params?: Record<string, string> };
};

const NIVEAU_META: Record<Niveau, { label: string; cls: string; Icon: typeof Bell }> = {
  info: { label: "Information", cls: "bg-primary/10 text-primary border-primary/30", Icon: Info },
  attention: { label: "Attention", cls: "bg-gold/15 text-gold border-gold/40", Icon: AlertTriangle },
  critique: { label: "Critique", cls: "bg-destructive/10 text-destructive border-destructive/40", Icon: AlertCircle },
};

function AlertesPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const { activeTempleId } = useActiveTemple();

  // Pour Super Admin → toutes les données ; sinon scoppé au temple
  const scope = isSuperAdmin ? null : activeTempleId;

  const { data: membres = [] } = useQuery({
    queryKey: ["alertes-membres", scope],
    queryFn: async () => {
      let q = supabase.from("membres").select("id,nom,prenoms,categorie,date_naissance,temple_id,date_ajout,actif").eq("actif", true);
      if (scope) q = q.eq("temple_id", scope);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cultes = [] } = useQuery({
    queryKey: ["alertes-cultes", scope],
    queryFn: async () => {
      let q = supabase.from("cultes").select("id,date,type_culte,statut,created_at,temple_id").order("date", { ascending: false }).limit(50);
      if (scope) q = q.eq("temple_id", scope);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const culteIds = cultes.map((c) => c.id);

  const { data: presences = [] } = useQuery({
    queryKey: ["alertes-presences", culteIds],
    enabled: culteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("membre_id,culte_id,statut")
        .in("culte_id", culteIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alertes = useMemo<Alerte[]>(() => {
    const list: Alerte[] = [];
    const today = new Date();
    const todayKey = format(today, "MM-dd");

    // Tri des 3 derniers cultes par temple
    const cultesByTemple = new Map<string, typeof cultes>();
    for (const c of cultes) {
      const arr = cultesByTemple.get(c.temple_id) ?? [];
      arr.push(c);
      cultesByTemple.set(c.temple_id, arr);
    }

    // 1. Rapports brouillon depuis +7 jours
    cultes.forEach((c) => {
      if (c.statut === "brouillon") {
        const days = differenceInDays(today, parseISO(c.date));
        if (days > 7) {
          list.push({
            id: `draft-${c.id}`,
            niveau: days > 14 ? "critique" : "attention",
            type: "rapport",
            titre: "Rapport non validé",
            description: `Culte ${culteTypeLabel(c.type_culte)} du ${format(parseISO(c.date), "d MMM yyyy", { locale: fr })} (${days} jours)`,
            icon: FileWarning,
            href: { to: "/presences/$culteId", params: { culteId: c.id } },
          });
        }
      }
    });

    // 2. Anniversaires du jour
    membres.forEach((m) => {
      if (m.date_naissance) {
        const key = format(parseISO(m.date_naissance), "MM-dd");
        if (key === todayKey) {
          list.push({
            id: `birthday-${m.id}`,
            niveau: "info",
            type: "anniversaire",
            titre: `Anniversaire : ${m.nom} ${m.prenoms}`,
            description: `${categoryLabel(m.categorie)} — Pensez à envoyer un message`,
            icon: Cake,
          });
        }
      }
    });

    // 3. Absences répétées (3 derniers cultes consécutifs du temple du membre)
    const presMap = new Map<string, Map<string, string>>(); // culte_id → membre_id → statut
    for (const p of presences) {
      const m = presMap.get(p.culte_id) ?? new Map();
      m.set(p.membre_id, p.statut);
      presMap.set(p.culte_id, m);
    }
    membres.forEach((m) => {
      const tCultes = (cultesByTemple.get(m.temple_id) ?? []).slice(0, 3);
      if (tCultes.length < 3) return;
      const allAbsent = tCultes.every((c) => presMap.get(c.id)?.get(m.id) === "absent");
      if (allAbsent) {
        list.push({
          id: `absent-${m.id}`,
          niveau: "critique",
          type: "absence",
          titre: `${m.nom} ${m.prenoms} absent 3 cultes consécutifs`,
          description: `${categoryLabel(m.categorie)} — Suivi pastoral recommandé`,
          icon: UserX,
        });
      }
    });

    // 4. Nouvelles âmes inactives (>30j sans présence enregistrée)
    membres.forEach((m) => {
      if (m.categorie !== "nouvelles_ames") return;
      const addedDays = differenceInDays(today, parseISO(m.date_ajout));
      if (addedDays < 30) return;
      const tCultes = cultesByTemple.get(m.temple_id) ?? [];
      const hasPresent = tCultes.some((c) => presMap.get(c.id)?.get(m.id) === "present");
      if (!hasPresent) {
        list.push({
          id: `nouvelle-${m.id}`,
          niveau: "attention",
          type: "nouvelle_ame",
          titre: `Nouvelle âme inactive : ${m.nom} ${m.prenoms}`,
          description: `Ajoutée il y a ${addedDays} jours, aucune présence enregistrée`,
          icon: Sparkles,
        });
      }
    });

    // 5. Baisse des présences (dernier culte vs moyenne des 4 précédents)
    cultesByTemple.forEach((tCultes) => {
      const sorted = [...tCultes].sort((a, b) => b.date.localeCompare(a.date));
      const recent = sorted.slice(0, 5);
      if (recent.length < 5) return;
      const count = (c: typeof cultes[number]) =>
        Array.from(presMap.get(c.id)?.values() ?? []).filter((s) => s === "present").length;
      const last = count(recent[0]);
      const avgPrev = (count(recent[1]) + count(recent[2]) + count(recent[3]) + count(recent[4])) / 4;
      if (avgPrev > 0 && last < avgPrev * 0.7) {
        list.push({
          id: `baisse-${recent[0].id}`,
          niveau: "attention",
          type: "baisse_presence",
          titre: "Baisse des présences détectée",
          description: `Dernier culte : ${last} présents vs moyenne ${Math.round(avgPrev)} (${Math.round((1 - last / avgPrev) * 100)}% de baisse)`,
          icon: TrendingDown,
          href: { to: "/cultes" },
        });
      }
    });

    return list;
  }, [membres, cultes, presences]);

  const counts = useMemo(() => {
    const c = { info: 0, attention: 0, critique: 0, total: alertes.length };
    alertes.forEach((a) => { c[a.niveau]++; });
    return c;
  }, [alertes]);

  if (!isAdmin) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        Cette page est réservée aux administrateurs.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" /> Centre d'alertes
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin ? "Alertes globales — tous les temples" : "Alertes pour votre temple"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Total alertes</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant border-l-4 border-l-destructive">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Critiques</div>
          <div className="text-2xl font-bold text-destructive">{counts.critique}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant border-l-4 border-l-gold">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Attention</div>
          <div className="text-2xl font-bold text-gold">{counts.attention}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant border-l-4 border-l-primary">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Informations</div>
          <div className="text-2xl font-bold text-primary">{counts.info}</div>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Toutes ({counts.total})</TabsTrigger>
          <TabsTrigger value="critique">Critiques ({counts.critique})</TabsTrigger>
          <TabsTrigger value="attention">Attention ({counts.attention})</TabsTrigger>
          <TabsTrigger value="info">Infos ({counts.info})</TabsTrigger>
        </TabsList>
        {(["all", "critique", "attention", "info"] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-2 mt-4">
            {alertes
              .filter((a) => t === "all" || a.niveau === t)
              .sort((a, b) => {
                const order: Record<Niveau, number> = { critique: 0, attention: 1, info: 2 };
                return order[a.niveau] - order[b.niveau];
              })
              .map((a) => {
                const meta = NIVEAU_META[a.niveau];
                const Icon = a.icon;
                const inner = (
                  <Card className={`p-4 border-l-4 ${meta.cls} hover:shadow-elegant transition-shadow`}>
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                        </div>
                        <div className="font-semibold">{a.titre}</div>
                        <div className="text-sm text-muted-foreground">{a.description}</div>
                      </div>
                    </div>
                  </Card>
                );
                return a.href ? (
                  <Link key={a.id} to={a.href.to} params={a.href.params as never}>{inner}</Link>
                ) : (
                  <div key={a.id}>{inner}</div>
                );
              })}
            {alertes.filter((a) => t === "all" || a.niveau === t).length === 0 && (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                Aucune alerte dans cette catégorie. Tout va bien !
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
