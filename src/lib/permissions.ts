export type AppRole =
  | "super_admin_principal"
  | "super_admin"
  | "admin_temple"
  | "finances"
  | "responsable_departement"
  | "utilisateur";

/**
 * Chemins autorisés par rôle restreint.
 * `null` = aucune restriction de chemin (les contrôles fins restent dans chaque page).
 * ATTENTION : ceci n'est qu'une amélioration d'interface.
 * La sécurité réelle est appliquée par les politiques RLS de la base de données.
 */
const RESTRICTED_PATHS: Partial<Record<AppRole, string[]>> = {
  finances: ["/dashboard", "/finances"],
  responsable_departement: ["/dashboard", "/departements"],
};

export function allowedPaths(role: AppRole): string[] | null {
  return RESTRICTED_PATHS[role] ?? null;
}

export function canAccessPath(role: AppRole, path: string): boolean {
  const allowed = allowedPaths(role);
  if (!allowed) return true;
  return allowed.some((p) => path === p || path.startsWith(p + "/"));
}

export function defaultRoute(role: AppRole): string {
  if (role === "finances") return "/finances";
  if (role === "responsable_departement") return "/departements";
  return "/dashboard";
}
