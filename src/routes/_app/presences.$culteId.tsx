import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Send, FileDown, ArrowLeft, UserCheck, UserX, Sparkles } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { CATEGORIES, categoryLabel, culteTypeLabel, TEMPLE_FULL_NAME } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StatCard } from "@/components/StatCard";

export const Route = createFileRoute("/_app/presences/$culteId")({ component: PointagePage });

type Membre = { id: string; nom: string; prenoms: string; categorie: string; whatsapp: string | null; telephone: string | null };

function PointagePage() {
  const { culteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [statuts, setStatuts] = useState<Record<string, "present" | "absent">>({});
  const [openAdd, setOpenAdd] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("all");

  const { data: culte } = useQuery({
    queryKey: ["culte", culteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cultes").select("*").eq("id", culteId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: membres = [] } = useQuery({
    queryKey: ["membres-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membres").select("id,nom,prenoms,categorie,whatsapp,telephone").eq("actif", true).order("nom");
      if (error) throw error;
      return data as Membre[];
    },
  });

  const { data: presencesExistantes = [] } = useQuery({
    queryKey: ["presences", culteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("presences").select("*").eq("culte_id", culteId);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const map: Record<string, "present" | "absent"> = {};
    presencesExistantes.forEach((p: { membre_id: string; statut: string }) => {
      if (p.statut === "present" || p.statut === "absent") map[p.membre_id] = p.statut;
    });
    setStatuts(map);
  }, [presencesExistantes]);

  const grouped = useMemo(() => {
    const g: Record<string, Membre[]> = {};
    membres.forEach((m) => { (g[m.categorie] ||= []).push(m); });
    return g;
  }, [membres]);

  const stats = useMemo(() => {
    const present = Object.values(statuts).filter((s) => s === "present").length;
    const absent = Object.values(statuts).filter((s) => s === "absent").length;
    const nouvelles = membres.filter((m) => m.categorie === "nouvelles_ames" && statuts[m.id] === "present").length;
    return { present, absent, nouvelles, total: membres.length };
  }, [statuts, membres]);

  const toggle = (id: string, val: "present" | "absent") => {
    setStatuts((s) => ({ ...s, [id]: s[id] === val ? (val === "present" ? "absent" : "present") : val }));
  };

  const handleSaveAll = async () => {
    const rows = Object.entries(statuts).map(([membre_id, statut]) => ({ membre_id, culte_id: culteId, statut }));
    if (rows.length === 0) return toast.error("Aucune présence à enregistrer");
    const { error } = await supabase.from("presences").upsert(rows, { onConflict: "membre_id,culte_id" });
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} présences enregistrées`);
    qc.invalidateQueries({ queryKey: ["presences", culteId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleAddMembre = async (form: FormData) => {
    const payload = {
      nom: String(form.get("nom") || "").trim(),
      prenoms: String(form.get("prenoms") || "").trim(),
      categorie: form.get("categorie") as never,
      telephone: (form.get("telephone") as string) || null,
      whatsapp: (form.get("whatsapp") as string) || null,
      sexe: (form.get("sexe") as "M" | "F") || null,
      temple_id: profile?.temple_id ?? "",
    };
    if (!payload.nom || !payload.prenoms || !payload.categorie || !payload.temple_id) return toast.error("Champs obligatoires manquants");
    const { data, error } = await supabase.from("membres").insert(payload).select().maybeSingle();
    if (error) return toast.error(error.message);
    if (data) setStatuts((s) => ({ ...s, [data.id]: "present" }));
    toast.success("Membre ajouté & marqué présent");
    setOpenAdd(false);
    qc.invalidateQueries({ queryKey: ["membres-actifs"] });
    qc.invalidateQueries({ queryKey: ["membres"] });
  };

  const exportPDF = () => {
    if (!culte) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("RAPPORT DE PRÉSENCE", 105, 18, { align: "center" });
    doc.setFontSize(10); doc.text(TEMPLE_FULL_NAME, 105, 25, { align: "center" });
    doc.setFontSize(11);
    doc.text(`${culteTypeLabel(culte.type_culte)} — ${format(new Date(culte.date), "EEEE d MMMM yyyy", { locale: fr })}`, 14, 36);
    if (culte.orateur) doc.text(`Orateur: ${culte.orateur}`, 14, 43);
    if (culte.theme_principal) doc.text(`Thème: ${culte.theme_principal}`, 14, 50);

    doc.setFontSize(12); doc.text(`Présents: ${stats.present}   Absents: ${stats.absent}   Nouvelles âmes: ${stats.nouvelles}`, 14, 60);

    const rows = membres.map((m) => [`${m.nom} ${m.prenoms}`, categoryLabel(m.categorie), statuts[m.id] === "present" ? "Présent" : statuts[m.id] === "absent" ? "Absent" : "—"]);
    autoTable(doc, {
      startY: 66,
      head: [["Nom & Prénoms", "Catégorie", "Statut"]],
      body: rows,
      headStyles: { fillColor: [42, 80, 180] },
      styles: { fontSize: 9 },
    });
    doc.save(`presences-${culte.date}.pdf`);
  };

  const cats = activeCat === "all" ? Object.keys(grouped) : [activeCat];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/cultes" })}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold">Pointage des présences</h1>
          {culte && (
            <p className="text-sm text-muted-foreground">
              {culteTypeLabel(culte.type_culte)} — {format(new Date(culte.date), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total membres" value={stats.total} icon={UserCheck} />
        <StatCard label="Présents" value={stats.present} icon={UserCheck} variant="success" />
        <StatCard label="Absents" value={stats.absent} icon={UserX} variant="warning" />
        <StatCard label="Nouvelles âmes" value={stats.nouvelles} icon={Sparkles} variant="gold" />
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="flex flex-wrap gap-2 mb-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Nouvelle âme</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Ajouter rapidement</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); handleAddMembre(new FormData(e.currentTarget)); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom *</Label><Input name="nom" required /></div>
                    <div><Label>Prénoms *</Label><Input name="prenoms" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Sexe</Label>
                      <Select name="sexe"><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent></Select>
                    </div>
                    <div><Label>Catégorie *</Label>
                      <Select name="categorie" defaultValue="nouvelles_ames">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Téléphone</Label><Input name="telephone" /></div>
                  <div><Label>WhatsApp</Label><Input name="whatsapp" /></div>
                  <DialogFooter>
                    <Button type="submit" className="gradient-brand text-primary-foreground border-0">Ajouter & marquer présent</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={exportPDF}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
          </div>
          <Button onClick={handleSaveAll} className="gradient-brand text-primary-foreground border-0 shadow-elegant">
            <Save className="mr-2 h-4 w-4" /> Tout enregistrer
          </Button>
        </div>

        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50">
            <TabsTrigger value="all">Toutes</TabsTrigger>
            {Object.keys(grouped).map((c) => (
              <TabsTrigger key={c} value={c}>{categoryLabel(c)} <Badge className="ml-1.5" variant="secondary">{grouped[c].length}</Badge></TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={activeCat} className="mt-4 space-y-6">
            {cats.map((cat) => (
              <div key={cat}>
                <h3 className="mb-2 text-sm font-semibold text-primary uppercase tracking-wide">{categoryLabel(cat)}</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {grouped[cat]?.map((m) => {
                    const s = statuts[m.id];
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3">
                        <div className="min-w-0 font-medium truncate">{m.nom} {m.prenoms}</div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant={s === "present" ? "default" : "outline"} className={s === "present" ? "bg-success text-success-foreground hover:bg-success/90" : ""} onClick={() => toggle(m.id, "present")}>P</Button>
                          <Button size="sm" variant={s === "absent" ? "default" : "outline"} className={s === "absent" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => toggle(m.id, "absent")}>A</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
