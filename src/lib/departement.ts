import { supabase } from "@/integrations/supabase/client";
import { logChange } from "@/lib/audit";

export type ActiviteStatut = "a_faire" | "en_cours" | "realise" | "reporte" | "annule";

export type Departement = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
  temple_id: string;
};

export type Activite = {
  id: string;
  departement_id: string;
  temple_id: string;
  titre: string;
  description: string | null;
  responsable: string | null;
  date_prevue: string | null;
  date_realisation: string | null;
  statut: ActiviteStatut;
  avancement: number;
  rapport: string | null;
  observations: string | null;
  objectif: string | null;
  nb_participants: number | null;
  resultats: string | null;
  difficultes: string | null;
  actions_a_entreprendre: string | null;
};

export type MembreLight = {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string | null;
  categorie: string;
  actif: boolean;
  telephone: string | null;
};

export type DeptMembre = {
  id: string;
  departement_id: string;
  membre_id: string;
  date_ajout: string;
  membres: MembreLight | null;
};

export type BureauMembre = {
  id: string;
  departement_id: string;
  membre_id: string;
  fonction: string;
  ordre: number;
  date_debut: string;
  membres: MembreLight | null;
};

export const fullName = (m: MembreLight | null | undefined) =>
  m ? `${m.nom} ${m.prenoms}`.trim() : "—";

/** Une activité est en retard si sa date prévue est passée et qu'elle n'est ni réalisée ni annulée. */
export const enRetard = (a: Activite) =>
  !!a.date_prevue &&
  new Date(a.date_prevue) < new Date(new Date().toDateString()) &&
  a.statut !== "realise" &&
  a.statut !== "annule";

export function statsActivites(acts: Activite[]) {
  const count = (s: ActiviteStatut) => acts.filter((a) => a.statut === s).length;
  const avancement = acts.length
    ? Math.round(acts.reduce((s, a) => s + Number(a.avancement), 0) / acts.length)
    : 0;
  return {
    total: acts.length,
    aFaire: count("a_faire"),
    enCours: count("en_cours"),
    realise: count("realise"),
    reporte: count("reporte"),
    annule: count("annule"),
    retard: acts.filter(enRetard).length,
    avancement,
  };
}

/** Journalise une action du module département (historique + activités utilisateurs). */
export async function logDept(opts: {
  userId?: string | null;
  table: string;
  recordId?: string | null;
  action: "create" | "update" | "delete" | "validate";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  description: string;
  templeId?: string | null;
}) {
  if (!opts.userId) return;
  await Promise.allSettled([
    logChange({
      userId: opts.userId,
      table: opts.table,
      recordId: opts.recordId ?? null,
      action: opts.action,
      before: opts.before ?? null,
      after: opts.after ?? null,
    }),
    supabase.from("activites_utilisateurs").insert({
      utilisateur_id: opts.userId,
      temple_id: opts.templeId ?? null,
      type_action: `departement_${opts.action}`,
      description: opts.description,
    }),
  ]);
}

export const FONCTION_ORDRE: Record<string, number> = {
  "Président": 1,
  "Vice-président": 2,
  "Secrétaire": 3,
  "Secrétaire adjoint": 4,
  "Trésorier": 5,
  "Trésorier adjoint": 6,
  "Conseiller": 7,
  "Membre du bureau": 8,
};
