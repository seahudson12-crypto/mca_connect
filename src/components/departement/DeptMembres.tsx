import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CATEGORIES, categoryLabel } from "@/lib/constants";
import { type Departement, type DeptMembre, type MembreLight, fullName, logDept } from "@/lib/departement";

export function DeptMembres({ dept, canEdit }: { dept: Departement; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<DeptMembre | null>(null);

  const { data: membres = [], isLoading } = useQuery({
    queryKey: ["dept-membres", dept.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_membres")
        .select("id,departement_id,membre_id,date_ajout,membres(id,nom,prenoms,matricule,categorie,actif,telephone)")
        .eq("departement_id", dept.id);
      if (error) throw error;
      return ((data ?? []) as unknown as DeptMembre[]).sort((a, b) =>
        fullName(a.membres).localeCompare(fullName(b.membres)),
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (row: DeptMembre) => {
      const { error } = await supabase.from("departement_membres").delete().eq("id", row.id);
      if (error) throw error;
      await supabase.from("departement_bureau").delete()
        .eq("departement_id", dept.id).eq("membre_id", row.membre_id);
      await logDept({
        userId: user?.id, table: "departement_membres", recordId: row.id, action: "delete",
        before: { departement: dept.nom, membre: fullName(row.membres) },
        description: `Retrait de ${fullName(row.membres)} du département ${dept.nom}`,
        templeId: dept.temple_id,
      });
    },
    onSuccess: () => {
      toast.success("Membre retiré du département (sa fiche reste intacte)");
      setToRemove(null);
      qc.invalidateQueries({ queryKey: ["dept-membres", dept.id] });
      qc.invalidateQueries({ queryKey: ["dept-bureau", dept.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return membres;
    return membres.filter((m) =>
      [m.membres?.nom, m.membres?.prenoms, m.membres?.matricule, categoryLabel(m.membres?.categorie ?? "")]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [membres, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher (matricule, nom, prénoms, catégorie)"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canEdit && (
          <Button className="gradient-brand text-primary-foreground border-0" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Ajouter un membre
          </Button>
        )}
      </div>

      <Card className="p-0 border-0 shadow-elegant overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom & prénoms</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Ajouté le</TableHead>
              {canEdit && <TableHead className="w-[120px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-8 text-center text-muted-foreground">
                  {isLoading ? "Chargement..." : "Aucun membre dans ce département"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.membres?.matricule ?? "—"}</TableCell>
                <TableCell className="font-medium">{fullName(m.membres)}</TableCell>
                <TableCell className="text-sm">{categoryLabel(m.membres?.categorie ?? "")}</TableCell>
                <TableCell>
                  <Badge variant={m.membres?.actif ? "secondary" : "outline"}>
                    {m.membres?.actif ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {format(new Date(m.date_ajout), "d MMM yyyy", { locale: fr })}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToRemove(m)}>
                      <UserMinus className="mr-1.5 h-3.5 w-3.5" /> Retirer
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Users className="h-4 w-4" /> {membres.length} membre(s) dans « {dept.nom} »
      </div>

      <AddMembreDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        dept={dept}
        dejaMembres={membres.map((m) => m.membre_id)}
      />

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer du département ?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullName(toRemove?.membres)} ne fera plus partie du département « {dept.nom} ».
              Sa fiche membre et son matricule sont conservés dans MCA Connect.
              S'il est au bureau, il en sera également retiré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toRemove && remove.mutate(toRemove)}
            >
              Confirmer le retrait
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddMembreDialog({
  open, onClose, dept, dejaMembres,
}: { open: boolean; onClose: () => void; dept: Departement; dejaMembres: string[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const { data: pool = [] } = useQuery({
    queryKey: ["temple-membres-pool", dept.temple_id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,nom,prenoms,matricule,categorie,actif,telephone")
        .eq("temple_id", dept.temple_id)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as MembreLight[];
    },
  });

  const add = useMutation({
    mutationFn: async (m: MembreLight) => {
      const { data, error } = await supabase.from("departement_membres").insert({
        departement_id: dept.id,
        membre_id: m.id,
        temple_id: dept.temple_id,
        created_by: user?.id ?? null,
      }).select("id").maybeSingle();
      if (error) throw error;
      await logDept({
        userId: user?.id, table: "departement_membres", recordId: data?.id ?? null, action: "create",
        after: { departement: dept.nom, membre: fullName(m), matricule: m.matricule },
        description: `Ajout de ${fullName(m)} au département ${dept.nom}`,
        templeId: dept.temple_id,
      });
    },
    onSuccess: () => {
      toast.success("Membre ajouté au département");
      qc.invalidateQueries({ queryKey: ["dept-membres", dept.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pool
      .filter((m) => !dejaMembres.includes(m.id))
      .filter((m) => cat === "all" || m.categorie === cat)
      .filter((m) => !s || [m.nom, m.prenoms, m.matricule].filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)))
      .slice(0, 40);
  }, [pool, q, cat, dejaMembres]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Ajouter un membre à « {dept.nom} »</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Recherche dans la base des membres de ce temple uniquement. Aucune nouvelle fiche n'est créée.
          </p>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3 border-b">
          <div className="space-y-1.5">
            <Label>Rechercher un membre</Label>
            <Input placeholder="Matricule, nom ou prénoms" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {results.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Aucun membre correspondant</div>
          )}
          {results.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-muted-foreground">{m.matricule ?? "—"}</div>
                <div className="font-medium truncate">{fullName(m)}</div>
                <div className="text-xs text-muted-foreground">
                  {categoryLabel(m.categorie)} — {m.actif ? "Membre actif" : "Inactif"}
                </div>
              </div>
              <Button size="sm" disabled={add.isPending} onClick={() => add.mutate(m)}>
                Ajouter au département
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
