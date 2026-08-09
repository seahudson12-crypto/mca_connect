import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  templeId: z.string().uuid(),
  requestedRole: z.enum(["finances", "responsable_departement"]),
  nom: z.string().trim().max(120).optional().nullable(),
  prenoms: z.string().trim().max(120).optional().nullable(),
  telephone: z.string().trim().max(30).optional().nullable(),
  departementIds: z.array(z.string().uuid()).max(30).default([]),
});

/**
 * Enregistre une demande de rôle (Responsable département / Responsable finances)
 * juste après l'inscription. La demande est créée avec le statut « en_attente » :
 * elle n'accorde AUCUN droit tant qu'un administrateur ne l'a pas validée.
 */
export const submitRoleRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Le compte doit exister et l'email doit correspondre (anti-usurpation)
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userRes?.user) throw new Error("Compte introuvable");
    if ((userRes.user.email ?? "").toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Email non conforme au compte");
    }

    // Une seule demande en attente à la fois
    const { data: existing } = await supabaseAdmin
      .from("role_requests")
      .select("id")
      .eq("user_id", data.userId)
      .eq("statut", "en_attente")
      .maybeSingle();
    if (existing) return { ok: true, requestId: existing.id, already: true };

    const { data: inserted, error } = await supabaseAdmin
      .from("role_requests")
      .insert({
        user_id: data.userId,
        temple_id: data.templeId,
        requested_role: data.requestedRole,
        nom: data.nom ?? null,
        prenoms: data.prenoms ?? null,
        email: data.email,
        telephone: data.telephone ?? null,
        statut: "en_attente",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.requestedRole === "responsable_departement" && data.departementIds.length > 0) {
      // On ne conserve que les départements actifs du temple demandé
      const { data: depts } = await supabaseAdmin
        .from("departements")
        .select("id")
        .eq("temple_id", data.templeId)
        .eq("actif", true)
        .in("id", data.departementIds);
      const valid = (depts ?? []).map((d) => d.id);
      if (valid.length > 0) {
        await supabaseAdmin
          .from("role_request_departements")
          .insert(valid.map((id) => ({ request_id: inserted.id, departement_id: id })));
      }
    }

    return { ok: true, requestId: inserted.id, already: false };
  });
