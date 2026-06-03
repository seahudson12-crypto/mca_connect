import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Plus, Trash2, UserPlus, BookOpen, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/formations")({ component: FormationsPage });

type FormationType = "discipulat" | "formation_biblique" | "formation_ministerielle" | "seminaire" | "ecole_dimanche" | "autre";
type Trimestre = "T1" | "T2" | "T3" | "T4" | "annuel";
type Statut = "inscrit" | "en_cours" | "complete" | "abandonne";

interface Programme {
  id: string;
  temple_id: string;
  nom: string;
  description: string | null;
  type_formation: FormationType;
  annee: number;
  trimestre: Trimestre;
  objectif_participants: number;
  responsable: string | null;
  date_debut: string | null;
  date_fin: string | null;
  actif: boolean;
}

interface Inscription {
  id: string;
  programme_id: string;
  membre_id: string;
  statut: Statut;
  progression: number;
  date_inscription: string;
  date_completion: string | null;
  notes: string | null;
}

const TYPE_LABEL: Record<FormationType, string> = {
  discipulat: "Discipulat",
  formation_biblique: "Formation biblique",
  formation_ministerielle: "Formation ministérielle",
  seminaire: "Séminaire",
  ecole_dimanche: "École du dimanche",
  autre: "Autre",
};

const STATUT_LABEL: Record<Statut, string> = {
  inscrit: "Inscrit",
  en_cours: "En cours",
  complete: "Complété",
  abandonne: "Abandonné",
};

const STATUT_COLOR: Record<Statut, string> = {
  inscrit: "bg-muted text-muted-foreground",
  en_cours: "bg-primary text-primary-foreground",
  complete: "bg-emerald-600 text-white",
  abandonne: "bg-destructive text-destructive-foreground",
};

function FormationsPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { activeTempleId, allTemples } = useActiveTemple();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProg, setSelectedProg] = useState<Programme | null>(null);

  const programmesQ = useQuery({
    queryKey: ["formations", "programmes", activeTempleId, year, isSuperAdmin],
    enabled: !!activeTempleId,
    queryFn: async () => {
      let q = supabase.from("programmes_formation" as any).select("*").eq("annee", year).order("created_at", { ascending: false });
      if (!isSuperAdmin && activeTempleId) q = q.eq("temple_id", activeTempleId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Programme[];
    },
  });

  const programmes = programmesQ.data ?? [];
  const scopedProgs = useMemo(
    () => (isSuperAdmin ? programmes : programmes.filter((p) => p.temple_id === activeTempleId)),
    [programmes, isSuperAdmin, activeTempleId],
  );

  const inscriptionsQ = useQuery({
    queryKey: ["formations", "inscriptions", scopedProgs.map((p) => p.id).join(",")],
    enabled: scopedProgs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscriptions_formation" as any)
        .select("*")
        .in("programme_id", scopedProgs.map((p) => p.id));
      if (error) throw error;
      return (data ?? []) as unknown as Inscription[];
    },
  });

  const inscriptions = inscriptionsQ.data ?? [];
  const inscByProg = useMemo(() => {
    const m = new Map<string, Inscription[]>();
    inscriptions.forEach((i) => {
      const arr = m.get(i.programme_id) ?? [];
      arr.push(i);
      m.set(i.programme_id, arr);
    });
    return m;
  }, [inscriptions]);

  const deleteProg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programmes_formation" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programme supprimé");
      qc.invalidateQueries({ queryKey: ["formations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats globales
  const totalInscrits = inscriptions.length;
  const totalComplete = inscriptions.filter((i) => i.statut === "complete").length;
  const totalEnCours = inscriptions.filter((i) => i.statut === "en_cours").length;
  const tauxCompletion = totalInscrits > 0 ? Math.round((totalComplete / totalInscrits) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" /> Formation & Discipulat
          </h1>
          <p className="text-sm text-muted-foreground">
            Suivez les programmes de formation et la progression de chaque participant.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Année</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-brand text-primary-foreground border-0">
                  <Plus className="mr-2 h-4 w-4" /> Nouveau programme
                </Button>
              </DialogTrigger>
              <ProgrammeFormDialog onClose={() => setCreateOpen(false)} year={year} />
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Programmes actifs</div>
          <div className="text-2xl font-bold">{scopedProgs.filter((p) => p.actif).length}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Participants inscrits</div>
          <div className="text-2xl font-bold">{totalInscrits}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">En cours</div>
          <div className="text-2xl font-bold">{totalEnCours}</div>
        </Card>
        <Card className="p-4 border-0 shadow-elegant">
          <div className="text-xs text-muted-foreground">Taux de complétion</div>
          <div className="text-2xl font-bold flex items-center gap-2">
            {tauxCompletion}% <Award className="h-5 w-5 text-gold" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="programmes">
        <TabsList>
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="comparaison">Comparaison temples</TabsTrigger>}
        </TabsList>

        <TabsContent value="programmes" className="space-y-3 mt-4">
          {programmesQ.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {!programmesQ.isLoading && scopedProgs.length === 0 && (
            <Card className="p-8 border-0 text-center text-sm text-muted-foreground">
              Aucun programme de formation pour {year}. {isAdmin && "Créez-en un pour démarrer."}
            </Card>
          )}
          {scopedProgs.map((p) => {
            const insc = inscByProg.get(p.id) ?? [];
            const completes = insc.filter((i) => i.statut === "complete").length;
            const objectif = p.objectif_participants || 0;
            const tauxObj = objectif > 0 ? Math.min(100, Math.round((insc.length / objectif) * 100)) : 0;
            const tauxComp = insc.length > 0 ? Math.round((completes / insc.length) * 100) : 0;
            const templeName = allTemples.find((t) => t.id === p.temple_id)?.nom_temple ?? "—";

            return (
              <Card key={p.id} className="p-5 border-0 shadow-elegant">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-semibold text-base truncate">{p.nom}</h3>
                      <Badge variant="secondary">{TYPE_LABEL[p.type_formation]}</Badge>
                      <Badge variant="outline">{p.trimestre}</Badge>
                      {isSuperAdmin && <Badge variant="outline">{templeName}</Badge>}
                      {!p.actif && <Badge variant="destructive">Inactif</Badge>}
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
                      {p.responsable && <span>👤 {p.responsable}</span>}
                      {p.date_debut && <span>📅 {p.date_debut}{p.date_fin ? ` → ${p.date_fin}` : ""}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedProg(p)}>
                      <UserPlus className="h-4 w-4 mr-1" /> Inscriptions ({insc.length})
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Supprimer "${p.nom}" ?`)) deleteProg.mutate(p.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Objectif participants</span>
                      <span className="font-semibold">{insc.length} / {objectif || "—"}</span>
                    </div>
                    <Progress value={tauxObj} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Taux de complétion</span>
                      <span className="font-semibold">{completes} / {insc.length} ({tauxComp}%)</span>
                    </div>
                    <Progress value={tauxComp} />
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="comparaison" className="mt-4">
            <ComparaisonTemples programmes={programmes} inscriptions={inscriptions} allTemples={allTemples} />
          </TabsContent>
        )}
      </Tabs>

      {selectedProg && (
        <InscriptionsDialog
          programme={selectedProg}
          inscriptions={inscByProg.get(selectedProg.id) ?? []}
          onClose={() => setSelectedProg(null)}
        />
      )}
    </div>
  );
}

function ProgrammeFormDialog({ onClose, year }: { onClose: () => void; year: number }) {
  const { activeTempleId } = useActiveTemple();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nom: "", description: "", type_formation: "discipulat" as FormationType,
    annee: year, trimestre: "annuel" as Trimestre, objectif_participants: 0,
    responsable: "", date_debut: "", date_fin: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!activeTempleId) throw new Error("Aucun temple actif");
      if (!form.nom.trim()) throw new Error("Le nom est requis");
      const { error } = await supabase.from("programmes_formation" as any).insert({
        temple_id: activeTempleId,
        nom: form.nom.trim(),
        description: form.description.trim() || null,
        type_formation: form.type_formation,
        annee: form.annee,
        trimestre: form.trimestre,
        objectif_participants: form.objectif_participants,
        responsable: form.responsable.trim() || null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programme créé");
      qc.invalidateQueries({ queryKey: ["formations"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nouveau programme de formation</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Nom du programme *</Label>
          <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Discipulat niveau 1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.type_formation} onValueChange={(v) => setForm({ ...form, type_formation: v as FormationType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as FormationType[]).map((k) => (
                  <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Trimestre</Label>
            <Select value={form.trimestre} onValueChange={(v) => setForm({ ...form, trimestre: v as Trimestre })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="T1">T1 (Jan-Mar)</SelectItem>
                <SelectItem value="T2">T2 (Avr-Juin)</SelectItem>
                <SelectItem value="T3">T3 (Juil-Sep)</SelectItem>
                <SelectItem value="T4">T4 (Oct-Déc)</SelectItem>
                <SelectItem value="annuel">Annuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Année</Label>
            <Input type="number" value={form.annee} onChange={(e) => setForm({ ...form, annee: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Objectif participants</Label>
            <Input type="number" min={0} value={form.objectif_participants} onChange={(e) => setForm({ ...form, objectif_participants: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <Label>Responsable</Label>
          <Input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date début</Label>
            <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
          </div>
          <div>
            <Label>Date fin</Label>
            <Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="gradient-brand text-primary-foreground border-0">
          Créer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function InscriptionsDialog({ programme, inscriptions, onClose }: { programme: Programme; inscriptions: Inscription[]; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [addMembreId, setAddMembreId] = useState<string>("");

  const membresQ = useQuery({
    queryKey: ["membres-pour-formation", programme.temple_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,nom,prenoms,categorie")
        .eq("temple_id", programme.temple_id)
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const membreMap = useMemo(() => {
    const m = new Map<string, { nom: string; prenoms: string }>();
    (membresQ.data ?? []).forEach((mb) => m.set(mb.id, { nom: mb.nom, prenoms: mb.prenoms }));
    return m;
  }, [membresQ.data]);

  const inscritsIds = new Set(inscriptions.map((i) => i.membre_id));
  const dispo = (membresQ.data ?? []).filter((m) => !inscritsIds.has(m.id));

  const addInsc = useMutation({
    mutationFn: async () => {
      if (!addMembreId) throw new Error("Sélectionnez un membre");
      const { error } = await supabase.from("inscriptions_formation" as any).insert({
        programme_id: programme.id, membre_id: addMembreId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membre inscrit");
      setAddMembreId("");
      qc.invalidateQueries({ queryKey: ["formations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatut = useMutation({
    mutationFn: async ({ id, statut, progression }: { id: string; statut: Statut; progression?: number }) => {
      const updates: Record<string, unknown> = { statut };
      if (progression !== undefined) updates.progression = progression;
      if (statut === "complete") {
        updates.progression = 100;
        updates.date_completion = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from("inscriptions_formation" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeInsc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inscriptions_formation" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscription supprimée");
      qc.invalidateQueries({ queryKey: ["formations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{programme.nom}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABEL[programme.type_formation]} · {programme.trimestre} {programme.annee}
          </p>
        </DialogHeader>

        {isAdmin && (
          <div className="flex gap-2 items-end pb-3 border-b">
            <div className="flex-1">
              <Label className="text-xs">Inscrire un membre</Label>
              <Select value={addMembreId} onValueChange={setAddMembreId}>
                <SelectTrigger><SelectValue placeholder={`${dispo.length} membre(s) disponible(s)`} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {dispo.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nom} {m.prenoms}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addInsc.mutate()} disabled={!addMembreId || addInsc.isPending}>
              <UserPlus className="h-4 w-4 mr-1" /> Inscrire
            </Button>
          </div>
        )}

        {inscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun inscrit pour le moment.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Progression</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {inscriptions.map((i) => {
                const mb = membreMap.get(i.membre_id);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      {mb ? `${mb.nom} ${mb.prenoms}` : <span className="text-muted-foreground">Membre inconnu</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUT_COLOR[i.statut]}>{STATUT_LABEL[i.statut]}</Badge>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <div className="flex items-center gap-2">
                        <Progress value={i.progression} className="flex-1" />
                        <span className="text-xs">{i.progression}%</span>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right space-x-1">
                        <Select value={i.statut} onValueChange={(v) => updateStatut.mutate({ id: i.id, statut: v as Statut })}>
                          <SelectTrigger className="w-[120px] h-8 text-xs inline-flex"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUT_LABEL) as Statut[]).map((s) => (
                              <SelectItem key={s} value={s}>{STATUT_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => {
                          if (confirm("Supprimer cette inscription ?")) removeInsc.mutate(i.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ComparaisonTemples({ programmes, inscriptions, allTemples }: {
  programmes: Programme[]; inscriptions: Inscription[]; allTemples: { id: string; nom_temple: string }[];
}) {
  const rows = allTemples.map((t) => {
    const progs = programmes.filter((p) => p.temple_id === t.id);
    const progIds = new Set(progs.map((p) => p.id));
    const insc = inscriptions.filter((i) => progIds.has(i.programme_id));
    const completes = insc.filter((i) => i.statut === "complete").length;
    const taux = insc.length > 0 ? Math.round((completes / insc.length) * 100) : 0;
    return {
      temple: t.nom_temple, programmes: progs.length,
      inscrits: insc.length, completes, taux,
    };
  });

  return (
    <Card className="p-5 border-0 shadow-elegant">
      <h3 className="font-semibold mb-3">Comparaison par temple</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Temple</TableHead>
            <TableHead className="text-center">Programmes</TableHead>
            <TableHead className="text-center">Inscrits</TableHead>
            <TableHead className="text-center">Complétés</TableHead>
            <TableHead>Taux de réussite</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.temple}>
              <TableCell className="font-medium">{r.temple}</TableCell>
              <TableCell className="text-center">{r.programmes}</TableCell>
              <TableCell className="text-center">{r.inscrits}</TableCell>
              <TableCell className="text-center">{r.completes}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={r.taux} className="flex-1" />
                  <span className="text-xs font-semibold w-10">{r.taux}%</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
