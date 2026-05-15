import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardCheck, Trash2, Pencil, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { useState, useMemo } from "react";
import { CULTE_TYPES, culteTypeLabel } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { logChange, formatXof } from "@/lib/audit";

type CulteStatut = "brouillon" | "valide" | "corrige_admin";

type Culte = {
  id: string; date: string; type_culte: string; heure_debut: string | null; heure_fin: string | null;
  president: string | null; theme_presidence: string | null; versets: string | null;
  responsable_priere: string | null; orateur: string | null; theme_principal: string | null;
  statut: CulteStatut; validated_at: string | null; validated_by: string | null;
  created_by: string | null;
};

type Finance = {
  id: string; culte_id: string;
  offrande: number; dime: number; action_grace: number; semence: number;
  contribution_speciale: number; depense: number; solde: number; observation: string | null;
};

export const Route = createFileRoute("/_app/cultes")({ component: CultesPage });

const STATUT_BADGE: Record<CulteStatut, { label: string; cls: string; Icon: typeof Lock }> = {
  brouillon: { label: "Brouillon", cls: "bg-muted text-foreground", Icon: Pencil },
  valide: { label: "Validé", cls: "bg-success text-success-foreground", Icon: CheckCircle2 },
  corrige_admin: { label: "Corrigé par Admin", cls: "bg-gold text-gold-foreground", Icon: ShieldCheck },
};

function CultesPage() {
  const qc = useQueryClient();
  const { profile, user, isAdmin, isSuperAdmin } = useAuth();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Culte | null>(null);

  const { data: cultes = [], isLoading } = useQuery({
    queryKey: ["cultes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cultes").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Culte[];
    },
  });

  const { data: finances = [] } = useQuery({
    queryKey: ["finances-all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("finances_culte").select("*");
      if (error) throw error;
      return data as Finance[];
    },
  });

  const financeByCulte = useMemo(() => {
    const m = new Map<string, Finance>();
    finances.forEach((f) => m.set(f.culte_id, f));
    return m;
  }, [finances]);

  const canEdit = (c: Culte) => {
    if (isSuperAdmin) return true;
    return c.statut === "brouillon";
  };

  const handleCreate = async (form: FormData) => {
    if (!profile?.temple_id || !user) return toast.error("Profil incomplet");
    const payload = {
      date: form.get("date") as string,
      type_culte: form.get("type_culte") as never,
      heure_debut: (form.get("heure_debut") as string) || null,
      heure_fin: (form.get("heure_fin") as string) || null,
      president: (form.get("president") as string) || null,
      theme_presidence: (form.get("theme_presidence") as string) || null,
      versets: (form.get("versets") as string) || null,
      responsable_priere: (form.get("responsable_priere") as string) || null,
      orateur: (form.get("orateur") as string) || null,
      theme_principal: (form.get("theme_principal") as string) || null,
      temple_id: profile.temple_id,
      created_by: user.id,
      statut: "brouillon" as CulteStatut,
    };
    if (!payload.date || !payload.type_culte) return toast.error("Date et type requis");
    const { data, error } = await supabase.from("cultes").insert(payload).select().maybeSingle();
    if (error) return toast.error(error.message);
    if (data) await logChange({ userId: user.id, table: "cultes", recordId: data.id, action: "create", after: payload });
    toast.success("Culte créé");
    setOpenNew(false);
    qc.invalidateQueries({ queryKey: ["cultes"] });
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing || !user) return;
    const num = (k: string) => Number(String(form.get(k) || "0")) || 0;
    const before = { ...editing };
    const updates = {
      date: form.get("date") as string,
      type_culte: form.get("type_culte") as never,
      heure_debut: (form.get("heure_debut") as string) || null,
      heure_fin: (form.get("heure_fin") as string) || null,
      president: (form.get("president") as string) || null,
      theme_presidence: (form.get("theme_presidence") as string) || null,
      versets: (form.get("versets") as string) || null,
      responsable_priere: (form.get("responsable_priere") as string) || null,
      orateur: (form.get("orateur") as string) || null,
      theme_principal: (form.get("theme_principal") as string) || null,
      // Si super admin modifie un rapport déjà validé → marquer "corrige_admin"
      statut: (isSuperAdmin && (editing.statut === "valide" || editing.statut === "corrige_admin"))
        ? ("corrige_admin" as CulteStatut)
        : editing.statut,
    };
    const { error } = await supabase.from("cultes").update(updates).eq("id", editing.id);
    if (error) return toast.error(error.message);
    await logChange({
      userId: user.id, table: "cultes", recordId: editing.id, action: "update",
      before, after: { ...before, ...updates },
    });

    // Finances (admin only)
    if (isAdmin) {
      const offrande = num("offrande");
      const dime = num("dime");
      const action_grace = num("action_grace");
      const semence = num("semence");
      const contribution_speciale = num("contribution_speciale");
      const depense = num("depense");
      const solde = offrande + dime + action_grace + semence + contribution_speciale - depense;
      const observation = (form.get("observation") as string) || null;
      const existing = financeByCulte.get(editing.id);
      const finPayload = {
        culte_id: editing.id,
        offrande, dime, action_grace, semence, contribution_speciale, depense, solde, observation,
        created_by: user.id,
      };
      if (existing) {
        const { error: fe } = await supabase.from("finances_culte").update(finPayload).eq("id", existing.id);
        if (fe) toast.error(`Finances : ${fe.message}`);
        else await logChange({ userId: user.id, table: "finances_culte", recordId: existing.id, action: "update", before: existing as unknown as Record<string, unknown>, after: finPayload });
      } else {
        const { data: fd, error: fe } = await supabase.from("finances_culte").insert(finPayload).select().maybeSingle();
        if (fe) toast.error(`Finances : ${fe.message}`);
        else if (fd) await logChange({ userId: user.id, table: "finances_culte", recordId: fd.id, action: "create", after: finPayload });
      }
    }

    toast.success("Rapport mis à jour");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["cultes"] });
    qc.invalidateQueries({ queryKey: ["finances-all"] });
    qc.invalidateQueries({ queryKey: ["finances"] });
  };

  const handleValidate = async (c: Culte) => {
    if (!user) return;
    const { error } = await supabase.from("cultes")
      .update({ statut: "valide", validated_at: new Date().toISOString(), validated_by: user.id })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    await logChange({ userId: user.id, table: "cultes", recordId: c.id, action: "validate", before: { statut: c.statut }, after: { statut: "valide" } });
    toast.success("Rapport validé et verrouillé");
    qc.invalidateQueries({ queryKey: ["cultes"] });
  };

  const handleDelete = async (c: Culte) => {
    if (!user) return;
    const { error } = await supabase.from("cultes").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    await logChange({ userId: user.id, table: "cultes", recordId: c.id, action: "delete", before: c as unknown as Record<string, unknown> });
    toast.success("Culte supprimé");
    qc.invalidateQueries({ queryKey: ["cultes"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Cultes</h1>
          <p className="text-sm text-muted-foreground">{cultes.length} cultes programmés</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-primary-foreground border-0"><Plus className="mr-2 h-4 w-4" /> Nouveau culte</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau culte</DialogTitle></DialogHeader>
            <CulteForm
              onSubmit={handleCreate}
              isAdmin={false}
              defaults={null}
              finance={null}
              onCancel={() => setOpenNew(false)}
              submitLabel="Créer"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <div className="text-muted-foreground">Chargement...</div>}
        {!isLoading && cultes.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground border-dashed">
            Aucun culte. Créez le premier !
          </Card>
        )}
        {cultes.map((c) => {
          const s = STATUT_BADGE[c.statut];
          const fin = financeByCulte.get(c.id);
          return (
            <Card key={c.id} className="p-5 border-0 shadow-elegant hover:shadow-gold transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground">{culteTypeLabel(c.type_culte)}</Badge>
                    <Badge className={s.cls}><s.Icon className="mr-1 h-3 w-3" />{s.label}</Badge>
                  </div>
                  <h3 className="mt-2 font-semibold">{format(new Date(c.date), "EEEE d MMMM yyyy", { locale: fr })}</h3>
                  {(c.heure_debut || c.heure_fin) && (
                    <p className="text-xs text-muted-foreground">{c.heure_debut} {c.heure_fin && `– ${c.heure_fin}`}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {canEdit(c) && (
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)} title="Modifier le rapport">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {isSuperAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce culte ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera définitivement le culte, ses présences et ses données financières associées.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {c.orateur && <div><span className="text-muted-foreground">Orateur :</span> <span className="font-medium">{c.orateur}</span></div>}
                {c.theme_principal && <div className="text-muted-foreground line-clamp-2 italic">« {c.theme_principal} »</div>}
                {isAdmin && fin && (
                  <div className="mt-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                    <span className="text-muted-foreground">Solde : </span>
                    <span className="font-semibold">{formatXof(Number(fin.solde))}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/presences/$culteId" params={{ culteId: c.id }}>
                  <Button variant="outline" className="w-full"><ClipboardCheck className="mr-2 h-4 w-4" /> Pointer les présences</Button>
                </Link>
                {c.statut === "brouillon" && canEdit(c) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full gradient-brand text-primary-foreground border-0">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Valider et envoyer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Valider ce rapport ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Une fois validé, le rapport sera verrouillé. Seul un Super Administrateur pourra le modifier.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleValidate(c)}>Valider</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isSuperAdmin && c.statut !== "brouillon" && (
                  <Button variant="secondary" onClick={() => setEditing(c)}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Modifier le rapport
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isSuperAdmin && editing && editing.statut !== "brouillon" ? "Modifier le rapport (Super Admin)" : "Modifier le culte"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <CulteForm
              onSubmit={handleUpdate}
              isAdmin={isAdmin}
              defaults={editing}
              finance={financeByCulte.get(editing.id) ?? null}
              onCancel={() => setEditing(null)}
              submitLabel="Enregistrer"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CulteForm({
  onSubmit, isAdmin, defaults, finance, onCancel, submitLabel,
}: {
  onSubmit: (f: FormData) => void | Promise<void>;
  isAdmin: boolean;
  defaults: Culte | null;
  finance: Finance | null;
  onCancel: () => void;
  submitLabel: string;
}) {
  // Live total preview
  const [live, setLive] = useState({
    offrande: Number(finance?.offrande ?? 0),
    dime: Number(finance?.dime ?? 0),
    action_grace: Number(finance?.action_grace ?? 0),
    semence: Number(finance?.semence ?? 0),
    contribution_speciale: Number(finance?.contribution_speciale ?? 0),
    depense: Number(finance?.depense ?? 0),
  });
  const recettes = live.offrande + live.dime + live.action_grace + live.semence + live.contribution_speciale;
  const solde = recettes - live.depense;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Date *</Label><Input type="date" name="date" required defaultValue={defaults?.date ?? format(new Date(), "yyyy-MM-dd")} /></div>
        <div className="space-y-1.5">
          <Label>Type *</Label>
          <Select name="type_culte" defaultValue={defaults?.type_culte ?? "dimanche"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CULTE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Heure début</Label><Input type="time" name="heure_debut" defaultValue={defaults?.heure_debut ?? ""} /></div>
        <div className="space-y-1.5"><Label>Heure fin</Label><Input type="time" name="heure_fin" defaultValue={defaults?.heure_fin ?? ""} /></div>
      </div>
      <div className="space-y-1.5"><Label>Président du culte</Label><Input name="president" defaultValue={defaults?.president ?? ""} /></div>
      <div className="space-y-1.5"><Label>Thème de la présidence</Label><Input name="theme_presidence" defaultValue={defaults?.theme_presidence ?? ""} /></div>
      <div className="space-y-1.5"><Label>Versets</Label><Input name="versets" defaultValue={defaults?.versets ?? ""} placeholder="Ex: Psaumes 23:1-6" /></div>
      <div className="space-y-1.5"><Label>Responsable prière intense</Label><Input name="responsable_priere" defaultValue={defaults?.responsable_priere ?? ""} /></div>
      <div className="space-y-1.5"><Label>Orateur</Label><Input name="orateur" defaultValue={defaults?.orateur ?? ""} /></div>
      <div className="space-y-1.5"><Label>Thème principal</Label><Textarea name="theme_principal" rows={2} defaultValue={defaults?.theme_principal ?? ""} /></div>

      {isAdmin && defaults && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
          <div className="text-sm font-semibold text-primary">Finances du culte</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["offrande", "Offrandes"],
              ["dime", "Dîmes"],
              ["action_grace", "Actions de grâce"],
              ["semence", "Semences"],
              ["contribution_speciale", "Contributions spéciales"],
              ["depense", "Dépenses"],
            ] as const).map(([k, lbl]) => (
              <div key={k} className="space-y-1.5">
                <Label>{lbl} (FCFA)</Label>
                <Input
                  type="number" step="1" name={k} placeholder="0"
                  defaultValue={live[k]}
                  onChange={(e) => setLive((l) => ({ ...l, [k]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Observations financières</Label>
            <Textarea name="observation" rows={2} defaultValue={finance?.observation ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-sm">
            <div><div className="text-muted-foreground text-xs">Total recettes</div><div className="font-semibold text-success-foreground">{formatXof(recettes)}</div></div>
            <div><div className="text-muted-foreground text-xs">Total dépenses</div><div className="font-semibold text-destructive">{formatXof(live.depense)}</div></div>
            <div><div className="text-muted-foreground text-xs">Solde final</div><div className="font-bold text-primary">{formatXof(solde)}</div></div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="gradient-brand text-primary-foreground border-0">{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}
