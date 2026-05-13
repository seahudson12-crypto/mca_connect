import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/temples")({ component: TemplesPage });

function TemplesPage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: temples = [] } = useQuery({
    queryKey: ["temples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("temples").select("*").order("nom_temple");
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async (form: FormData) => {
    const payload = {
      nom_temple: String(form.get("nom_temple") || "").trim(),
      ville: (form.get("ville") as string) || null,
      commune: (form.get("commune") as string) || null,
      pays: (form.get("pays") as string) || "Côte d'Ivoire",
      pasteur_responsable: (form.get("pasteur") as string) || null,
      telephone: (form.get("telephone") as string) || null,
      email: (form.get("email") as string) || null,
    };
    if (!payload.nom_temple) return toast.error("Nom du temple requis");
    const { error } = await supabase.from("temples").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Temple ajouté");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["temples"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Temples MCA</h1>
          <p className="text-sm text-muted-foreground">Gestion multi-temples</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand text-primary-foreground border-0"><Plus className="mr-2 h-4 w-4" /> Nouveau temple</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau temple</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)); }} className="space-y-3">
                <div><Label>Nom du temple *</Label><Input name="nom_temple" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ville</Label><Input name="ville" /></div>
                  <div><Label>Commune</Label><Input name="commune" /></div>
                </div>
                <div><Label>Pays</Label><Input name="pays" defaultValue="Côte d'Ivoire" /></div>
                <div><Label>Pasteur responsable</Label><Input name="pasteur" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Téléphone</Label><Input name="telephone" /></div>
                  <div><Label>Email</Label><Input name="email" type="email" /></div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="gradient-brand text-primary-foreground border-0">Ajouter</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {temples.map((t) => (
          <Card key={t.id} className="p-5 border-0 shadow-elegant">
            <div className="flex items-start gap-3">
              <div className="rounded-xl gradient-gold p-3 text-gold-foreground"><Building2 className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">{t.nom_temple}</h3>
                <p className="text-sm text-muted-foreground">{[t.commune, t.ville, t.pays].filter(Boolean).join(", ")}</p>
                {t.pasteur_responsable && <p className="text-xs text-muted-foreground mt-1">Pasteur : {t.pasteur_responsable}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
