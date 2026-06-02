import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { categoryLabel, culteTypeLabel } from "@/lib/constants";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/exports")({ component: ExportsPage });

type Entity = "membres" | "cultes" | "presences" | "finances" | "nouvelles_ames";
type Fmt = "xlsx" | "csv";

const ENTITIES: { value: Entity; label: string; description: string }[] = [
  { value: "membres", label: "Membres", description: "Liste complète avec coordonnées et profession" },
  { value: "cultes", label: "Cultes", description: "Tous les cultes avec orateurs et thèmes" },
  { value: "presences", label: "Présences", description: "Détail des présences par culte et membre" },
  { value: "finances", label: "Finances", description: "Recettes, dépenses et soldes par culte" },
  { value: "nouvelles_ames", label: "Nouvelles âmes", description: "Membres de la catégorie « nouvelles âmes »" },
];

function ExportsPage() {
  const { isSuperAdmin, profile, canSeeFinances } = useAuth();
  const { activeTempleId, allTemples } = useActiveTemple();

  const defaultScope = profile?.temple_id ?? "current";
  const [scope, setScope] = useState<string>(isSuperAdmin ? "all" : defaultScope);
  const [entities, setEntities] = useState<Record<Entity, boolean>>({
    membres: true, cultes: false, presences: false, finances: false, nouvelles_ames: false,
  });
  const [fmt, setFmt] = useState<Fmt>("xlsx");
  const [busy, setBusy] = useState(false);

  const toggle = (e: Entity) => setEntities((s) => ({ ...s, [e]: !s[e] }));

  const templeIds = (): string[] => {
    if (scope === "all") return allTemples.map((t) => t.id);
    if (scope === "current") return activeTempleId ? [activeTempleId] : [];
    return [scope];
  };

  const fetchEntity = async (entity: Entity, ids: string[]) => {
    if (entity === "membres" || entity === "nouvelles_ames") {
      let q = supabase.from("membres").select("*").in("temple_id", ids).order("nom");
      if (entity === "nouvelles_ames") q = q.eq("categorie", "nouvelles_ames");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((m) => ({
        Temple: allTemples.find((t) => t.id === m.temple_id)?.nom_temple ?? "",
        Nom: m.nom, Prénoms: m.prenoms, Sexe: m.sexe ?? "",
        Catégorie: categoryLabel(m.categorie),
        Téléphone: m.telephone ?? "", WhatsApp: m.whatsapp ?? "", Email: m.email ?? "",
        "Date entrée": m.date_entree ?? "", "Date naissance": m.date_naissance ?? "",
        Adresse: m.adresse ?? "", Profession: m.profession ?? "",
        "Secteur": m.secteur_activite ?? "", Entreprise: m.entreprise ?? "",
        "Date ajout": m.date_ajout,
      }));
    }
    if (entity === "cultes") {
      const { data, error } = await supabase.from("cultes").select("*").in("temple_id", ids).order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        Temple: allTemples.find((t) => t.id === c.temple_id)?.nom_temple ?? "",
        Date: c.date, Type: culteTypeLabel(c.type_culte),
        Président: c.president ?? "", Orateur: c.orateur ?? "",
        Thème: c.theme_principal ?? "", Statut: c.statut,
      }));
    }
    if (entity === "presences") {
      const { data: cultes } = await supabase.from("cultes").select("id,date,type_culte,temple_id").in("temple_id", ids);
      const culteIds = (cultes ?? []).map((c) => c.id);
      if (culteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("presences")
        .select("statut,membre:membres(nom,prenoms,categorie),culte:cultes(date,type_culte,temple_id)")
        .in("culte_id", culteIds);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        Temple: allTemples.find((t) => t.id === p.culte?.temple_id)?.nom_temple ?? "",
        Date: p.culte?.date ?? "",
        "Type culte": culteTypeLabel(p.culte?.type_culte ?? ""),
        Nom: p.membre?.nom ?? "", Prénoms: p.membre?.prenoms ?? "",
        Catégorie: categoryLabel(p.membre?.categorie ?? ""),
        Statut: p.statut,
      }));
    }
    if (entity === "finances") {
      if (!canSeeFinances) return [];
      const { data: cultes } = await supabase.from("cultes").select("id,date,type_culte,temple_id").in("temple_id", ids);
      const culteIds = (cultes ?? []).map((c) => c.id);
      if (culteIds.length === 0) return [];
      const { data, error } = await supabase.from("finances_culte").select("*").in("culte_id", culteIds);
      if (error) throw error;
      const cMap = new Map((cultes ?? []).map((c) => [c.id, c]));
      return (data ?? []).map((f) => {
        const c = cMap.get(f.culte_id);
        const recettes = Number(f.offrande) + Number(f.dime) + Number(f.action_grace) + Number(f.semence) + Number(f.contribution_speciale);
        return {
          Temple: allTemples.find((t) => t.id === c?.temple_id)?.nom_temple ?? "",
          Date: c?.date ?? "", Type: culteTypeLabel(c?.type_culte ?? ""),
          Offrandes: Number(f.offrande), Dîmes: Number(f.dime),
          "Actions de grâce": Number(f.action_grace), Semences: Number(f.semence),
          "Contributions spé.": Number(f.contribution_speciale),
          "Total recettes": recettes, Dépenses: Number(f.depense), Solde: Number(f.solde),
          Observation: f.observation ?? "",
        };
      });
    }
    return [];
  };

  const run = async () => {
    const selected = (Object.keys(entities) as Entity[]).filter((k) => entities[k]);
    if (selected.length === 0) return toast.error("Sélectionnez au moins une catégorie de données");
    const ids = templeIds();
    if (ids.length === 0) return toast.error("Aucun temple sélectionné");

    setBusy(true);
    try {
      if (fmt === "xlsx") {
        const wb = XLSX.utils.book_new();
        for (const ent of selected) {
          const rows = await fetchEntity(ent, ids);
          const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Aucune donnée" }]);
          XLSX.utils.book_append_sheet(wb, ws, ent.slice(0, 30));
        }
        const scopeLabel = scope === "all" ? "tous-temples" : scope === "current" ? "temple-actif" : (allTemples.find((t) => t.id === scope)?.nom_temple ?? "export").replace(/[^\w-]+/g, "-").toLowerCase();
        XLSX.writeFile(wb, `mca-export-${scopeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`Export Excel généré (${selected.length} feuille${selected.length > 1 ? "s" : ""})`);
      } else {
        for (const ent of selected) {
          const rows = await fetchEntity(ent, ids);
          if (rows.length === 0) continue;
          const ws = XLSX.utils.json_to_sheet(rows);
          const csv = XLSX.utils.sheet_to_csv(ws);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `mca-${ent}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click(); URL.revokeObjectURL(url);
        }
        toast.success("Export CSV généré");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Exports avancés</h1>
        <p className="text-sm text-muted-foreground">
          Téléchargez vos données aux formats Excel ou CSV pour analyse ou archivage.
        </p>
      </div>

      <Card className="p-5 border-0 shadow-elegant space-y-5">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Portée de l'export</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {isSuperAdmin && <SelectItem value="all">Tous les temples</SelectItem>}
              <SelectItem value="current">Temple actif</SelectItem>
              {isSuperAdmin && allTemples.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nom_temple}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-2 block">Données à exporter</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTITIES.filter((e) => e.value !== "finances" || canSeeFinances).map((e) => (
              <label key={e.value} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <Checkbox checked={entities[e.value]} onCheckedChange={() => toggle(e.value)} className="mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Database className="h-3.5 w-3.5" /> {e.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{e.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-2 block">Format</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={fmt === "xlsx" ? "default" : "outline"}
              onClick={() => setFmt("xlsx")}
              className={fmt === "xlsx" ? "gradient-brand text-primary-foreground border-0" : ""}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              <Badge variant="secondary" className="ml-2">multi-feuilles</Badge>
            </Button>
            <Button
              type="button"
              variant={fmt === "csv" ? "default" : "outline"}
              onClick={() => setFmt("csv")}
              className={fmt === "csv" ? "gradient-brand text-primary-foreground border-0" : ""}
            >
              <FileText className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t flex justify-end">
          <Button onClick={run} disabled={busy} className="gradient-brand text-primary-foreground border-0 shadow-elegant">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Générer l'export
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-0 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>Astuce :</strong> en format Excel, chaque catégorie est exportée dans une feuille séparée du même fichier.
          Les Super Admins peuvent exporter un temple, plusieurs ou tous les temples en une fois.
        </p>
      </Card>
    </div>
  );
}
