import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Building2, MapPin, Users, Globe2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/cartographie")({ component: CartographiePage });

type Temple = {
  id: string;
  nom_temple: string;
  ville: string | null;
  commune: string | null;
  pays: string | null;
  actif: boolean;
};

function CartographiePage() {
  const { isSuperAdmin, loading } = useAuth();

  const { data: temples = [] } = useQuery({
    queryKey: ["carto-temples"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("temples")
        .select("id,nom_temple,ville,commune,pays,actif");
      if (error) throw error;
      return (data ?? []) as Temple[];
    },
  });

  const { data: membres = [] } = useQuery({
    queryKey: ["carto-membres"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,temple_id,actif,categorie")
        .eq("actif", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cultes = [] } = useQuery({
    queryKey: ["carto-cultes"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cultes")
        .select("id,temple_id,statut,date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const byTemple = new Map<string, { membres: number; cultes: number; valides: number }>();
    temples.forEach((t) => byTemple.set(t.id, { membres: 0, cultes: 0, valides: 0 }));
    membres.forEach((m) => {
      const b = byTemple.get(m.temple_id);
      if (b) b.membres++;
    });
    cultes.forEach((c) => {
      const b = byTemple.get(c.temple_id);
      if (b) {
        b.cultes++;
        if (c.statut === "valide") b.valides++;
      }
    });
    return byTemple;
  }, [temples, membres, cultes]);

  const totals = useMemo(() => {
    const villes = new Set(temples.map((t) => (t.ville || "").trim()).filter(Boolean));
    const pays = new Set(temples.map((t) => (t.pays || "").trim()).filter(Boolean));
    return {
      temples: temples.length,
      villes: villes.size,
      pays: pays.size,
      membres: membres.length,
    };
  }, [temples, membres]);

  const byPays = useMemo(() => {
    const m = new Map<string, { temples: number; membres: number; cultes: number }>();
    temples.forEach((t) => {
      const key = (t.pays || "Inconnu").trim() || "Inconnu";
      const cur = m.get(key) ?? { temples: 0, membres: 0, cultes: 0 };
      const s = stats.get(t.id);
      cur.temples += 1;
      cur.membres += s?.membres ?? 0;
      cur.cultes += s?.cultes ?? 0;
      m.set(key, cur);
    });
    return Array.from(m.entries())
      .map(([pays, v]) => ({ pays, ...v }))
      .sort((a, b) => b.membres - a.membres);
  }, [temples, stats]);

  const byVille = useMemo(() => {
    const m = new Map<string, { temples: number; membres: number; pays: string }>();
    temples.forEach((t) => {
      const key = `${(t.ville || "Inconnue").trim()}__${(t.pays || "").trim()}`;
      const cur = m.get(key) ?? { temples: 0, membres: 0, pays: (t.pays || "").trim() };
      cur.temples += 1;
      cur.membres += stats.get(t.id)?.membres ?? 0;
      m.set(key, cur);
    });
    return Array.from(m.entries())
      .map(([k, v]) => ({ ville: k.split("__")[0], ...v }))
      .sort((a, b) => b.membres - a.membres);
  }, [temples, stats]);

  const maxMembres = Math.max(1, ...Array.from(stats.values()).map((s) => s.membres));

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Globe2 className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cartographie MCA</h1>
          <p className="text-sm text-muted-foreground">Répartition géographique et statistiques agrégées des temples</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Temples" value={totals.temples} icon={Building2} variant="gold" />
        <StatCard label="Villes" value={totals.villes} icon={MapPin} />
        <StatCard label="Pays" value={totals.pays} icon={Globe2} />
        <StatCard label="Membres actifs" value={totals.membres} icon={Users} variant="success" />
      </div>

      <Tabs defaultValue="temples">
        <TabsList>
          <TabsTrigger value="temples">Par temple</TabsTrigger>
          <TabsTrigger value="villes">Par ville</TabsTrigger>
          <TabsTrigger value="pays">Par pays</TabsTrigger>
        </TabsList>

        <TabsContent value="temples" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Temple</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                  <TableHead className="text-right">Cultes</TableHead>
                  <TableHead className="text-right">Validés</TableHead>
                  <TableHead className="w-[180px]">Poids</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {temples.map((t) => {
                  const s = stats.get(t.id) ?? { membres: 0, cultes: 0, valides: 0 };
                  const pct = Math.round((s.membres * 100) / maxMembres);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.nom_temple}
                        {!t.actif && <Badge variant="secondary" className="ml-2">inactif</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.ville || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.pays || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{s.membres}</TableCell>
                      <TableCell className="text-right">{s.cultes}</TableCell>
                      <TableCell className="text-right">{s.valides}</TableCell>
                      <TableCell>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {temples.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun temple</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="villes" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ville</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Temples</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byVille.map((v) => (
                  <TableRow key={`${v.ville}-${v.pays}`}>
                    <TableCell className="font-medium">{v.ville}</TableCell>
                    <TableCell className="text-muted-foreground">{v.pays || "—"}</TableCell>
                    <TableCell className="text-right">{v.temples}</TableCell>
                    <TableCell className="text-right font-semibold">{v.membres}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pays" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pays</TableHead>
                  <TableHead className="text-right">Temples</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                  <TableHead className="text-right">Cultes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPays.map((p) => (
                  <TableRow key={p.pays}>
                    <TableCell className="font-medium">{p.pays}</TableCell>
                    <TableCell className="text-right">{p.temples}</TableCell>
                    <TableCell className="text-right font-semibold">{p.membres}</TableCell>
                    <TableCell className="text-right">{p.cultes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
