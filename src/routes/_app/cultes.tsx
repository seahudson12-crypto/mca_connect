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
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { CULTE_TYPES, culteTypeLabel } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type Culte = {
  id: string; date: string; type_culte: string; heure_debut: string | null; heure_fin: string | null;
  president: string | null; theme_presidence: string | null; versets: string | null;
  responsable_priere: string | null; orateur: string | null; theme_principal: string | null;
  offrandes: number | null; dimes: number | null; depenses: number | null;
  solde_caisse: number | null; notes_finances: string | null;
};

export const Route = createFileRoute("/_app/cultes")({ component: CultesPage });

function CultesPage() {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: cultes = [], isLoading } = useQuery({
    queryKey: ["cultes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cultes").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Culte[];
    },
  });

  const handleSave = async (form: FormData) => {
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
      temple_id: profile?.temple_id ?? "",
    };
    if (!payload.date || !payload.type_culte || !payload.temple_id) {
      toast.error("Remplissez la date et le type de culte");
      return;
    }
    const { error } = await supabase.from("cultes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Culte créé");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["cultes"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce culte et toutes ses présences ?")) return;
    const { error } = await supabase.from("cultes").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-primary-foreground border-0"><Plus className="mr-2 h-4 w-4" /> Nouveau culte</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau culte</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date *</Label><Input type="date" name="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} /></div>
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select name="type_culte" defaultValue="dimanche">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CULTE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Heure début</Label><Input type="time" name="heure_debut" /></div>
                <div className="space-y-1.5"><Label>Heure fin</Label><Input type="time" name="heure_fin" /></div>
              </div>
              <div className="space-y-1.5"><Label>Président du culte</Label><Input name="president" /></div>
              <div className="space-y-1.5"><Label>Thème de la présidence</Label><Input name="theme_presidence" /></div>
              <div className="space-y-1.5"><Label>Versets</Label><Input name="versets" placeholder="Ex: Psaumes 23:1-6" /></div>
              <div className="space-y-1.5"><Label>Responsable prière intense</Label><Input name="responsable_priere" /></div>
              <div className="space-y-1.5"><Label>Orateur</Label><Input name="orateur" /></div>
              <div className="space-y-1.5"><Label>Thème principal</Label><Textarea name="theme_principal" rows={2} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" className="gradient-brand text-primary-foreground border-0">Créer</Button>
              </DialogFooter>
            </form>
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
        {cultes.map((c) => (
          <Card key={c.id} className="p-5 border-0 shadow-elegant hover:shadow-gold transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge className="bg-primary text-primary-foreground">{culteTypeLabel(c.type_culte)}</Badge>
                <h3 className="mt-2 font-semibold">{format(new Date(c.date), "EEEE d MMMM yyyy", { locale: fr })}</h3>
                {(c.heure_debut || c.heure_fin) && (
                  <p className="text-xs text-muted-foreground">{c.heure_debut} {c.heure_fin && `– ${c.heure_fin}`}</p>
                )}
              </div>
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {c.orateur && <div><span className="text-muted-foreground">Orateur :</span> <span className="font-medium">{c.orateur}</span></div>}
              {c.theme_principal && <div className="text-muted-foreground line-clamp-2 italic">« {c.theme_principal} »</div>}
            </div>
            <Link to="/presences/$culteId" params={{ culteId: c.id }} className="mt-4 block">
              <Button variant="outline" className="w-full"><ClipboardCheck className="mr-2 h-4 w-4" /> Pointer les présences</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
