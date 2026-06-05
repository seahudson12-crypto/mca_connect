import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users2, Plus, Pencil, Trash2, Home, Phone, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";

export const Route = createFileRoute("/_app/familles")({ component: FamillesPage });

type RoleFamille = "chef" | "conjoint" | "enfant" | "autre";

interface Famille {
  id: string;
  temple_id: string;
  nom_famille: string;
  adresse: string | null;
  telephone_principal: string | null;
  telephone_secondaire: string | null;
  notes: string | null;
}

interface MembreLite {
  id: string;
  nom: string;
  prenoms: string;
  categorie: string;
  telephone: string | null;
  famille_id: string | null;
  role_famille: RoleFamille | null;
}

const ROLE_LABEL: Record<RoleFamille, string> = {
  chef: "Chef de famille",
  conjoint: "Conjoint(e)",
  enfant: "Enfant",
  autre: "Autre",
};

const ROLE_BADGE: Record<RoleFamille, string> = {
  chef: "bg-primary text-primary-foreground",
  conjoint: "bg-accent text-accent-foreground",
  enfant: "bg-gold text-foreground",
  autre: "bg-muted text-muted-foreground",
};

function FamillesPage() {
  const { isAdmin } = useAuth();
  const { activeTempleId } = useActiveTemple();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Famille | null>(null);
  const [membreDialogOpen, setMembreDialogOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: familles = [] } = useQuery({
    queryKey: ["familles", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familles" as never)
        .select("*")
        .eq("temple_id", activeTempleId!)
        .order("nom_famille");
      if (error) throw error;
      return (data ?? []) as unknown as Famille[];
    },
  });

  const { data: membres = [] } = useQuery({
    queryKey: ["membres-familles", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,nom,prenoms,categorie,telephone,famille_id,role_famille")
        .eq("temple_id", activeTempleId!)
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as unknown as MembreLite[];
    },
  });

  const famillesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return familles;
    return familles.filter((f) => f.nom_famille.toLowerCase().includes(q));
  }, [familles, search]);

  const membresByFamille = useMemo(() => {
    const m = new Map<string, MembreLite[]>();
    for (const x of membres) {
      if (!x.famille_id) continue;
      const arr = m.get(x.famille_id) ?? [];
      arr.push(x);
      m.set(x.famille_id, arr);
    }
    return m;
  }, [membres]);

  const membresSansFamille = useMemo(
    () => membres.filter((m) => !m.famille_id),
    [membres],
  );

  const saveFamille = useMutation({
    mutationFn: async (input: Partial<Famille>) => {
      if (!activeTempleId) throw new Error("Aucun temple actif");
      if (editing) {
        const { error } = await supabase
          .from("familles" as never)
          .update(input as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("familles" as never)
          .insert({ ...input, temple_id: activeTempleId } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familles"] });
      toast.success(editing ? "Famille mise à jour" : "Famille créée");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFamille = useMutation({
    mutationFn: async (id: string) => {
      // Détacher tous les membres puis supprimer
      await supabase
        .from("membres")
        .update({ famille_id: null, role_famille: null } as never)
        .eq("famille_id", id);
      const { error } = await supabase.from("familles" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familles"] });
      qc.invalidateQueries({ queryKey: ["membres-familles"] });
      toast.success("Famille supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attachMembre = useMutation({
    mutationFn: async (args: { membreId: string; familleId: string; role: RoleFamille }) => {
      const { error } = await supabase
        .from("membres")
        .update({ famille_id: args.familleId, role_famille: args.role } as never)
        .eq("id", args.membreId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membres-familles"] });
      toast.success("Membre rattaché");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detachMembre = useMutation({
    mutationFn: async (membreId: string) => {
      const { error } = await supabase
        .from("membres")
        .update({ famille_id: null, role_famille: null } as never)
        .eq("id", membreId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membres-familles"] });
      toast.success("Membre détaché");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users2 className="h-6 w-6 text-primary" /> Familles
          </h1>
          <p className="text-sm text-muted-foreground">
            Regroupez les membres de l'église par famille pour un meilleur suivi pastoral.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvelle famille
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Rechercher une famille…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="text-sm text-muted-foreground">
            {familles.length} famille{familles.length > 1 ? "s" : ""} • {membres.filter((m) => m.famille_id).length}/{membres.length} membres rattachés
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {famillesFiltered.map((f) => {
          const ms = membresByFamille.get(f.id) ?? [];
          const chef = ms.find((m) => m.role_famille === "chef");
          return (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-foreground">Famille {f.nom_famille}</div>
                  {chef && (
                    <div className="text-sm text-muted-foreground">
                      Chef : {chef.prenoms} {chef.nom}
                    </div>
                  )}
                  {f.adresse && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Home className="h-3 w-3" /> {f.adresse}
                    </div>
                  )}
                  {f.telephone_principal && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {f.telephone_principal}
                      {f.telephone_secondaire ? ` / ${f.telephone_secondaire}` : ""}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(f);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Supprimer la famille "${f.nom_famille}" ?`)) {
                          deleteFamille.mutate(f.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    Membres ({ms.length})
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMembreDialogOpen(f.id)}
                    >
                      <UserPlus className="mr-1 h-3 w-3" /> Rattacher
                    </Button>
                  )}
                </div>
                {ms.length === 0 ? (
                  <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Aucun membre rattaché
                  </div>
                ) : (
                  <div className="space-y-1">
                    {ms.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded bg-muted/40 px-2 py-1.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className={ROLE_BADGE[m.role_famille ?? "autre"]}>
                            {ROLE_LABEL[m.role_famille ?? "autre"]}
                          </Badge>
                          <span className="truncate">
                            {m.prenoms} {m.nom}
                          </span>
                        </div>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => detachMembre.mutate(m.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {famillesFiltered.length === 0 && (
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            Aucune famille. {isAdmin && "Cliquez sur « Nouvelle famille » pour commencer."}
          </Card>
        )}
      </div>

      {/* Dialog création/édition famille */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la famille" : "Nouvelle famille"}
            </DialogTitle>
            <DialogDescription>
              Renseignez les informations de la famille.
            </DialogDescription>
          </DialogHeader>
          <FamilleForm
            initial={editing}
            onSubmit={(values) => saveFamille.mutate(values)}
            submitting={saveFamille.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog rattachement membre */}
      <Dialog
        open={!!membreDialogOpen}
        onOpenChange={(o) => !o && setMembreDialogOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rattacher un membre</DialogTitle>
            <DialogDescription>
              Sélectionnez un membre et son rôle dans la famille.
            </DialogDescription>
          </DialogHeader>
          {membreDialogOpen && (
            <AttachMembreForm
              candidats={membresSansFamille}
              onSubmit={(membreId, role) => {
                attachMembre.mutate(
                  { membreId, familleId: membreDialogOpen, role },
                  { onSuccess: () => setMembreDialogOpen(null) },
                );
              }}
              submitting={attachMembre.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FamilleForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial: Famille | null;
  onSubmit: (v: Partial<Famille>) => void;
  submitting: boolean;
}) {
  const [nom, setNom] = useState(initial?.nom_famille ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [tel1, setTel1] = useState(initial?.telephone_principal ?? "");
  const [tel2, setTel2] = useState(initial?.telephone_secondaire ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        onSubmit({
          nom_famille: nom.trim(),
          adresse: adresse.trim() || null,
          telephone_principal: tel1.trim() || null,
          telephone_secondaire: tel2.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <div>
        <Label>Nom de famille *</Label>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
      </div>
      <div>
        <Label>Adresse</Label>
        <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Téléphone principal</Label>
          <Input value={tel1} onChange={(e) => setTel1(e.target.value)} />
        </div>
        <div>
          <Label>Téléphone secondaire</Label>
          <Input value={tel2} onChange={(e) => setTel2(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Notes pastorales</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AttachMembreForm({
  candidats,
  onSubmit,
  submitting,
}: {
  candidats: MembreLite[];
  onSubmit: (membreId: string, role: RoleFamille) => void;
  submitting: boolean;
}) {
  const [membreId, setMembreId] = useState("");
  const [role, setRole] = useState<RoleFamille>("autre");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!membreId) return;
        onSubmit(membreId, role);
      }}
    >
      <div>
        <Label>Membre</Label>
        <Select value={membreId} onValueChange={setMembreId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un membre…" />
          </SelectTrigger>
          <SelectContent>
            {candidats.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">
                Tous les membres sont déjà rattachés à une famille.
              </div>
            ) : (
              candidats.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.prenoms} {m.nom}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Rôle dans la famille</Label>
        <Select value={role} onValueChange={(v) => setRole(v as RoleFamille)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as RoleFamille[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting || !membreId}>
          {submitting ? "…" : "Rattacher"}
        </Button>
      </DialogFooter>
    </form>
  );
}
