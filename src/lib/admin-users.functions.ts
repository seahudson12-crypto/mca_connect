import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const activeSchema = z.object({ userId: z.string().uuid(), actif: z.boolean() });
const deleteSchema = z.object({ userId: z.string().uuid() });

/** Vérifie que l'appelant est administrateur (lecture faite avec ses propres droits). */
async function assertAdmin(
  supabase: { from: (t: "user_roles") => any },
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  const ok = roles.some((r) => r === "super_admin_principal" || r === "super_admin" || r === "admin_temple");
  if (!ok) throw new Error("Accès réservé aux administrateurs");
}

/** Active ou suspend l'accès d'un utilisateur à la plateforme. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => activeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ actif: data.actif })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    // Un compte suspendu ne doit plus pouvoir se connecter
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.actif ? "none" : "876000h",
    });

    await supabaseAdmin.from("activites_utilisateurs").insert({
      utilisateur_id: context.userId,
      type_action: data.actif ? "user_active" : "user_suspended",
      description: data.actif ? "Validation d'un compte utilisateur" : "Suspension d'un compte utilisateur",
      metadata: { target_user_id: data.userId },
    });

    return { ok: true };
  });

/** Supprime définitivement un compte utilisateur (jamais les fiches membres). */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Le Super Admin Principal ne peut pas être supprimé
    const { data: principal } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.userId)
      .eq("role", "super_admin_principal")
      .maybeSingle();
    if (principal) throw new Error("Le Super Admin Principal ne peut pas être supprimé");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("nom,email")
      .eq("id", data.userId)
      .maybeSingle();

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_departements").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activites_utilisateurs").insert({
      utilisateur_id: context.userId,
      type_action: "user_deleted",
      description: `Suppression du compte ${prof?.nom ?? prof?.email ?? data.userId}`,
      metadata: { target_user_id: data.userId, email: prof?.email ?? null },
    });

    return { ok: true };
  });
