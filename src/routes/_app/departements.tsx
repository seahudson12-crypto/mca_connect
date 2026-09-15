import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Network, Plus, Pencil, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ACTIVITE_STATUTS, DEPARTEMENTS_SUGGERES, activiteStatutLabel } from "@/lib/constants";
import { type Activite, type ActiviteStatut, type Departement, enRetard, logDept } from "@/lib/departement";
import { DeptDashboard } from "@/components/departement/DeptDashboard";
import { DeptMembres } from "@/components/departement/DeptMembres";
import { DeptBureau } from "@/components/departement/DeptBureau";
import { DeptRapport } from "@/components/departement/DeptRapport";
import { DeptVueGlobale } from "@/components/departement/DeptVueGlobale";

export const Route = createFileRoute("/_app/departements")({
  component: DepartementsPage,
  head: () => ({
    meta: [
      { title: "Départements — MCA Connect" },
      { name: "description", content: "Espace de gestion des départements : membres, bureau, activités et rapports." },
      { property: "og:title", content: "Départements — MCA Connect" },
      { property: "og:description", content: "Espace de gestion des départements : membres, bureau, activités et rapports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const statutColor = (s: ActiviteStatut) =>
  s === "realise" ? "bg-primary text-primary-foreground"
  : s === "en_cours" ? "bg-accent text-accent-foreground"
  : s === "annule" ? "bg-destructive text-destructive-foreground"
  : undefined;

function DepartementsPage() {
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin, isDepartementLead, departementIds, user } = useAuth();
  const { activeTempleId, activeTemple } = useActiveTemple();
  const [selectedId, setSelectedId] = useState<string>("");
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; dept: Departement | null }>({ open: false, dept: null });
  const [actDialog, setActDialog] = useState<{ open: boolean; act: Activite | null }>({ open: false, act: null });
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const { data: departements = [] } = useQuery({
    queryKey: ["departements", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departements")
        .select("id,nom,description,actif,temple_id")
        .eq("temple_id", activeTempleId!)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as Departement[];
    },
  });

  // Un responsable ne voit que ses départements validés
  const visibleDepts = useMemo(
    () => (isAdmin ? departements : departements.filter((d) => departementIds.includes(d.id))),
    [departements, isAdmin, departementIds],
  );

  useEffect(() => {
    if (visibleDepts.length === 0) { setSelectedId(""); return; }
    if (!visibleDepts.some((d) => d.id === selectedId)) setSelectedId(visibleDepts[0].id);
  }, [visibleDepts, selectedId]);

  const dept = visibleDepts.find((d) => d.id === selectedId) ?? null;

  const { data: activites = [] } = useQuery({
    queryKey: ["activites-dept", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activites_departement")
        .select("*")
        .eq("departement_id", selectedId)
        .order("date_prevue", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Activite[];
    },
  });

  const saveDept = useMutation({
    mutationFn: async (form: { id?: string; nom: string; description: string; actif: boolean }) => {
      if (form.id) {
        const { error } = await supabase
          .from("departements")
          .update({ nom: form.nom, description: form.description || null, actif: form.actif })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departements").insert({
          nom: form.nom,
          description: form.description || null,
          actif: form.actif,
          temple_id: activeTempleId!,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Département enregistré");
      setDeptDialog({ open: false, dept: null });
      qc.invalidateQueries({ queryKey: ["departements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveActivite = useMutation({
    mutationFn: async (form: ActiviteForm & { id?: string }) => {
      const payload = {
        departement_id: selectedId,
        temple_id: activeTempleId!,
        titre: form.titre,
        description: form.description || null,
        objectif: form.objectif || null,
        responsable: form.responsable || null,
        date_prevue: form.date_prevue || null,
        date_realisation: form.date_realisation || null,
        statut: form.statut,
        avancement: form.avancement,
        nb_participants: form.nb_participants === "" ? null : Number(form.nb_participants),
        resultats: form.resultats || null,
        difficultes: form.difficultes || null,
        actions_a_entreprendre: form.actions_a_entreprendre || null,
        rapport: form.rapport || null,
        observations: form.observations || null,
      };
      if (form.id) {
        const { error } = await supabase.from("activites_departement").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("activites_departement")
          .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
      await logDept({
        userId: user?.id,
        table: "activites_departement",
        recordId: form.id ?? null,
        action: form.id ? "update" : "create",
        after: { titre: form.titre, statut: form.statut, avancement: form.avancement },
        description: `${form.id ? "Modification" : "Création"} de l'activité « ${form.titre} » (${dept?.nom ?? ""})`,
        templeId: activeTempleId,
      });
    },
    onSuccess: () => {
      toast.success("Activité enregistrée");
      setActDialog({ open: false, act: null });
      qc.invalidateQueries({ queryKey: ["activites-dept"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acts = activites.filter((a) => statutFilter === "all" || a.statut === statutFilter);
  const canEditDept = isAdmin || (isDepartementLead && !!dept && departementIds.includes(dept.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            {isDepartementLead ? "Mes départements" : "Départements"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTemple?.nom_temple ?? "Temple"} — membres, bureau, activités et rapports
          </p>
        </div>
        {isAdmin && (
          <Button
            className="gradient-brand text-primary-foreground border-0"
            onClick={() => setDeptDialog({ open: true, dept: null })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nouveau département
          </Button>
        )}
      </div>

      {isSuperAdmin && <DeptVueGlobale />}

      {visibleDepts.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground border-0 shadow-elegant">
          Aucun département {isAdmin ? "créé pour ce temple" : "ne vous est attribué"}.
        </Card>
      ) : (
        <>
          <Card className="p-4 border-0 shadow-elegant">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[240px]">
                <Label>Département à gérer</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {visibleDepts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nom}{!d.actif ? " (inactif)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && dept && (
                <Button variant="outline" onClick={() => setDeptDialog({ open: true, dept })}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Modifier le département
                </Button>
              )}
            </div>
            {dept?.description && <p className="mt-3 text-sm text-muted-foreground">{dept.description}</p>}
          </Card>

          {dept && (
            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
                <TabsTrigger value="activites">Activités</TabsTrigger>
                <TabsTrigger value="membres">Membres</TabsTrigger>
                <TabsTrigger value="bureau">Bureau</TabsTrigger>
                <TabsTrigger value="rapports">Rapports</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <DeptDashboard dept={dept} activites={activites} />
              </TabsContent>

              <TabsContent value="activites" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Select value={statutFilter} onValueChange={setStatutFilter}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      {ACTIVITE_STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {canEditDept && (
                    <Button
                      className="gradient-brand text-primary-foreground border-0"
                      onClick={() => setActDialog({ open: true, act: null })}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Nouvelle activité
                    </Button>
                  )}
                </div>

                <Card className="p-0 border-0 shadow-elegant overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activité</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Date prévue</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Avancement</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Aucune activité enregistrée
                          </TableCell>
                        </TableRow>
                      )}
                      {acts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {a.titre}
                            {a.objectif && <div className="text-xs text-muted-foreground line-clamp-1">{a.objectif}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{a.responsable ?? "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {a.date_prevue ? format(new Date(a.date_prevue), "d MMM yyyy", { locale: fr }) : "—"}
                            {enRetard(a) && <Badge variant="outline" className="ml-2 text-warning">En retard</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge className={statutColor(a.statut)} variant={statutColor(a.statut) ? undefined : "secondary"}>
                              {activiteStatutLabel(a.statut)}
                            </Badge>
                          </TableCell>
                          <TableCell className="w-[140px]">
                            <div className="flex items-center gap-2">
                              <Progress value={Number(a.avancement)} className="h-2" />
                              <span className="text-xs text-muted-foreground">{a.avancement}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setActDialog({ open: true, act: a })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="membres">
                <DeptMembres dept={dept} canEdit={canEditDept} />
              </TabsContent>

              <TabsContent value="bureau">
                <DeptBureau dept={dept} canEdit={canEditDept} />
              </TabsContent>

              <TabsContent value="rapports">
                <DeptRapport dept={dept} activites={activites} templeNom={activeTemple?.nom_temple ?? ""} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      <DeptDialog
        state={deptDialog}
        onClose={() => setDeptDialog({ open: false, dept: null })}
        onSave={(f) => saveDept.mutate(f)}
        saving={saveDept.isPending}
      />
      <ActiviteDialog
        state={actDialog}
        onClose={() => setActDialog({ open: false, act: null })}
        onSave={(f) => saveActivite.mutate(f)}
        saving={saveActivite.isPending}
      />
    </div>
  );
}

function DeptDialog({
  state, onClose, onSave, saving,
}: {
  state: { open: boolean; dept: Departement | null };
  onClose: () => void;
  onSave: (f: { id?: string; nom: string; description: string; actif: boolean }) => void;
  saving: boolean;
}) {
  const d = state.dept;
  const [nom, setNom] = useState(d?.nom ?? "");
  const [description, setDescription] = useState(d?.description ?? "");
  const [actif, setActif] = useState(d?.actif ?? true);

  const key = `${state.open}-${d?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setNom(d?.nom ?? "");
    setDescription(d?.description ?? "");
    setActif(d?.actif ?? true);
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>{d ? "Modifier le département" : "Nouveau département"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom du département</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Jeunesse, Louange..." />
            {!d && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DEPARTEMENTS_SUGGERES.map((s) => (
                  <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setNom(s)}>{s}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <input id="dept-actif" type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            <Label htmlFor="dept-actif">Département actif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="gradient-brand text-primary-foreground border-0"
            disabled={!nom.trim() || saving}
            onClick={() => onSave({ id: d?.id, nom: nom.trim(), description, actif })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ActiviteForm = {
  titre: string;
  description: string;
  objectif: string;
  responsable: string;
  date_prevue: string;
  date_realisation: string;
  statut: ActiviteStatut;
  avancement: number;
  nb_participants: string;
  resultats: string;
  difficultes: string;
  actions_a_entreprendre: string;
  rapport: string;
  observations: string;
};

const blankForm: ActiviteForm = {
  titre: "", description: "", objectif: "", responsable: "", date_prevue: "", date_realisation: "",
  statut: "a_faire", avancement: 0, nb_participants: "", resultats: "", difficultes: "",
  actions_a_entreprendre: "", rapport: "", observations: "",
};

function ActiviteDialog({
  state, onClose, onSave, saving,
}: {
  state: { open: boolean; act: Activite | null };
  onClose: () => void;
  onSave: (f: ActiviteForm & { id?: string }) => void;
  saving: boolean;
}) {
  const a = state.act;
  const [form, setForm] = useState<ActiviteForm>(blankForm);

  const key = `${state.open}-${a?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      a
        ? {
            titre: a.titre,
            description: a.description ?? "",
            objectif: a.objectif ?? "",
            responsable: a.responsable ?? "",
            date_prevue: a.date_prevue ?? "",
            date_realisation: a.date_realisation ?? "",
            statut: a.statut,
            avancement: Number(a.avancement),
            nb_participants: a.nb_participants == null ? "" : String(a.nb_participants),
            resultats: a.resultats ?? "",
            difficultes: a.difficultes ?? "",
            actions_a_entreprendre: a.actions_a_entreprendre ?? "",
            rapport: a.rapport ?? "",
            observations: a.observations ?? "",
          }
        : blankForm,
    );
  }

  const set = <K extends keyof ActiviteForm>(k: K, v: ActiviteForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {a ? "Modifier l'activité" : "Nouvelle activité"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Titre de l'activité</Label>
            <Input value={form.titre} onChange={(e) => set("titre", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Objectif</Label>
            <Textarea value={form.objectif} onChange={(e) => set("objectif", e.target.value)} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Input value={form.responsable} onChange={(e) => set("responsable", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => set("statut", v as ActiviteStatut)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITE_STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date prévue</Label>
              <Input type="date" value={form.date_prevue} onChange={(e) => set("date_prevue", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date réelle de réalisation</Label>
              <Input type="date" value={form.date_realisation} onChange={(e) => set("date_realisation", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Niveau d'avancement</Label>
            <Select value={String(form.avancement)} onValueChange={(v) => set("avancement", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 25, 50, 75, 100].map((v) => <SelectItem key={v} value={String(v)}>{v} %</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="text-sm font-semibold">Rapport d'activité</div>
            <div className="space-y-1.5">
              <Label>Nombre de participants</Label>
              <Input type="number" min={0} value={form.nb_participants}
                onChange={(e) => set("nb_participants", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Résultats obtenus</Label>
              <Textarea value={form.resultats} onChange={(e) => set("resultats", e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Difficultés rencontrées</Label>
              <Textarea value={form.difficultes} onChange={(e) => set("difficultes", e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Actions à entreprendre</Label>
              <Textarea value={form.actions_a_entreprendre}
                onChange={(e) => set("actions_a_entreprendre", e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Rapport / compte rendu</Label>
              <Textarea value={form.rapport} onChange={(e) => set("rapport", e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Observations</Label>
              <Textarea value={form.observations} onChange={(e) => set("observations", e.target.value)} rows={2} />
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="gradient-brand text-primary-foreground border-0"
            disabled={!form.titre.trim() || saving}
            onClick={() => onSave({ ...form, id: a?.id })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
