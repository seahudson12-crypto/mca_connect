// Logique partagée des deux systèmes financiers DISTINCTS :
// - cotisations sociales (social_contribution)
// - offrandes missionnaires (mission_offering)
// Les données ne sont jamais fusionnées : chaque écran filtre sur son op_type.

export type FinanceOpType = "social_contribution" | "mission_offering";
export type FinanceFrequence = "mensuelle" | "trimestrielle" | "annuelle";
export type FinanceStatut = "a_jour" | "partiel" | "retard" | "non_paye" | "paye_plus";

export const OP_LABELS: Record<FinanceOpType, { titre: string; singulier: string; verse: string; bouton: string }> = {
  social_contribution: {
    titre: "Cotisations sociales",
    singulier: "cotisation sociale",
    verse: "Payé",
    bouton: "Enregistrer une cotisation",
  },
  mission_offering: {
    titre: "Offrandes missionnaires",
    singulier: "offrande missionnaire",
    verse: "Donné",
    bouton: "Enregistrer une offrande missionnaire",
  },
};

export const FREQUENCES: Array<{ value: FinanceFrequence; label: string }> = [
  { value: "mensuelle", label: "Mensuelle" },
  { value: "trimestrielle", label: "Trimestrielle" },
  { value: "annuelle", label: "Annuelle" },
];

export const MODES_PAIEMENT = [
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "autre", label: "Autre" },
] as const;

export const STATUT_LABELS: Record<FinanceStatut, string> = {
  a_jour: "À jour",
  paye_plus: "Payé (surplus)",
  partiel: "Partiellement payé",
  retard: "En retard",
  non_paye: "Non payé",
};

const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** Identifiant de période : 2026-07 (mois), 2026-T3 (trimestre), 2026 (année). */
export function periodesFor(frequence: FinanceFrequence, annee: number): string[] {
  if (frequence === "annuelle") return [String(annee)];
  if (frequence === "trimestrielle") return ["T1", "T2", "T3", "T4"].map((t) => `${annee}-${t}`);
  return Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, "0")}`);
}

export function periodeLabel(periode: string): string {
  if (/^\d{4}$/.test(periode)) return `Année ${periode}`;
  const [y, p] = periode.split("-");
  if (p?.startsWith("T")) return `${p} ${y}`;
  const idx = Number(p) - 1;
  return `${MOIS[idx] ?? p} ${y}`;
}

export function periodeCourante(frequence: FinanceFrequence, d = new Date()): string {
  const y = d.getFullYear();
  if (frequence === "annuelle") return String(y);
  if (frequence === "trimestrielle") return `${y}-T${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dernier jour de la période (échéance par défaut). */
export function finDePeriode(periode: string): Date {
  if (/^\d{4}$/.test(periode)) return new Date(Number(periode), 11, 31);
  const [y, p] = periode.split("-");
  if (p?.startsWith("T")) {
    const t = Number(p.slice(1));
    return new Date(Number(y), t * 3, 0);
  }
  return new Date(Number(y), Number(p), 0);
}

export function echeanceFor(periode: string, joursGrace = 0, dateEcheance?: string | null): Date {
  const base = dateEcheance ? new Date(dateEcheance) : finDePeriode(periode);
  if (joursGrace > 0) base.setDate(base.getDate() + joursGrace);
  return base;
}

export function statutFor(attendu: number, paye: number, echeance: Date, now = new Date()): FinanceStatut {
  if (attendu <= 0 && paye <= 0) return "non_paye";
  if (paye >= attendu && attendu > 0) return "a_jour";
  if (paye > 0) return "partiel";
  return now > echeance ? "retard" : "non_paye";
}

export function periodeSuivante(frequence: FinanceFrequence, periode: string): string {
  if (frequence === "annuelle") return String(Number(periode) + 1);
  const [y, p] = periode.split("-");
  if (frequence === "trimestrielle") {
    const t = Number(p.slice(1));
    return t === 4 ? `${Number(y) + 1}-T1` : `${y}-T${t + 1}`;
  }
  const m = Number(p);
  return m === 12 ? `${Number(y) + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Statut d'un membre selon le montant prévu et le montant réellement versé.
 * - versé = 0            -> non payé
 * - 0 < versé < prévu    -> partiellement payé (reliquat + date prévue obligatoire)
 * - versé = prévu        -> à jour (aucun reliquat)
 * - versé > prévu        -> payé, surplus affiché, jamais de reliquat
 */
export function statutMembre(prevu: number, verse: number): FinanceStatut {
  if (verse <= 0) return "non_paye";
  if (prevu <= 0) return "paye_plus";
  if (verse > prevu) return "paye_plus";
  if (verse >= prevu) return "a_jour";
  return "partiel";
}

export function reliquatFor(prevu: number, verse: number): number {
  return Math.max(prevu - verse, 0);
}

export function surplusFor(prevu: number, verse: number): number {
  return Math.max(verse - prevu, 0);
}

/** Date du 2e dimanche du mois (moment habituel des offrandes de soutien). */
export function deuxiemeDimanche(annee: number, mois0: number): Date {
  const d = new Date(annee, mois0, 1);
  const shift = (7 - d.getDay()) % 7; // premier dimanche
  return new Date(annee, mois0, 1 + shift + 7);
}

/** Prochain 2e dimanche à venir (aujourd'hui inclus). */
export function prochainDeuxiemeDimanche(now = new Date()): Date {
  const courant = deuxiemeDimanche(now.getFullYear(), now.getMonth());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (courant >= today) return courant;
  const m = now.getMonth() + 1;
  return deuxiemeDimanche(now.getFullYear() + (m > 11 ? 1 : 0), m % 12);
}
