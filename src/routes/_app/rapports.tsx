import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, FileDown, Building2, CheckCircle2, ShieldCheck, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { CULTE_TYPES, culteTypeLabel, CATEGORIES, categoryLabel } from "@/lib/constants";
import { formatXof } from "@/lib/audit";
import { generateRapportPdf } from "@/lib/pdf-rapport";

export const Route = createFileRoute("/_app/rapports")({ component: RapportsPage });

type CulteRow = {
  id: string; date: string; type_culte: string; statut: string;
  orateur: string | null; theme_principal: string | null;
  validated_at: string | null; temple_id: string;
  temple: { id: string; nom_temple: string; ville: string | null; pays: string | null } | null;
};

function RapportsPage() {
  const { isSuperAdmin, loading } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [templeFilter, setTempleFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("valide");
  const [detail, setDetail] = useState<CulteRow | null>(null);

  const { data: temples = [] } = useQuery({
    queryKey: ["temples-all-rapports"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("temples").select("id,nom_temple").eq("actif", true).order("nom_temple");
      if (error) throw error;
      return data as Array<{ id: string; nom_temple: string }>;
    },
  });

  const { data: rapports = [], isLoading } = useQuery({
    queryKey: ["rapports", from, to, templeFilter, typeFilter, statutFilter],
    enabled: isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("cultes")
        .select("id,date,type_culte,statut,orateur,theme_principal,validated_at,temple_id,temple:temples(id,nom_temple,ville,pays)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (templeFilter !== "all") q = q.eq("temple_id", templeFilter);
      if (typeFilter !== "all") q = q.eq("type_culte", typeFilter as never);
      if (statutFilter !== "all") q = q.eq("statut", statutFilter as never);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CulteRow[];
    },
  });

  const stats = useMemo(() => {
    const total = rapports.length;
    const valides = rapports.filter((r) => r.statut === "valide").length;
    const corriges = rapports.filter((r) => r.statut === "corrige_admin").length;
    const brouillons = rapports.filter((r) => r.statut === "brouillon").length;
    return { total, valides, corriges, brouillons };
  }, [rapports]);

  const exportPdf = async (r: CulteRow) => {
    if (!r.temple) return toast.error("Temple manquant");
    const [{ data: membres }, { data: presences }, { data: finance }, { data: orateurs }] = await Promise.all([
      supabase.from("membres").select("id,nom,prenoms,categorie,matricule").eq("temple_id", r.temple_id).eq("actif", true),
      supabase.from("presences").select("membre_id,statut").eq("culte_id", r.id),
      supabase.from("finances_culte").select("*").eq("culte_id", r.id).maybeSingle(),
      supabase.from("orateurs_culte").select("nom,fonction,theme,versets,ordre").eq("culte_id", r.id).order("ordre"),
    ]);
    const doc = generateRapportPdf({
      culte: r,
      temple: r.temple,
      membres: (membres ?? []) as never,
      presences: (presences ?? []) as never,
      orateurs: (orateurs ?? []) as never,
      finance: (finance as never) ?? null,
    });
    doc.save(`rapport-${r.temple.nom_temple.replace(/\s+/g, "_")}-${r.date}.pdf`);
    toast.success("PDF généré");
  };

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> Rapports des temples
        </h1>
        <p className="text-sm text-muted-foreground">Centralisation des rapports de culte de tous les temples</p>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5"><Label>Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Temple</Label>
            <Select value={templeFilter} onValueChange={setTempleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les temples</SelectItem>
                {temples.map((t) => <SelectItem key={t.id} value={t.id}>{t.nom_temple}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type de culte</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {CULTE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="valide">Validés</SelectItem>
                <SelectItem value="corrige_admin">Corrigés Admin</SelectItem>
                <SelectItem value="brouillon">Brouillons</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Validés</div>
          <div className="text-2xl font-bold text-success">{stats.valides}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Corrigés admin</div>
          <div className="text-2xl font-bold text-gold">{stats.corriges}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Brouillons</div>
          <div className="text-2xl font-bold text-muted-foreground">{stats.brouillons}</div>
        </Card>
      </div>

      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Liste des rapports ({rapports.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Temple</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Orateur</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && rapports.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun rapport sur la période</td></tr>
              )}
              {rapports.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 whitespace-nowrap">{format(new Date(r.date), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-2"><Badge variant="outline" className="font-normal"><Building2 className="h-3 w-3 mr-1" />{r.temple?.nom_temple ?? "—"}</Badge></td>
                  <td className="px-4 py-2">{culteTypeLabel(r.type_culte)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.orateur ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.statut === "valide" && <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Validé</Badge>}
                    {r.statut === "corrige_admin" && <Badge className="bg-gold text-foreground"><ShieldCheck className="h-3 w-3 mr-1" />Corrigé</Badge>}
                    {r.statut === "brouillon" && <Badge variant="secondary">Brouillon</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}><Eye className="h-4 w-4 mr-1" />Détail</Button>
                    <Button size="sm" variant="ghost" onClick={() => exportPdf(r)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail && `${culteTypeLabel(detail.type_culte)} — ${format(new Date(detail.date), "EEEE d MMMM yyyy", { locale: fr })}`}
            </DialogTitle>
          </DialogHeader>
          {detail && <RapportDetail rapport={detail} onExport={() => exportPdf(detail)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RapportDetail({ rapport, onExport }: { rapport: CulteRow; onExport: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rapport-detail", rapport.id],
    queryFn: async () => {
      const [{ data: membres }, { data: presences }, { data: finance }] = await Promise.all([
        supabase.from("membres").select("id,nom,prenoms,categorie,matricule").eq("temple_id", rapport.temple_id).eq("actif", true),
        supabase.from("presences").select("membre_id,statut").eq("culte_id", rapport.id),
        supabase.from("finances_culte").select("*").eq("culte_id", rapport.id).maybeSingle(),
      ]);
      return { membres: membres ?? [], presences: presences ?? [], finance };
    },
  });

  const byCat = useMemo(() => {
    const m = new Map<string, { total: number; present: number; absent: number }>();
    const presMap = new Map((data?.presences ?? []).map((p) => [p.membre_id, p.statut]));
    (data?.membres ?? []).forEach((mb) => {
      const b = m.get(mb.categorie) ?? { total: 0, present: 0, absent: 0 };
      b.total++;
      const s = presMap.get(mb.id);
      if (s === "present") b.present++;
      else if (s === "absent") b.absent++;
      m.set(mb.categorie, b);
    });
    return m;
  }, [data]);

  const totalP = Array.from(byCat.values()).reduce((s, b) => s + b.present, 0);
  const totalA = Array.from(byCat.values()).reduce((s, b) => s + b.absent, 0);
  const totalM = Array.from(byCat.values()).reduce((s, b) => s + b.total, 0);
  const taux = totalM > 0 ? Math.round((totalP * 100) / totalM) : 0;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Chargement…</div>;

  const f = data?.finance as
    | { offrande: number; dime: number; action_grace: number; semence: number; contribution_speciale: number; depense: number; solde: number; observation: string | null }
    | null
    | undefined;
  const recettes = f ? Number(f.offrande) + Number(f.dime) + Number(f.action_grace) + Number(f.semence) + Number(f.contribution_speciale) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 bg-muted/30">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Temple :</span> <strong>{rapport.temple?.nom_temple}</strong></div>
          <div><span className="text-muted-foreground">Statut :</span> <strong>{rapport.statut}</strong></div>
          {rapport.orateur && <div><span className="text-muted-foreground">Orateur :</span> {rapport.orateur}</div>}
          {rapport.theme_principal && <div className="col-span-2 italic">« {rapport.theme_principal} »</div>}
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-md border p-3 text-center"><div className="text-xs text-muted-foreground">Effectif</div><div className="text-xl font-bold">{totalM}</div></div>
        <div className="rounded-md border p-3 text-center"><div className="text-xs text-muted-foreground">Présents</div><div className="text-xl font-bold text-success">{totalP}</div></div>
        <div className="rounded-md border p-3 text-center"><div className="text-xs text-muted-foreground">Absents</div><div className="text-xl font-bold text-destructive">{totalA}</div></div>
        <div className="rounded-md border p-3 text-center"><div className="text-xs text-muted-foreground">Taux</div><div className="text-xl font-bold text-gold">{taux}%</div></div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Présences par catégorie</h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Effectif</th>
                <th className="px-3 py-2 text-right">Présents</th>
                <th className="px-3 py-2 text-right">Absents</th>
                <th className="px-3 py-2 text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.filter((c) => (byCat.get(c.value)?.total ?? 0) > 0).map((c) => {
                const b = byCat.get(c.value)!;
                const t = b.total > 0 ? Math.round((b.present * 100) / b.total) : 0;
                return (
                  <tr key={c.value} className="border-t">
                    <td className="px-3 py-2">{categoryLabel(c.value)}</td>
                    <td className="px-3 py-2 text-right">{b.total}</td>
                    <td className="px-3 py-2 text-right text-success">{b.present}</td>
                    <td className="px-3 py-2 text-right text-destructive">{b.absent}</td>
                    <td className="px-3 py-2 text-right font-semibold">{t}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {f && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Rapport financier</h3>
          <div className="grid grid-cols-2 gap-2 text-sm rounded-md border p-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Offrandes</span><strong>{formatXof(Number(f.offrande))}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dîmes</span><strong>{formatXof(Number(f.dime))}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Actions de grâce</span><strong>{formatXof(Number(f.action_grace))}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Semences</span><strong>{formatXof(Number(f.semence))}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Contributions spé.</span><strong>{formatXof(Number(f.contribution_speciale))}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dépenses</span><strong className="text-destructive">{formatXof(Number(f.depense))}</strong></div>
            <div className="col-span-2 mt-2 pt-2 border-t flex justify-between"><span>Total recettes</span><strong className="text-success">{formatXof(recettes)}</strong></div>
            <div className="col-span-2 flex justify-between"><span>Solde final</span><strong className="text-gold">{formatXof(Number(f.solde))}</strong></div>
          </div>
          {f.observation && (
            <div className="mt-2 text-sm">
              <div className="text-muted-foreground font-medium mb-1">Observations</div>
              <div className="italic rounded-md bg-muted/50 p-3">{f.observation}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onExport} className="gradient-brand text-primary-foreground border-0">
          <FileDown className="mr-2 h-4 w-4" /> Télécharger le PDF
        </Button>
      </div>
    </div>
  );
}
