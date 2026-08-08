import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Network, Plus, Pencil, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ACTIVITE_STATUTS, DEPARTEMENTS_SUGGERES, activiteStatutLabel } from "@/lib/constants";

export const Route = createFileRoute("/_app/departements")({
  component: DepartementsPage,
  head: () => ({
    meta: [
      { title: "Départements — MCA Connect" },
      { name: "description", content: "Suivi des départements et de leurs activités par temple." },
      { property: "og:title", content: "Départements — MCA Connect" },
      { property: "og:description", content: "Suivi des départements et de leurs activités par temple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Departement = { id: string; nom: string; description: string | null; actif: boolean; temple_id: string };
type ActiviteStatut = "a_faire" | "en_cours" | "realise" | "reporte" | "annule";
type Activite = {
  id: string;
  departement_id: string;
  temple_id: string;
  titre: string;
  description: string | null;
  responsable: string | null;
  date_prevue: string | null;
  date_realisation: string | null;
  statut: ActiviteStatut;
  avancement: number;
  rapport: string | null;
  observations: string | null;
};

const statutColor = (s: ActiviteStatut) =>
  s === "realise" ? "bg-primary text-primary-foreground"
  : s === "en_cours" ? "bg-accent text-accent-foreground"
  : s === "annule" ? "bg-destructive text-destructive-foreground"
  : undefined;

function DepartementsPage() {
  const qc = useQueryClient();
  const { isAdmin, isDepartementLead, departementIds, user } = useAuth();
  const { activeTempleId, activeTemple } = useActiveTemple();
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; dept: Departement | null }>({ open: false, dept: null });
  const [actDialog, setActDialog] = useState<{ open: boolean; act: Activite | null; deptId: string | null }>({ open: false, act: null, deptId: null });
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

  // Un responsable ne voit que son/ses départements
  const visibleDepts = useMemo(
    () => (isAdmin ? departements : departements.filter((d) => departementIds.includes(d.id))),
    [departements, isAdmin, departementIds],
  );

  const { data: activites = [] } = useQuery({
    queryKey: ["activites-dept", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activites_departement")
        .select("*")
        .eq("temple_id", activeTempleId!)
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
    mutationFn: async (form: Omit<Activite, "id" | "temple_id"> & { id?: string }) => {
      const payload = {
        departement_id: form.departement_id,
        temple_id: activeTempleId!,
        titre: form.titre,
        description: form.description || null,
        responsable: form.responsable || null,
        date_prevue: form.date_prevue || null,
        date_realisation: form.date_realisation || null,
        statut: form.statut,
        avancement: form.avancement,
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
    },
    onSuccess: () => {
      toast.success("Activité enregistrée");
      setActDialog({ open: false, act: null, deptId: null });
      qc.invalidateQueries({ queryKey: ["activites-dept"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            {isDepartementLead ? "Mon département" : "Départements"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTemple?.nom_temple ?? "Temple"} — suivi des activités et rapports par département
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

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {ACTIVITE_STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {visibleDepts.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground border-0 shadow-elegant">
          Aucun département {isAdmin ? "créé pour ce temple" : "ne vous est attribué"}.
        </Card>
      )}

      {visibleDepts.map((d) => {
        const acts = activites
          .filter((a) => a.departement_id === d.id)
          .filter((a) => statutFilter === "all" || a.statut === statutFilter);
        const moyenne = acts.length
          ? Math.round(acts.reduce((s, a) => s + Number(a.avancement), 0) / acts.length)
          : 0;
        return (
          <Card key={d.id} className="p-4 border-0 shadow-elegant space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{d.nom}</h2>
                  {!d.actif && <Badge variant="secondary">Inactif</Badge>}
                  <Badge variant="secondary">{acts.length} activité(s)</Badge>
                </div>
                {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                <div className="mt-2 max-w-xs">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Avancement moyen</span><span>{moyenne}%</span>
                  </div>
                  <Progress value={moyenne} />
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setDeptDialog({ open: true, dept: d })}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gradient-brand text-primary-foreground border-0"
                  onClick={() => setActDialog({ open: true, act: null, deptId: d.id })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Activité
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activité</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Date prévue</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Avancement</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Aucune activité enregistrée
                      </TableCell>
                    </TableRow>
                  )}
                  {acts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.titre}
                        {a.rapport && <div className="text-xs text-muted-foreground line-clamp-1">{a.rapport}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{a.responsable ?? "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {a.date_prevue ? format(new Date(a.date_prevue), "d MMM yyyy", { locale: fr }) : "—"}
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
                        <Button variant="ghost" size="sm" onClick={() => setActDialog({ open: true, act: a, deptId: d.id })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}

      <DeptDialog
        state={deptDialog}
        onClose={() => setDeptDialog({ open: false, dept: null })}
        onSave={(f) => saveDept.mutate(f)}
        saving={saveDept.isPending}
      />
      <ActiviteDialog
        state={actDialog}
        departements={visibleDepts}
        onClose={() => setActDialog({ open: false, act: null, deptId: null })}
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

  // Réinitialiser à l'ouverture
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

function ActiviteDialog({
  state, departements, onClose, onSave, saving,
}: {
  state: { open: boolean; act: Activite | null; deptId: string | null };
  departements: Departement[];
  onClose: () => void;
  onSave: (f: Omit<Activite, "id" | "temple_id"> & { id?: string }) => void;
  saving: boolean;
}) {
  const a = state.act;
  const blank = {
    departement_id: state.deptId ?? departements[0]?.id ?? "",
    titre: "",
    description: "",
    responsable: "",
    date_prevue: "",
    date_realisation: "",
    statut: "a_faire" as ActiviteStatut,
    avancement: 0,
    rapport: "",
    observations: "",
  };
  const [form, setForm] = useState(blank);

  const key = `${state.open}-${a?.id ?? state.deptId ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      a
        ? {
            departement_id: a.departement_id,
            titre: a.titre,
            description: a.description ?? "",
            responsable: a.responsable ?? "",
            date_prevue: a.date_prevue ?? "",
            date_realisation: a.date_realisation ?? "",
            statut: a.statut,
            avancement: Number(a.avancement),
            rapport: a.rapport ?? "",
            observations: a.observations ?? "",
          }
        : blank,
    );
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

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
            <Label>Département</Label>
            <Select value={form.departement_id} onValueChange={(v) => set("departement_id", v)}>
              <SelectTrigger><SelectValue placeholder="Département" /></SelectTrigger>
              <SelectContent>
                {departements.map((d) => <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Titre de l'activité</Label>
            <Input value={form.titre} onChange={(e) => set("titre", e.target.value)} />
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
              <Label>Date de réalisation</Label>
              <Input type="date" value={form.date_realisation} onChange={(e) => set("date_realisation", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Avancement : {form.avancement}%</Label>
            <input
              type="range" min={0} max={100} step={5}
              value={form.avancement}
              onChange={(e) => set("avancement", Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Rapport d'activité</Label>
            <Textarea value={form.rapport} onChange={(e) => set("rapport", e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Observations</Label>
            <Textarea value={form.observations} onChange={(e) => set("observations", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="gradient-brand text-primary-foreground border-0"
            disabled={!form.titre.trim() || !form.departement_id || saving}
            onClick={() => onSave({ ...form, id: a?.id })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
