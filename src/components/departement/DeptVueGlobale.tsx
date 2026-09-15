import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Globe2 } from "lucide-react";
import { type Activite, statsActivites } from "@/lib/departement";

type TempleRow = { id: string; nom_temple: string; pays: string | null };
type DeptRow = { id: string; nom: string; temple_id: string };

export function DeptVueGlobale() {
  const [pays, setPays] = useState("all");
  const [temple, setTemple] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const { data: temples = [] } = useQuery({
    queryKey: ["vg-temples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("temples").select("id,nom_temple,pays").order("nom_temple");
      if (error) throw error;
      return (data ?? []) as TempleRow[];
    },
  });

  const { data: depts = [] } = useQuery({
    queryKey: ["vg-depts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departements").select("id,nom,temple_id").order("nom");
      if (error) throw error;
      return (data ?? []) as DeptRow[];
    },
  });

  const { data: activites = [] } = useQuery({
    queryKey: ["vg-activites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activites_departement").select("*");
      if (error) throw error;
      return (data ?? []) as Activite[];
    },
  });

  const { data: membreLiens = [] } = useQuery({
    queryKey: ["vg-dept-membres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departement_membres").select("departement_id");
      if (error) throw error;
      return (data ?? []) as Array<{ departement_id: string }>;
    },
  });

  const paysList = useMemo(
    () => Array.from(new Set(temples.map((t) => t.pays).filter(Boolean))) as string[],
    [temples],
  );

  const rows = useMemo(() => {
    const templeById = new Map(temples.map((t) => [t.id, t]));
    return depts
      .filter((d) => {
        const t = templeById.get(d.temple_id);
        if (pays !== "all" && t?.pays !== pays) return false;
        if (temple !== "all" && d.temple_id !== temple) return false;
        if (deptFilter !== "all" && d.nom !== deptFilter) return false;
        return true;
      })
      .map((d) => {
        const s = statsActivites(activites.filter((a) => a.departement_id === d.id));
        return {
          ...d,
          templeNom: templeById.get(d.temple_id)?.nom_temple ?? "—",
          pays: templeById.get(d.temple_id)?.pays ?? "—",
          membres: membreLiens.filter((m) => m.departement_id === d.id).length,
          s,
        };
      });
  }, [depts, temples, activites, membreLiens, pays, temple, deptFilter]);

  const totals = rows.reduce(
    (acc, r) => ({
      membres: acc.membres + r.membres,
      activites: acc.activites + r.s.total,
      realise: acc.realise + r.s.realise,
      retard: acc.retard + r.s.retard,
      avancement: acc.avancement + r.s.avancement,
    }),
    { membres: 0, activites: 0, realise: 0, retard: 0, avancement: 0 },
  );
  const avgAvancement = rows.length ? Math.round(totals.avancement / rows.length) : 0;

  return (
    <Card className="p-4 border-0 shadow-elegant space-y-4">
      <div className="flex items-center gap-2 font-semibold">
        <Globe2 className="h-5 w-5 text-primary" /> Vue globale des départements
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Pays</Label>
          <Select value={pays} onValueChange={setPays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les pays</SelectItem>
              {paysList.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Temple</Label>
          <Select value={temple} onValueChange={setTemple}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les temples</SelectItem>
              {temples.map((t) => <SelectItem key={t.id} value={t.id}>{t.nom_temple}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Département</Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les départements</SelectItem>
              {Array.from(new Set(depts.map((d) => d.nom))).map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5 text-sm">
        <div className="rounded-lg border p-3">Départements<div className="text-xl font-bold">{rows.length}</div></div>
        <div className="rounded-lg border p-3">Membres<div className="text-xl font-bold">{totals.membres}</div></div>
        <div className="rounded-lg border p-3">Activités<div className="text-xl font-bold">{totals.activites}</div></div>
        <div className="rounded-lg border p-3">Réalisées<div className="text-xl font-bold">{totals.realise}</div></div>
        <div className="rounded-lg border p-3">En retard<div className="text-xl font-bold">{totals.retard}</div></div>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={avgAvancement} className="max-w-xs" />
        <span className="text-sm font-semibold">{avgAvancement}% d'avancement moyen</span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Département</TableHead>
              <TableHead>Temple</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Membres</TableHead>
              <TableHead>Activités</TableHead>
              <TableHead>Réalisées</TableHead>
              <TableHead>Retard</TableHead>
              <TableHead>Avancement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Aucun département</TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nom}</TableCell>
                <TableCell className="text-sm">{r.templeNom}</TableCell>
                <TableCell className="text-sm">{r.pays}</TableCell>
                <TableCell>{r.membres}</TableCell>
                <TableCell>{r.s.total}</TableCell>
                <TableCell>{r.s.realise}</TableCell>
                <TableCell>{r.s.retard}</TableCell>
                <TableCell>{r.s.avancement}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
