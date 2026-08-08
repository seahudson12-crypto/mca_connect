import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Download, Phone, Eye } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import * as XLSX from "xlsx";

type Membre = {
  id: string;
  nom: string;
  prenoms: string;
  sexe: "M" | "F" | null;
  telephone: string | null;
  whatsapp: string | null;
  email: string | null;
  date_entree: string | null;
  date_naissance: string | null;
  adresse: string | null;
  profession: string | null;
  secteur_activite: string | null;
  entreprise: string | null;
  categorie: string;
  date_ajout: string;
  temple_id: string;
  actif: boolean;
  matricule: string | null;
  photo_url: string | null;
  observations: string | null;
  famille_id?: string | null;
};

export const Route = createFileRoute("/_app/membres/")({
  component: MembresPage,
});

function MembresPage() {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const { activeTempleId } = useActiveTemple();
  const scopedTempleId = activeTempleId ?? profile?.temple_id ?? null;
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Membre | null>(null);

  const { data: membres = [], isLoading } = useQuery({
    queryKey: ["membres", scopedTempleId],
    enabled: !!scopedTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("*")
        .eq("temple_id", scopedTempleId!)
        .order("nom");
      if (error) throw error;
      return data as Membre[];
    },
  });

  const filtered = membres.filter((m) => {
    const matchSearch = !search || `${m.nom} ${m.prenoms} ${m.telephone ?? ""} ${m.matricule ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || m.categorie === filterCat;
    return matchSearch && matchCat;
  });

  const handleSave = async (form: FormData) => {
    const payload = {
      nom: String(form.get("nom") || "").trim(),
      prenoms: String(form.get("prenoms") || "").trim(),
      sexe: (form.get("sexe") as "M" | "F") || null,
      telephone: String(form.get("telephone") || "").trim() || null,
      whatsapp: String(form.get("whatsapp") || "").trim() || null,
      email: String(form.get("email") || "").trim() || null,
      date_entree: String(form.get("date_entree") || "").trim() || null,
      date_naissance: String(form.get("date_naissance") || "").trim() || null,
      adresse: String(form.get("adresse") || "").trim() || null,
      profession: String(form.get("profession") || "").trim() || null,
      secteur_activite: String(form.get("secteur_activite") || "").trim() || null,
      entreprise: String(form.get("entreprise") || "").trim() || null,
      photo_url: String(form.get("photo_url") || "").trim() || null,
      observations: String(form.get("observations") || "").trim() || null,
      categorie: form.get("categorie") as never,
      temple_id: scopedTempleId ?? "",
    };
    if (!payload.nom || !payload.prenoms || !payload.categorie || !payload.temple_id) {
      toast.error("Remplissez les champs obligatoires");
      return;
    }
    if (editing) {
      const { error } = await supabase.from("membres").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Membre modifié");
    } else {
      const { error } = await supabase.from("membres").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Membre ajouté");
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["membres"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce membre ?")) return;
    const { error } = await supabase.from("membres").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Membre supprimé");
    qc.invalidateQueries({ queryKey: ["membres"] });
  };

  const exportExcel = () => {
    const rows = filtered.map((m) => ({
      Matricule: m.matricule ?? "", Nom: m.nom, Prénoms: m.prenoms, Sexe: m.sexe ?? "", Téléphone: m.telephone ?? "",
      WhatsApp: m.whatsapp ?? "", Email: m.email ?? "", Catégorie: categoryLabel(m.categorie),
      "Date d'entrée": m.date_entree ?? "", "Date de naissance": m.date_naissance ?? "",
      Adresse: m.adresse ?? "", Profession: m.profession ?? "",
      "Secteur d'activité": m.secteur_activite ?? "", Entreprise: m.entreprise ?? "",
      "Date d'ajout": m.date_ajout,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membres");
    XLSX.writeFile(wb, `membres-mca-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Membres</h1>
          <p className="text-sm text-muted-foreground">{membres.length} membres enregistrés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="gradient-brand text-primary-foreground border-0"><Plus className="mr-2 h-4 w-4" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg max-h-[92dvh] p-0 gap-0 flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0 border-b px-5 py-4">
                <DialogTitle>{editing ? "Modifier le membre" : "Nouveau membre"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)); }} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
                {editing?.matricule && (
                  <div className="space-y-1.5">
                    <Label>Matricule</Label>
                    <Input value={editing.matricule} readOnly disabled className="font-mono" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Nom *</Label><Input name="nom" defaultValue={editing?.nom} required /></div>
                  <div className="space-y-1.5"><Label>Prénoms *</Label><Input name="prenoms" defaultValue={editing?.prenoms} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sexe</Label>
                    <Select name="sexe" defaultValue={editing?.sexe ?? undefined}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Catégorie *</Label>
                    <Select name="categorie" defaultValue={editing?.categorie}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Téléphone</Label><Input name="telephone" defaultValue={editing?.telephone ?? ""} /></div>
                  <div className="space-y-1.5"><Label>WhatsApp</Label><Input name="whatsapp" defaultValue={editing?.whatsapp ?? ""} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" name="email" defaultValue={editing?.email ?? ""} /></div>
                  <div className="space-y-1.5"><Label>Date d'entrée</Label><Input type="date" name="date_entree" defaultValue={editing?.date_entree ?? ""} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Date de naissance</Label><Input type="date" name="date_naissance" defaultValue={editing?.date_naissance ?? ""} /></div>
                  <div className="space-y-1.5"><Label>Adresse</Label><Input name="adresse" defaultValue={editing?.adresse ?? ""} /></div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Informations professionnelles</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Profession</Label><Input name="profession" placeholder="ex: Enseignant, Pasteur…" defaultValue={editing?.profession ?? ""} /></div>
                    <div className="space-y-1.5"><Label>Secteur d'activité</Label><Input name="secteur_activite" placeholder="ex: Éducation, Santé…" defaultValue={editing?.secteur_activite ?? ""} /></div>
                  </div>
                  <div className="space-y-1.5 mt-3"><Label>Entreprise (optionnel)</Label><Input name="entreprise" defaultValue={editing?.entreprise ?? ""} /></div>
                </div>
                <div className="pt-2 border-t space-y-3">
                  <input type="hidden" name="photo_url" value={editing?.photo_url ?? ""} />
                  <div className="space-y-1.5"><Label>Observations</Label><Textarea name="observations" rows={3} defaultValue={editing?.observations ?? ""} /></div>
                </div>
                </div>
                <DialogFooter className="shrink-0 border-t bg-background px-5 py-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button type="submit" className="gradient-brand text-primary-foreground border-0">Enregistrer</Button>
                </DialogFooter>
              </form>
            </DialogContent>

          </Dialog>
        </div>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un membre..." className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom & Prénoms</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun membre trouvé</TableCell></TableRow>}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{m.matricule ?? "—"}</TableCell>
                  <TableCell><div className="font-medium">{m.nom} {m.prenoms}</div></TableCell>
                  <TableCell><Badge variant="secondary">{categoryLabel(m.categorie)}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {m.telephone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.telephone}</div>}
                  </TableCell>
                  <TableCell>{m.sexe === "M" ? "H" : m.sexe === "F" ? "F" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button asChild size="icon" variant="ghost" title="Voir la fiche">
                        <Link to="/membres/$membreId" params={{ membreId: m.id }}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
