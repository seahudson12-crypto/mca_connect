import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Plus, Pencil, Trash2, TrendingUp, Building2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { formatXof } from "@/lib/audit";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";

export const Route = createFileRoute("/_app/objectifs")({ component: ObjectifsPage });

const TYPES = [
  { value: "membres", label: "Membres", unit: "personnes" },
  { value: "nouvelles_ames", label: "Nouvelles âmes", unit: "personnes" },
  { value: "baptemes", label: "Baptêmes", unit: "personnes" },
  { value: "visiteurs", label: "Visiteurs", unit: "personnes" },
  { value: "presence_moyenne", label: "Présence moyenne / culte", unit: "personnes" },
  { value: "offrandes", label: "Offrandes", unit: "FCFA" },
  { value: "dimes", label: "Dîmes", unit: "FCFA" },
  { value: "autre", label: "Autre", unit: "" },
] as const;
type ObjType = typeof TYPES[number]["value"];
const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;
const typeUnit = (t: string) => TYPES.find((x) => x.value === t)?.unit ?? "";

interface Objectif {
  id: string;
  temple_id: string;
  annee: number;
  type_objectif: ObjType;
  libelle: string | null;
  valeur_cible: number;
  notes: string | null;
}

function ObjectifsPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { activeTempleId, allTemples } = useActiveTemple();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<Objectif | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // --- Objectifs du temple actif
  const { data: objectifs = [] } = useQuery({
    queryKey: ["objectifs", activeTempleId, year],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objectifs_temple" as never)
        .select("*")
        .eq("temple_id", activeTempleId!)
        .eq("annee", year)
        .order("type_objectif");
      if (error) throw error;
      return (data ?? []) as unknown as Objectif[];
    },
  });

  // --- Valeurs réelles pour le temple actif
  const { data: actuals } = useQuery({
    queryKey: ["objectifs-actuals", activeTempleId, year],
    enabled: !!activeTempleId,
    queryFn: async () => computeActuals(activeTempleId!, year),
  });

  // --- Données comparatives multi-temples (super admin)
  const { data: comparatif = [] } = useQuery({
    queryKey: ["objectifs-comparatif", year, allTemples.map((t) => t.id).join(",")],
    enabled: isSuperAdmin && allTemples.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(
        allTemples.map(async (t) => {
          const [objs, real] = await Promise.all([
            supabase
              .from("objectifs_temple" as never)
              .select("type_objectif,valeur_cible")
              .eq("temple_id", t.id)
              .eq("annee", year),
            computeActuals(t.id, year),
          ]);
          const objList = ((objs.data ?? []) as unknown as { type_objectif: ObjType; valeur_cible: number }[]);
          const cible = (k: ObjType) => objList.filter((o) => o.type_objectif === k).reduce((s, x) => s + Number(x.valeur_cible), 0);
          return {
            id: t.id,
            nom: t.nom_temple,
            membres: real.membres,
            membres_cible: cible("membres"),
            nouvelles_ames: real.nouvelles_ames,
            nouvelles_ames_cible: cible("nouvelles_ames"),
            presence_moyenne: real.presence_moyenne,
            presence_moyenne_cible: cible("presence_moyenne"),
            offrandes: real.offrandes,
            offrandes_cible: cible("offrandes"),
            taux_global: globalRate(real, objList),
          };
        }),
      );
      return rows;
    },
  });

  const upsertM = useMutation({
    mutationFn: async (payload: Partial<Objectif>) => {
      const table = supabase.from("objectifs_temple" as never) as unknown as {
        update: (p: unknown) => { eq: (k: string, v: unknown) => Promise<{ error: Error | null }> };
        insert: (p: unknown) => Promise<{ error: Error | null }>;
      };
      if (payload.id) {
        const { error } = await table.update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await table.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectifs"] });
      qc.invalidateQueries({ queryKey: ["objectifs-comparatif"] });
      toast.success("Objectif enregistré");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("objectifs_temple" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectifs"] });
      qc.invalidateQueries({ queryKey: ["objectifs-comparatif"] });
      toast.success("Supprimé");
    },
  });

  const realValueFor = (t: ObjType) => {
    if (!actuals) return 0;
    switch (t) {
      case "membres": return actuals.membres;
      case "nouvelles_ames": return actuals.nouvelles_ames;
      case "presence_moyenne": return actuals.presence_moyenne;
      case "offrandes": return actuals.offrandes;
      case "dimes": return actuals.dimes;
      default: return 0;
    }
  };

  const globalTaux = useMemo(() => globalRate(actuals, objectifs), [actuals, objectifs]);

  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6 text-primary"/> Pilotage des objectifs</h1>
          <p className="text-sm text-muted-foreground">Suivi annuel de la croissance et de la performance du temple.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Année</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1"/> Nouvel objectif
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="temple">
        <TabsList>
          <TabsTrigger value="temple">Mon temple</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="comparatif">Comparaison inter-temples</TabsTrigger>}
        </TabsList>

        <TabsContent value="temple" className="space-y-4 pt-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Taux global d'atteinte {year}</div>
                <div className="text-3xl font-bold mt-1">{globalTaux.toFixed(0)}%</div>
              </div>
              <Trophy className={`h-10 w-10 ${globalTaux >= 100 ? "text-success" : globalTaux >= 70 ? "text-gold" : "text-muted-foreground"}`} />
            </div>
            <Progress value={Math.min(globalTaux, 100)} className="mt-3 h-3" />
          </Card>

          {objectifs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              Aucun objectif défini pour {year}. {isAdmin && "Cliquez sur « Nouvel objectif » pour commencer."}
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {objectifs.map((o) => {
                const real = realValueFor(o.type_objectif);
                const taux = o.valeur_cible > 0 ? (real / Number(o.valeur_cible)) * 100 : 0;
                const isMoney = o.type_objectif === "offrandes" || o.type_objectif === "dimes";
                return (
                  <Card key={o.id} className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{typeLabel(o.type_objectif)}</Badge>
                          {o.libelle && <span className="text-sm font-medium">{o.libelle}</span>}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold">{isMoney ? formatXof(real) : real.toLocaleString("fr-FR")}</span>
                          <span className="text-sm text-muted-foreground">/ {isMoney ? formatXof(Number(o.valeur_cible)) : Number(o.valeur_cible).toLocaleString("fr-FR")} {typeUnit(o.type_objectif)}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(o); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Supprimer cet objectif ?")) deleteM.mutate(o.id); }}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={Math.min(taux, 100)} className="h-2 flex-1" />
                      <Badge className={taux >= 100 ? "bg-success text-success-foreground" : taux >= 70 ? "bg-gold text-foreground" : "bg-muted text-muted-foreground"}>
                        {taux.toFixed(0)}%
                      </Badge>
                    </div>
                    {o.notes && <p className="mt-2 text-xs text-muted-foreground">{o.notes}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="comparatif" className="space-y-4 pt-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary"/>
                <h3 className="font-semibold">Taux global d'atteinte par temple — {year}</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparatif}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                  <XAxis dataKey="nom" tick={{ fontSize: 11 }}/>
                  <YAxis unit="%" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
                  <Bar dataKey="taux_global" name="Taux d'atteinte" radius={[6,6,0,0]}>
                    {comparatif.map((row, i) => (
                      <Cell key={i} fill={row.taux_global >= 100 ? "hsl(var(--success))" : row.taux_global >= 70 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-primary"/>
                <h3 className="font-semibold">Détail par temple — {year}</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Temple</TableHead>
                      <TableHead className="text-right">Membres</TableHead>
                      <TableHead className="text-right">Nouv. âmes</TableHead>
                      <TableHead className="text-right">Prés. moy.</TableHead>
                      <TableHead className="text-right">Offrandes</TableHead>
                      <TableHead className="text-right">Taux global</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparatif.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nom}</TableCell>
                        <TableCell className="text-right">{r.membres} / {r.membres_cible || "—"}</TableCell>
                        <TableCell className="text-right">{r.nouvelles_ames} / {r.nouvelles_ames_cible || "—"}</TableCell>
                        <TableCell className="text-right">{r.presence_moyenne} / {r.presence_moyenne_cible || "—"}</TableCell>
                        <TableCell className="text-right">{formatXof(r.offrandes)}{r.offrandes_cible ? ` / ${formatXof(r.offrandes_cible)}` : ""}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={r.taux_global >= 100 ? "bg-success text-success-foreground" : r.taux_global >= 70 ? "bg-gold text-foreground" : "bg-muted text-muted-foreground"}>
                            {r.taux_global.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <ObjectifDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        initial={editing}
        templeId={activeTempleId}
        year={year}
        onSave={(p) => upsertM.mutate(p)}
        saving={upsertM.isPending}
      />
    </div>
  );
}

// ---------- Helpers ----------

async function computeActuals(templeId: string, year: number) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [membresQ, soulsQ, cultesQ, presQ, finQ] = await Promise.all([
    supabase.from("membres").select("id", { count: "exact", head: true })
      .eq("temple_id", templeId).eq("actif", true),
    supabase.from("membres").select("id", { count: "exact", head: true })
      .eq("temple_id", templeId).eq("categorie", "nouvelles_ames")
      .gte("date_ajout", start).lte("date_ajout", end),
    supabase.from("cultes").select("id").eq("temple_id", templeId)
      .gte("date", start).lte("date", end),
    null,
    null,
  ]);

  const culteIds = ((cultesQ.data ?? []) as { id: string }[]).map((c) => c.id);
  let presenceMoyenne = 0;
  let offrandes = 0, dimes = 0;
  if (culteIds.length) {
    const [presCount, fin] = await Promise.all([
      supabase.from("presences").select("culte_id").in("culte_id", culteIds).eq("statut", "present"),
      supabase.from("finances_culte").select("offrande,dime").in("culte_id", culteIds),
    ]);
    const presList = (presCount.data ?? []) as { culte_id: string }[];
    presenceMoyenne = Math.round(presList.length / culteIds.length);
    const finRows = (fin.data ?? []) as { offrande: number; dime: number }[];
    offrandes = finRows.reduce((s, r) => s + Number(r.offrande ?? 0), 0);
    dimes = finRows.reduce((s, r) => s + Number(r.dime ?? 0), 0);
  }

  return {
    membres: membresQ.count ?? 0,
    nouvelles_ames: soulsQ.count ?? 0,
    presence_moyenne: presenceMoyenne,
    offrandes,
    dimes,
    visiteurs: 0,
    baptemes: 0,
  };
  void presQ; void finQ;
}

function globalRate(
  actuals: Awaited<ReturnType<typeof computeActuals>> | undefined,
  objs: Array<{ type_objectif: ObjType; valeur_cible: number }>,
) {
  if (!actuals || objs.length === 0) return 0;
  const taux: number[] = [];
  for (const o of objs) {
    const target = Number(o.valeur_cible);
    if (target <= 0) continue;
    const real =
      o.type_objectif === "membres" ? actuals.membres
      : o.type_objectif === "nouvelles_ames" ? actuals.nouvelles_ames
      : o.type_objectif === "presence_moyenne" ? actuals.presence_moyenne
      : o.type_objectif === "offrandes" ? actuals.offrandes
      : o.type_objectif === "dimes" ? actuals.dimes
      : 0;
    taux.push(Math.min((real / target) * 100, 150));
  }
  if (taux.length === 0) return 0;
  return taux.reduce((s, x) => s + x, 0) / taux.length;
}

function ObjectifDialog({
  open, onClose, initial, templeId, year, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: Objectif | null;
  templeId: string | null;
  year: number;
  onSave: (payload: Partial<Objectif>) => void;
  saving: boolean;
}) {
  const [type, setType] = useState<ObjType>(initial?.type_objectif ?? "membres");
  const [libelle, setLibelle] = useState(initial?.libelle ?? "");
  const [valeur, setValeur] = useState<string>(initial ? String(initial.valeur_cible) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Reset on open
  useMemo(() => {
    if (open) {
      setType(initial?.type_objectif ?? "membres");
      setLibelle(initial?.libelle ?? "");
      setValeur(initial ? String(initial.valeur_cible) : "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  const submit = () => {
    if (!templeId) return toast.error("Aucun temple actif");
    const v = Number(valeur);
    if (!Number.isFinite(v) || v <= 0) return toast.error("Valeur cible invalide");
    onSave({
      id: initial?.id,
      temple_id: templeId,
      annee: year,
      type_objectif: type,
      libelle: libelle.trim() || null,
      valeur_cible: v,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type d'objectif</Label>
            <Select value={type} onValueChange={(v) => setType(v as ObjType)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Libellé (facultatif)</Label>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Croissance Q1" />
          </div>
          <div>
            <Label>Valeur cible {typeUnit(type) && `(${typeUnit(type)})`}</Label>
            <Input type="number" min="0" value={valeur} onChange={(e) => setValeur(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
