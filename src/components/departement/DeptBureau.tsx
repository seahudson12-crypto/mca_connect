import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, UserMinus, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { type BureauMembre, type DeptMembre, type Departement, FONCTION_ORDRE, fullName, logDept } from "@/lib/departement";

type Fonction = { id: string; nom: string; ordre: number };

export function DeptBureau({ dept, canEdit }: { dept: Departement; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<{ open: boolean; row: BureauMembre | null }>({ open: false, row: null });
  const [toRemove, setToRemove] = useState<BureauMembre | null>(null);
  const [fonctionDialog, setFonctionDialog] = useState(false);

  const { data: bureau = [], isLoading } = useQuery({
    queryKey: ["dept-bureau", dept.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_bureau")
        .select("id,departement_id,membre_id,fonction,ordre,date_debut,membres(id,nom,prenoms,matricule,categorie,actif,telephone)")
        .eq("departement_id", dept.id);
      if (error) throw error;
      return ((data ?? []) as unknown as BureauMembre[]).sort(
        (a, b) => a.ordre - b.ordre || fullName(a.membres).localeCompare(fullName(b.membres)),
      );
    },
  });

  const { data: deptMembres = [] } = useQuery({
    queryKey: ["dept-membres", dept.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_membres")
        .select("id,departement_id,membre_id,date_ajout,membres(id,nom,prenoms,matricule,categorie,actif,telephone)")
        .eq("departement_id", dept.id);
      if (error) throw error;
      return (data ?? []) as unknown as DeptMembre[];
    },
  });

  const { data: fonctions = [] } = useQuery({
    queryKey: ["dept-fonctions", dept.temple_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_fonctions")
        .select("id,nom,ordre")
        .eq("temple_id", dept.temple_id)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as Fonction[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: { id?: string; membre_id: string; fonction: string }) => {
      const ordre = fonctions.find((x) => x.nom === f.fonction)?.ordre ?? FONCTION_ORDRE[f.fonction] ?? 99;
      const nom = fullName(deptMembres.find((m) => m.membre_id === f.membre_id)?.membres);
      if (f.id) {
        const before = bureau.find((b) => b.id === f.id);
        const { error } = await supabase.from("departement_bureau")
          .update({ membre_id: f.membre_id, fonction: f.fonction, ordre }).eq("id", f.id);
        if (error) throw error;
        await logDept({
          userId: user?.id, table: "departement_bureau", recordId: f.id, action: "update",
          before: { membre: fullName(before?.membres), fonction: before?.fonction },
          after: { membre: nom, fonction: f.fonction },
          description: `Bureau ${dept.nom} : ${nom} — fonction « ${f.fonction} »`,
          templeId: dept.temple_id,
        });
      } else {
        const { data, error } = await supabase.from("departement_bureau").insert({
          departement_id: dept.id, membre_id: f.membre_id, temple_id: dept.temple_id,
          fonction: f.fonction, ordre, created_by: user?.id ?? null,
        }).select("id").maybeSingle();
        if (error) throw error;
        await logDept({
          userId: user?.id, table: "departement_bureau", recordId: data?.id ?? null, action: "create",
          after: { membre: nom, fonction: f.fonction, departement: dept.nom },
          description: `Ajout de ${nom} au bureau de ${dept.nom} (${f.fonction})`,
          templeId: dept.temple_id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Bureau mis à jour");
      setDialog({ open: false, row: null });
      qc.invalidateQueries({ queryKey: ["dept-bureau", dept.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: BureauMembre) => {
      const { error } = await supabase.from("departement_bureau").delete().eq("id", row.id);
      if (error) throw error;
      await logDept({
        userId: user?.id, table: "departement_bureau", recordId: row.id, action: "delete",
        before: { membre: fullName(row.membres), fonction: row.fonction },
        description: `Retrait de ${fullName(row.membres)} du bureau de ${dept.nom}`,
        templeId: dept.temple_id,
      });
    },
    onSuccess: () => {
      toast.success("Retiré du bureau (reste membre du département)");
      setToRemove(null);
      qc.invalidateQueries({ queryKey: ["dept-bureau", dept.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFonction = useMutation({
    mutationFn: async (nom: string) => {
      const { error } = await supabase.from("departement_fonctions").insert({
        temple_id: dept.temple_id, nom, ordre: 90, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonction ajoutée");
      setFonctionDialog(false);
      qc.invalidateQueries({ queryKey: ["dept-fonctions", dept.temple_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Bureau du département « {dept.nom} » — {bureau.length} membre(s)
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFonctionDialog(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter une fonction
            </Button>
            <Button
              className="gradient-brand text-primary-foreground border-0"
              disabled={deptMembres.length === 0}
              onClick={() => setDialog({ open: true, row: null })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter au bureau
            </Button>
          </div>
        )}
      </div>

      {deptMembres.length === 0 && (
        <Card className="p-4 border-0 shadow-elegant text-sm text-muted-foreground">
          Ajoutez d'abord des membres au département : une personne doit être membre du département
          avant d'entrer au bureau.
        </Card>
      )}

      <Card className="p-0 border-0 shadow-elegant overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fonction</TableHead>
              <TableHead>Nom & prénoms</TableHead>
              <TableHead>Matricule</TableHead>
              {canEdit && <TableHead className="w-[140px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bureau.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 4 : 3} className="py-8 text-center text-muted-foreground">
                  {isLoading ? "Chargement..." : "Le bureau n'est pas encore constitué"}
                </TableCell>
              </TableRow>
            )}
            {bureau.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" /> {b.fonction}
                </TableCell>
                <TableCell>{fullName(b.membres)}</TableCell>
                <TableCell className="font-mono text-xs">{b.membres?.matricule ?? "—"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, row: b })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToRemove(b)}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <BureauDialog
        state={dialog}
        onClose={() => setDialog({ open: false, row: null })}
        membres={deptMembres}
        fonctions={fonctions}
        dejaBureau={bureau.map((b) => b.membre_id)}
        onSave={(f) => save.mutate(f)}
        saving={save.isPending}
      />

      <FonctionDialog open={fonctionDialog} onClose={() => setFonctionDialog(false)}
        onSave={(n) => addFonction.mutate(n)} saving={addFonction.isPending} />

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer du bureau ?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullName(toRemove?.membres)} ne fera plus partie du bureau, mais reste membre du
              département « {dept.nom} ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && remove.mutate(toRemove)}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BureauDialog({
  state, onClose, membres, fonctions, dejaBureau, onSave, saving,
}: {
  state: { open: boolean; row: BureauMembre | null };
  onClose: () => void;
  membres: DeptMembre[];
  fonctions: Fonction[];
  dejaBureau: string[];
  onSave: (f: { id?: string; membre_id: string; fonction: string }) => void;
  saving: boolean;
}) {
  const r = state.row;
  const [membreId, setMembreId] = useState("");
  const [fonction, setFonction] = useState("");

  const key = `${state.open}-${r?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setMembreId(r?.membre_id ?? "");
    setFonction(r?.fonction ?? "");
  }

  const options = useMemo(
    () => membres.filter((m) => m.membre_id === r?.membre_id || !dejaBureau.includes(m.membre_id)),
    [membres, dejaBureau, r],
  );

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>{r ? "Modifier le bureau" : "Ajouter au bureau"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Membre du département</Label>
            <Select value={membreId} onValueChange={setMembreId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une personne" /></SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m.membre_id} value={m.membre_id}>
                    {fullName(m.membres)}{m.membres?.matricule ? ` — ${m.membres.matricule}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fonction</Label>
            <Select value={fonction} onValueChange={setFonction}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une fonction" /></SelectTrigger>
              <SelectContent>
                {fonctions.map((f) => <SelectItem key={f.id} value={f.nom}>{f.nom}</SelectItem>)}
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="gradient-brand text-primary-foreground border-0"
            disabled={!membreId || !fonction || saving}
            onClick={() => onSave({ id: r?.id, membre_id: membreId, fonction })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FonctionDialog({
  open, onClose, onSave, saving,
}: { open: boolean; onClose: () => void; onSave: (nom: string) => void; saving: boolean }) {
  const [nom, setNom] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader><DialogTitle>Nouvelle fonction du bureau</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Nom de la fonction</Label>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Commissaire aux comptes..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="gradient-brand text-primary-foreground border-0"
            disabled={!nom.trim() || saving} onClick={() => onSave(nom.trim())}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
