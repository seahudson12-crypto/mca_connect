import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "create" | "update" | "delete" | "validate";

interface LogChangeArgs {
  userId: string;
  table: string;
  recordId?: string | null;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Log changes by computing the diff between two row snapshots. */
export async function logChange({ userId, table, recordId, action, before, after }: LogChangeArgs) {
  const fieldsToLog = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  // Exclude noise
  ["created_at", "updated_at"].forEach((k) => fieldsToLog.delete(k));

  const rows: Array<{
    utilisateur_id: string;
    table_modifiee: string;
    enregistrement_id: string | null;
    champ: string | null;
    ancienne_valeur: string | null;
    nouvelle_valeur: string | null;
    action: AuditAction;
  }> = [];

  if (action === "create" || action === "delete") {
    rows.push({
      utilisateur_id: userId,
      table_modifiee: table,
      enregistrement_id: recordId ?? null,
      champ: null,
      ancienne_valeur: before ? JSON.stringify(before) : null,
      nouvelle_valeur: after ? JSON.stringify(after) : null,
      action,
    });
  } else {
    fieldsToLog.forEach((k) => {
      const ov = before?.[k];
      const nv = after?.[k];
      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        rows.push({
          utilisateur_id: userId,
          table_modifiee: table,
          enregistrement_id: recordId ?? null,
          champ: k,
          ancienne_valeur: ov == null ? null : String(ov),
          nouvelle_valeur: nv == null ? null : String(nv),
          action,
        });
      }
    });
  }

  if (rows.length === 0) return;
  // Best-effort logging — don't block UX on failure
  await supabase.from("historique_modifications").insert(rows);
}

export const formatXof = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("fr-FR")} FCFA`;
