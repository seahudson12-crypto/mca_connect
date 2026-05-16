export const APP_NAME = "MCA Connect";
export const TEMPLE_FULL_NAME = "MCA Treichville – Temple Puissance et Gloire";
export const APP_TAGLINE = "Avec Dieu nous ferons des exploits";

export const CATEGORIES = [
  { value: "hommes_adultes", label: "Hommes adultes" },
  { value: "femmes_adultes", label: "Femmes adultes" },
  { value: "jeunes_hommes", label: "Jeunes hommes" },
  { value: "jeunes_filles", label: "Jeunes filles" },
  { value: "groupe_musical", label: "Groupe musical" },
  { value: "ecodim", label: "Ecodim" },
  { value: "moniteurs", label: "Moniteurs" },
  { value: "appeles", label: "Appelés" },
  { value: "serviteurs_de_dieu", label: "Serviteurs de Dieu" },
  { value: "nouvelles_ames", label: "Nouvelles âmes" },
  { value: "pasteurs", label: "Pasteurs" },
] as const;

export const CULTE_TYPES = [
  { value: "dimanche", label: "Culte du dimanche" },
  { value: "semaine", label: "Culte de semaine" },
  { value: "veillee", label: "Veillée" },
  { value: "reunion_speciale", label: "Réunion spéciale" },
  { value: "jeune_priere", label: "Jeûne et prière" },
] as const;

export const ROLES = [
  { value: "super_admin_principal", label: "Super Admin Principal" },
  { value: "super_admin", label: "Super Administrateur" },
  { value: "admin_temple", label: "Administrateur Temple" },
  { value: "utilisateur", label: "Utilisateur" },
] as const;

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const culteTypeLabel = (v: string) =>
  CULTE_TYPES.find((c) => c.value === v)?.label ?? v;
export const roleLabel = (v: string) =>
  ROLES.find((r) => r.value === v)?.label ?? v;
