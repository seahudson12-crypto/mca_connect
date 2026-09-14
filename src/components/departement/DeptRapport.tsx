import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Printer } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { categoryLabel, activiteStatutLabel } from "@/lib/constants";
import {
  type Activite, type BureauMembre, type Departement, type DeptMembre,
  enRetard, fullName, statsActivites,
} from "@/lib/departement";

const download = (name: string, rows: string[][]) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export function DeptRapport({
  dept, activites, templeNom,
}: { dept: Departement; activites: Activite[]; templeNom: string }) {
  const { data: membres = [] } = useQuery({
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

  const { data: bureau = [] } = useQuery({
    queryKey: ["dept-bureau", dept.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departement_bureau")
        .select("id,departement_id,membre_id,fonction,ordre,date_debut,membres(id,nom,prenoms,matricule,categorie,actif,telephone)")
        .eq("departement_id", dept.id);
      if (error) throw error;
      return ((data ?? []) as unknown as BureauMembre[]).sort((a, b) => a.ordre - b.ordre);
    },
  });

  const s = statsActivites(activites);

  const parCategorie = membres.reduce<Record<string, number>>((acc, m) => {
    const c = m.membres?.categorie ?? "—";
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  const exportMembres = () =>
    download(`membres-${dept.nom}.csv`, [
      ["Matricule", "Nom", "Prénoms", "Catégorie", "Statut", "Ajouté le"],
      ...membres.map((m) => [
        m.membres?.matricule ?? "",
        m.membres?.nom ?? "",
        m.membres?.prenoms ?? "",
        categoryLabel(m.membres?.categorie ?? ""),
        m.membres?.actif ? "Actif" : "Inactif",
        m.date_ajout,
      ]),
    ]);

  const exportBureau = () =>
    download(`bureau-${dept.nom}.csv`, [
      ["Fonction", "Nom & prénoms", "Matricule"],
      ...bureau.map((b) => [b.fonction, fullName(b.membres), b.membres?.matricule ?? ""]),
    ]);

  const exportActivites = () =>
    download(`activites-${dept.nom}.csv`, [
      ["Titre", "Objectif", "Responsable", "Date prévue", "Date réalisation", "Statut", "Avancement %",
        "Participants", "Résultats", "Difficultés", "Actions à entreprendre", "Observations"],
      ...activites.map((a) => [
        a.titre, a.objectif ?? "", a.responsable ?? "", a.date_prevue ?? "", a.date_realisation ?? "",
        activiteStatutLabel(a.statut), String(a.avancement), a.nb_participants == null ? "" : String(a.nb_participants),
        a.resultats ?? "", a.difficultes ?? "", a.actions_a_entreprendre ?? "", a.observations ?? "",
      ]),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportMembres}><Download className="mr-1.5 h-4 w-4" /> Membres (Excel/CSV)</Button>
        <Button variant="outline" onClick={exportBureau}><Download className="mr-1.5 h-4 w-4" /> Bureau (Excel/CSV)</Button>
        <Button variant="outline" onClick={exportActivites}><Download className="mr-1.5 h-4 w-4" /> Activités (Excel/CSV)</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Imprimer / PDF</Button>
      </div>

      <Card className="p-6 border-0 shadow-elegant space-y-6">
        <div>
          <h2 className="text-xl font-bold">Bilan du département « {dept.nom} »</h2>
          <p className="text-sm text-muted-foreground">
            {templeNom} — édité le {format(new Date(), "d MMMM yyyy", { locale: fr })}
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold uppercase text-sm tracking-wide text-primary">Membres</h3>
          <p className="text-sm">Nombre total : <strong>{membres.length}</strong> — dont {membres.filter((m) => m.membres?.actif).length} actif(s)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(parCategorie).map(([c, n]) => (
              <Badge key={c} variant="secondary">{categoryLabel(c)} : {n}</Badge>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold uppercase text-sm tracking-wide text-primary">Bureau</h3>
          {bureau.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bureau non constitué.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {bureau.map((b) => (
                <li key={b.id}><strong>{b.fonction}</strong> — {fullName(b.membres)} ({b.membres?.matricule ?? "—"})</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold uppercase text-sm tracking-wide text-primary">Activités</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>Prévues (à faire) : <strong>{s.aFaire}</strong></div>
            <div>En cours : <strong>{s.enCours}</strong></div>
            <div>Réalisées : <strong>{s.realise}</strong></div>
            <div>Reportées : <strong>{s.reporte}</strong></div>
            <div>Annulées : <strong>{s.annule}</strong></div>
            <div>Total : <strong>{s.total}</strong></div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold uppercase text-sm tracking-wide text-primary">Avancement</h3>
          <div className="flex items-center gap-3">
            <Progress value={s.avancement} className="max-w-xs" />
            <span className="text-sm font-semibold">{s.avancement}%</span>
          </div>
          <p className="text-sm">Activités en retard : <strong>{s.retard}</strong></p>
          {activites.filter(enRetard).length > 0 && (
            <ul className="text-sm list-disc pl-5 text-muted-foreground">
              {activites.filter(enRetard).map((a) => (
                <li key={a.id}>{a.titre} — prévue le {a.date_prevue}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold uppercase text-sm tracking-wide text-primary">Rapports d'activité</h3>
          {activites.filter((a) => a.rapport || a.resultats || a.difficultes).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rapport renseigné.</p>
          ) : (
            <div className="space-y-3">
              {activites.filter((a) => a.rapport || a.resultats || a.difficultes).map((a) => (
                <div key={a.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="font-medium">{a.titre} — {activiteStatutLabel(a.statut)} ({a.avancement}%)</div>
                  {a.nb_participants != null && <div>Participants : {a.nb_participants}</div>}
                  {a.resultats && <div><span className="text-muted-foreground">Résultats :</span> {a.resultats}</div>}
                  {a.difficultes && <div><span className="text-muted-foreground">Difficultés :</span> {a.difficultes}</div>}
                  {a.actions_a_entreprendre && <div><span className="text-muted-foreground">Actions :</span> {a.actions_a_entreprendre}</div>}
                  {a.rapport && <div><span className="text-muted-foreground">Rapport :</span> {a.rapport}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </Card>
    </div>
  );
}
