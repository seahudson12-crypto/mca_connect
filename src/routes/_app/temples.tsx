import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Pencil, Trash2, Mail, Phone, MapPin, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/temples")({
  validateSearch: (s: Record<string, unknown>): { ajout?: string } => (typeof s.ajout === "string" ? { ajout: s.ajout } : {}),
  head: () => pageHead("Temples MCA", "Temples MCA : espace MCA CONNECT, Mission de Christ en Action."), component: TemplesPage });

type Temple = {
  id: string;
  nom_temple: string;
  ville: string | null;
  commune: string | null;
  pays: string | null;
  pays_id: string | null;
  date_ouverture: string | null;
  pasteur_responsable: string | null;
  pasteur_adjoint: string | null;
  telephone: string | null;
  email: string | null;
  couleur_primaire: string | null;
  actif: boolean;
};

function TemplesPage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Temple | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Temple | null>(null);
  const [paysId, setPaysId] = useState("");
  const [actifForm, setActifForm] = useState(true);
  const [newPays, setNewPays] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<Record<string, unknown> | null>(null);
  const { ajout } = Route.useSearch();

  const { data: paysList = [] } = useQuery({
    queryKey: ["pays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pays").select("id,nom").order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: temples = [] } = useQuery({
    queryKey: ["temples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("temples")
        .select("*")
        .order("nom_temple");
      if (error) throw error;
      return data as Temple[];
    },
  });

  const resetAndOpen = (t: Temple | null, pays?: string) => {
    setEditing(t);
    setPaysId(t?.pays_id ?? pays ?? "");
    setActifForm(t?.actif ?? true);
    setNewPays(null);
    setOpen(true);
  };

  useEffect(() => {
    if (ajout && isSuperAdmin && paysList.some((p) => p.id === ajout)) {
      resetAndOpen(null, ajout);
      navigate({ to: "/temples", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajout, isSuperAdmin, paysList]);

  const addPays = async () => {
    const nom = (newPays ?? "").trim();
    if (nom.length < 2 || nom.length > 80) return toast.error("Nom de pays invalide");
    if (paysList.some((p) => p.nom.trim().toLocaleLowerCase("fr") === nom.toLocaleLowerCase("fr")))
      return toast.error("Ce pays existe déjà");
    const { data, error } = await supabase.from("pays").insert({ nom }).select("id").single();
    if (error) return toast.error(error.code === "23505" ? "Ce pays existe déjà" : error.message);
    await qc.invalidateQueries({ queryKey: ["pays"] });
    setPaysId(data.id);
    setNewPays(null);
    toast.success("Pays ajouté");
  };

  const persist = async (payload: Record<string, unknown>) => {
    const { data, error } = editing
      ? await supabase.from("temples").update(payload).eq("id", editing.id).select("id")
      : await supabase.from("temples").insert(payload as never).select("id");
    if (error) return toast.error(error.code === "23505" ? "Un temple portant ce nom existe déjà dans ce pays." : error.message);
    if (!data || data.length === 0) {
      return toast.error("Aucune modification enregistrée : vous n'avez pas les droits nécessaires sur ce temple.");
    }
    toast.success(editing ? "Temple modifié avec succès" : "Temple créé");
    setOpen(false);
    setEditing(null);
    setPendingSave(null);
    await qc.invalidateQueries({ queryKey: ["temples"] });
    await qc.invalidateQueries({ queryKey: ["pilotage"] });
  };

  const handleSave = async (form: FormData) => {
    const nom = String(form.get("nom_temple") || "").trim();
    if (!nom) return toast.error("Nom du temple requis");
    if (nom.length > 120) return toast.error("Nom trop long");
    if (!paysId) return toast.error("Le pays d'origine est obligatoire");
    const dup = temples.some(
      (t) => t.id !== editing?.id && t.pays_id === paysId && t.nom_temple.trim().toLocaleLowerCase("fr") === nom.toLocaleLowerCase("fr"),
    );
    if (dup) return toast.error("Un temple portant ce nom existe déjà dans ce pays.");
    const payload = {
      nom_temple: nom,
      pays_id: paysId,
      actif: actifForm,
      date_ouverture: (form.get("date_ouverture") as string) || null,
      ville: (form.get("ville") as string)?.trim() || null,
      commune: (form.get("commune") as string)?.trim() || null,
      pasteur_responsable: (form.get("pasteur") as string)?.trim() || null,
      pasteur_adjoint: (form.get("pasteur_adjoint") as string)?.trim() || null,
      telephone: (form.get("telephone") as string)?.trim() || null,
      email: (form.get("email") as string)?.trim() || null,
      couleur_primaire: (form.get("couleur") as string) || "#1e40af",
    };
    if (editing && editing.pays_id && editing.pays_id !== paysId) return setPendingSave(payload);
    await persist(payload);
  };

  const toggleActif = async (t: Temple) => {
    const { error } = await supabase
      .from("temples")
      .update({ actif: !t.actif })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(!t.actif ? "Temple activé" : "Temple désactivé");
    qc.invalidateQueries({ queryKey: ["temples"] });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("temples").delete().eq("id", confirmDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Temple supprimé");
    setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["temples"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Temples MCA</h1>
          <p className="text-sm text-muted-foreground">
            {temples.length} temple{temples.length > 1 ? "s" : ""} ·{" "}
            {temples.filter((t) => t.actif).length} actif
            {temples.filter((t) => t.actif).length > 1 ? "s" : ""}
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => resetAndOpen(null)}
            className="gradient-brand text-primary-foreground border-0"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter un temple
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {temples.map((t) => (
          <Card
            key={t.id}
            className={`p-5 border-0 shadow-elegant ${!t.actif ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div
                className="rounded-xl p-3 text-white shrink-0"
                style={{ background: t.couleur_primaire ?? "#1e40af" }}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold truncate">{t.nom_temple}</h3>
                  <Badge variant={t.actif ? "default" : "secondary"}>
                    {t.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {(t.commune || t.ville || t.pays) && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {[t.commune, t.ville, t.pays].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  )}
                  {t.pasteur_responsable && (
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.pasteur_responsable}</span>
                    </p>
                  )}
                  {t.pasteur_adjoint && (
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Adjoint : {t.pasteur_adjoint}</span>
                    </p>
                  )}
                  {t.telephone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.telephone}</span>
                    </p>
                  )}
                  {t.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.email}</span>
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={t.actif} onCheckedChange={() => toggleActif(t)} />
                      <span className="text-xs text-muted-foreground">Actif</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resetAndOpen(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(t)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {temples.length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground border-dashed">
            Aucun temple pour le moment.
          </Card>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le temple" : "Ajouter un temple"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(new FormData(e.currentTarget));
            }}
            className="space-y-3"
          >
            <div>
              <Label>Nom du temple *</Label>
              <Input
                name="nom_temple"
                required
                maxLength={120}
                defaultValue={editing?.nom_temple ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ville</Label>
                <Input name="ville" maxLength={80} defaultValue={editing?.ville ?? ""} />
              </div>
              <div>
                <Label>Commune</Label>
                <Input
                  name="commune"
                  maxLength={80}
                  defaultValue={editing?.commune ?? ""}
                />
              </div>
            </div>
            <div>
              <Label>Pays d'origine *</Label>
              <Select value={paysId} onValueChange={setPaysId}>
                <SelectTrigger aria-label="Pays d'origine"><SelectValue placeholder="Choisir un pays" /></SelectTrigger>
                <SelectContent>
                  {paysList.map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              {newPays === null ? (
                <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={() => setNewPays("")}>+ Ajouter un pays</Button>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input aria-label="Nouveau pays" placeholder="Nom du pays" maxLength={80} value={newPays} onChange={(e) => setNewPays(e.target.value)} />
                  <Button type="button" variant="outline" onClick={addPays}>Ajouter</Button>
                  <Button type="button" variant="ghost" onClick={() => setNewPays(null)}>Annuler</Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date d'ouverture</Label>
                <Input name="date_ouverture" type="date" defaultValue={editing?.date_ouverture ?? ""} />
              </div>
              <div>
                <Label>Statut</Label>
                <div className="flex h-10 items-center gap-2">
                  <Switch checked={actifForm} onCheckedChange={setActifForm} aria-label="Temple actif" />
                  <span className="text-sm">{actifForm ? "Actif" : "Inactif"}</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Pasteur responsable</Label>
              <Input
                name="pasteur"
                maxLength={120}
                defaultValue={editing?.pasteur_responsable ?? ""}
              />
            </div>
            <div>
              <Label>Pasteur adjoint</Label>
              <Input
                name="pasteur_adjoint"
                maxLength={120}
                defaultValue={editing?.pasteur_adjoint ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Téléphone</Label>
                <Input
                  name="telephone"
                  maxLength={30}
                  defaultValue={editing?.telephone ?? ""}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  maxLength={150}
                  defaultValue={editing?.email ?? ""}
                />
              </div>
            </div>
            <div>
              <Label>Couleur du temple</Label>
              <div className="flex items-center gap-3">
                <Input
                  name="couleur"
                  type="color"
                  defaultValue={editing?.couleur_primaire ?? "#1e40af"}
                  className="h-10 w-20 p-1"
                />
                <span className="text-xs text-muted-foreground">
                  Identifie visuellement le temple
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="gradient-brand text-primary-foreground border-0"
              >
                {editing ? "Enregistrer" : "Créer le temple"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Changer le pays de ce temple ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les statistiques par pays du Centre de Pilotage seront recalculées. Les membres, présences, finances,
              départements et historiques restent rattachés au temple et ne sont pas supprimés. Les matricules existants ne changent pas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingSave && persist(pendingSave)}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce temple ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le temple « {confirmDelete?.nom_temple} »
              sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
