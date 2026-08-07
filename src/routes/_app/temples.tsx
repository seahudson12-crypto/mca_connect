import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_app/temples")({ component: TemplesPage });

type Temple = {
  id: string;
  nom_temple: string;
  ville: string | null;
  commune: string | null;
  pays: string | null;
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

  const resetAndOpen = (t: Temple | null) => {
    setEditing(t);
    setOpen(true);
  };

  const handleSave = async (form: FormData) => {
    const nom = String(form.get("nom_temple") || "").trim();
    if (!nom) return toast.error("Nom du temple requis");
    if (nom.length > 120) return toast.error("Nom trop long");

    const payload = {
      nom_temple: nom,
      ville: (form.get("ville") as string)?.trim() || null,
      commune: (form.get("commune") as string)?.trim() || null,
      pays: (form.get("pays") as string)?.trim() || "Côte d'Ivoire",
      pasteur_responsable: (form.get("pasteur") as string)?.trim() || null,
      pasteur_adjoint: (form.get("pasteur_adjoint") as string)?.trim() || null,
      telephone: (form.get("telephone") as string)?.trim() || null,
      email: (form.get("email") as string)?.trim() || null,
      couleur_primaire: (form.get("couleur") as string) || "#1e40af",
    };

    const { data, error } = editing
      ? await supabase.from("temples").update(payload).eq("id", editing.id).select("id")
      : await supabase.from("temples").insert(payload).select("id");

    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      return toast.error(
        "Aucune modification enregistrée : vous n'avez pas les droits nécessaires sur ce temple.",
      );
    }
    toast.success(editing ? "Temple modifié avec succès" : "Temple créé");
    setOpen(false);
    setEditing(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["temples"] }),
      qc.invalidateQueries({ queryKey: ["temples", "all"] }),
    ]);
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
            <Plus className="mr-2 h-4 w-4" /> Nouveau temple
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
            <DialogTitle>{editing ? "Modifier le temple" : "Nouveau temple"}</DialogTitle>
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
              <Label>Pays</Label>
              <Input
                name="pays"
                maxLength={80}
                defaultValue={editing?.pays ?? "Côte d'Ivoire"}
              />
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
