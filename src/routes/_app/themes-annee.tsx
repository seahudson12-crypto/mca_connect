import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Pencil, Trash2, Sparkles, Globe2, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";

export const Route = createFileRoute("/_app/themes-annee")({ component: ThemesAnneePage });

type Theme = {
  id: string; temple_id: string | null; annee: number; titre: string;
  versets: string | null; vision: string | null;
};
type SousTheme = {
  id: string; theme_id: string; periode_type: "trimestre" | "mois"; periode_num: number;
  titre: string; versets: string | null; objectifs: string | null;
  activites: string | null; avancement: number;
};

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const TRIMESTRES = ["1er trimestre","2e trimestre","3e trimestre","4e trimestre"];

function ThemesAnneePage() {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin } = useAuth();
  const { activeTempleId } = useActiveTemple();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [scope, setScope] = useState<"global" | "temple">("global");
  const [openTheme, setOpenTheme] = useState(false);
  const [editTheme, setEditTheme] = useState<Theme | null>(null);
  const [editSousTheme, setEditSousTheme] = useState<SousTheme | null>(null);
  const [openSousTheme, setOpenSousTheme] = useState(false);

  const { data: themes = [] } = useQuery({
    queryKey: ["themes-annee", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes_annee")
        .select("*")
        .eq("annee", year)
        .order("temple_id", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as Theme[];
    },
  });

  const currentTheme = useMemo(() => {
    if (scope === "global") return themes.find((t) => t.temple_id === null) ?? null;
    return themes.find((t) => t.temple_id === activeTempleId) ?? null;
  }, [themes, scope, activeTempleId]);

  const { data: sousThemes = [] } = useQuery({
    queryKey: ["sous-themes", currentTheme?.id],
    enabled: !!currentTheme,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sous_themes_annee")
        .select("*")
        .eq("theme_id", currentTheme!.id)
        .order("periode_type")
        .order("periode_num");
      if (error) throw error;
      return data as SousTheme[];
    },
  });

  const canEditTheme = scope === "global" ? isSuperAdmin : isAdmin;
  const avancementGlobal = useMemo(() => {
    if (sousThemes.length === 0) return 0;
    return Math.round(sousThemes.reduce((s, x) => s + x.avancement, 0) / sousThemes.length);
  }, [sousThemes]);

  const handleSaveTheme = async (form: FormData) => {
    const payload = {
      annee: Number(form.get("annee")),
      titre: String(form.get("titre") || "").trim(),
      versets: (form.get("versets") as string) || null,
      vision: (form.get("vision") as string) || null,
      temple_id: scope === "global" ? null : activeTempleId,
    };
    if (!payload.titre) return toast.error("Titre requis");
    if (editTheme) {
      const { error } = await supabase.from("themes_annee").update(payload).eq("id", editTheme.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("themes_annee").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(editTheme ? "Thème mis à jour" : "Thème créé");
    setOpenTheme(false);
    setEditTheme(null);
    qc.invalidateQueries({ queryKey: ["themes-annee"] });
  };

  const handleDeleteTheme = async (t: Theme) => {
    if (!confirm("Supprimer ce thème et tous ses sous-thèmes ?")) return;
    const { error } = await supabase.from("themes_annee").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Thème supprimé");
    qc.invalidateQueries({ queryKey: ["themes-annee"] });
  };

  const handleSaveSousTheme = async (form: FormData) => {
    if (!currentTheme) return;
    const payload = {
      theme_id: currentTheme.id,
      periode_type: form.get("periode_type") as "trimestre" | "mois",
      periode_num: Number(form.get("periode_num")),
      titre: String(form.get("titre") || "").trim(),
      versets: (form.get("versets") as string) || null,
      objectifs: (form.get("objectifs") as string) || null,
      activites: (form.get("activites") as string) || null,
      avancement: Math.max(0, Math.min(100, Number(form.get("avancement") || 0))),
    };
    if (!payload.titre) return toast.error("Titre requis");
    if (editSousTheme) {
      const { error } = await supabase.from("sous_themes_annee").update(payload).eq("id", editSousTheme.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("sous_themes_annee").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Sous-thème enregistré");
    setOpenSousTheme(false);
    setEditSousTheme(null);
    qc.invalidateQueries({ queryKey: ["sous-themes"] });
  };

  const handleDeleteSousTheme = async (s: SousTheme) => {
    if (!confirm("Supprimer ce sous-thème ?")) return;
    const { error } = await supabase.from("sous_themes_annee").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Sous-thème supprimé");
    qc.invalidateQueries({ queryKey: ["sous-themes"] });
  };

  const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Thème de l'année
          </h1>
          <p className="text-sm text-muted-foreground">Vision annuelle et progression des sous-thèmes</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as "global" | "temple")}>
        <TabsList>
          <TabsTrigger value="global"><Globe2 className="mr-1.5 h-3.5 w-3.5" /> Global MCA</TabsTrigger>
          <TabsTrigger value="temple"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Mon temple</TabsTrigger>
        </TabsList>
        <TabsContent value={scope} className="space-y-4 mt-4">
          {!currentTheme ? (
            <Card className="p-8 text-center border-dashed">
              <Sparkles className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                Aucun thème {scope === "global" ? "global" : "pour votre temple"} pour {year}
              </p>
              {canEditTheme && (
                <Dialog open={openTheme} onOpenChange={(o) => { setOpenTheme(o); if (!o) setEditTheme(null); }}>
                  <DialogTrigger asChild>
                    <Button className="gradient-brand text-primary-foreground border-0">
                      <Plus className="mr-2 h-4 w-4" /> Définir le thème {year}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Thème de l'année {year}</DialogTitle></DialogHeader>
                    <ThemeForm year={year} defaults={null} onSubmit={handleSaveTheme} onCancel={() => setOpenTheme(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </Card>
          ) : (
            <>
              <Card className="p-6 border-0 shadow-elegant gradient-brand text-primary-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Badge className="bg-white/20 text-primary-foreground border-0 mb-2">Année {currentTheme.annee}</Badge>
                    <h2 className="text-2xl font-bold mb-2">« {currentTheme.titre} »</h2>
                    {currentTheme.versets && <p className="text-sm italic opacity-90 mb-2">{currentTheme.versets}</p>}
                    {currentTheme.vision && <p className="text-sm opacity-95 whitespace-pre-wrap">{currentTheme.vision}</p>}
                  </div>
                  {canEditTheme && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/20"
                        onClick={() => { setEditTheme(currentTheme); setOpenTheme(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/20"
                        onClick={() => handleDeleteTheme(currentTheme)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>Avancement global</span>
                    <span className="font-bold">{avancementGlobal}%</span>
                  </div>
                  <Progress value={avancementGlobal} className="bg-white/20" />
                </div>
              </Card>

              <Dialog open={openTheme} onOpenChange={(o) => { setOpenTheme(o); if (!o) setEditTheme(null); }}>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editTheme ? "Modifier" : "Définir"} le thème</DialogTitle></DialogHeader>
                  <ThemeForm year={year} defaults={editTheme} onSubmit={handleSaveTheme} onCancel={() => { setOpenTheme(false); setEditTheme(null); }} />
                </DialogContent>
              </Dialog>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sous-thèmes</h3>
                {canEditTheme && (
                  <Dialog open={openSousTheme} onOpenChange={(o) => { setOpenSousTheme(o); if (!o) setEditSousTheme(null); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Ajouter un sous-thème</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editSousTheme ? "Modifier" : "Nouveau"} sous-thème</DialogTitle></DialogHeader>
                      <SousThemeForm defaults={editSousTheme} onSubmit={handleSaveSousTheme} onCancel={() => { setOpenSousTheme(false); setEditSousTheme(null); }} />
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {sousThemes.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground border-dashed">
                  Aucun sous-thème. Ajoutez-en par trimestre ou par mois.
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sousThemes.map((s) => {
                    const periodLabel = s.periode_type === "trimestre"
                      ? TRIMESTRES[s.periode_num - 1] ?? `T${s.periode_num}`
                      : MOIS[s.periode_num - 1] ?? `Mois ${s.periode_num}`;
                    return (
                      <Card key={s.id} className="p-4 border-0 shadow-elegant">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Badge variant="outline" className="mb-1">{periodLabel}</Badge>
                            <h4 className="font-semibold">{s.titre}</h4>
                            {s.versets && <p className="text-xs italic text-muted-foreground mt-1">{s.versets}</p>}
                          </div>
                          {canEditTheme && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditSousTheme(s); setOpenSousTheme(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSousTheme(s)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {s.objectifs && (
                          <div className="mt-2 text-xs">
                            <span className="font-semibold text-primary">Objectifs : </span>
                            <span className="text-muted-foreground whitespace-pre-wrap">{s.objectifs}</span>
                          </div>
                        )}
                        {s.activites && (
                          <div className="mt-1 text-xs">
                            <span className="font-semibold text-primary">Activités : </span>
                            <span className="text-muted-foreground whitespace-pre-wrap">{s.activites}</span>
                          </div>
                        )}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Avancement</span>
                            <span className="font-semibold">{s.avancement}%</span>
                          </div>
                          <Progress value={s.avancement} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThemeForm({ year, defaults, onSubmit, onCancel }: {
  year: number; defaults: Theme | null;
  onSubmit: (f: FormData) => void; onCancel: () => void;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-3">
      <div><Label>Année *</Label><Input type="number" name="annee" required defaultValue={defaults?.annee ?? year} /></div>
      <div><Label>Titre du thème *</Label><Input name="titre" required defaultValue={defaults?.titre ?? ""} placeholder="Ex: Année de l'installation par notre héritage en Christ" /></div>
      <div><Label>Versets de référence</Label><Input name="versets" defaultValue={defaults?.versets ?? ""} placeholder="Ex: Éphésiens 1:11-14" /></div>
      <div><Label>Vision de l'année</Label><Textarea name="vision" rows={4} defaultValue={defaults?.vision ?? ""} /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="gradient-brand text-primary-foreground border-0">Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}

function SousThemeForm({ defaults, onSubmit, onCancel }: {
  defaults: SousTheme | null;
  onSubmit: (f: FormData) => void; onCancel: () => void;
}) {
  const [type, setType] = useState<"trimestre" | "mois">(defaults?.periode_type ?? "trimestre");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type *</Label>
          <Select name="periode_type" value={type} onValueChange={(v) => setType(v as "trimestre" | "mois")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="mois">Mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Période *</Label>
          <Select name="periode_num" defaultValue={String(defaults?.periode_num ?? 1)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(type === "trimestre" ? TRIMESTRES : MOIS).map((lbl, i) => (
                <SelectItem key={i} value={String(i + 1)}>{lbl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Titre *</Label><Input name="titre" required defaultValue={defaults?.titre ?? ""} /></div>
      <div><Label>Versets</Label><Input name="versets" defaultValue={defaults?.versets ?? ""} /></div>
      <div><Label>Objectifs</Label><Textarea name="objectifs" rows={3} defaultValue={defaults?.objectifs ?? ""} /></div>
      <div><Label>Activités réalisées</Label><Textarea name="activites" rows={3} defaultValue={defaults?.activites ?? ""} /></div>
      <div>
        <Label>Niveau d'avancement (0-100%) *</Label>
        <Input type="number" name="avancement" min={0} max={100} required defaultValue={defaults?.avancement ?? 0} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" className="gradient-brand text-primary-foreground border-0">Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}
