import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Student } from "./em";
const cls = z.enum(["CPEM", "P1", "P2", "P3", "P4", "P5"]);
async function authorize(db: SupabaseClient<Database>, principal = false) {
  const { data, error } = await db.rpc(principal ? "em_principal" : "em_access");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux personnes habilitées de l’École du Ministère.");
}
function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(`${error.message}${error.code ? ` (${error.code})` : ""}`);
}
export const emContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context.supabase);
    const db = context.supabase;
    const [years, assignments, principal, users, mentors, roles] = await Promise.all([
      db.from("em_years").select("*").order("debut", { ascending: false }),
      db.from("em_assignments").select("*"),
      db.rpc("em_principal"),
      db.rpc("em_users"),
      db.from("em_mentors").select("*"),
      db.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    for (const q of [years, assignments, principal, users, mentors, roles]) check(q.error);
    return {
      years: years.data ?? [],
      assignments: assignments.data ?? [],
      principal: principal.data === true,
      users: (users.data ?? []) as unknown as {
        id: string;
        nom: string | null;
        email: string | null;
      }[],
      mentors: mentors.data ?? [],
      local: (roles.data ?? []).some((r) => r.role === "admin_temple"),
      userId: context.userId,
    };
  });
export const emStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase);
    const r = await context.supabase.rpc("em_directory", { _year: data.year });
    check(r.error);
    return (r.data ?? []) as unknown as Student[];
  });
export const emReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase);
    const rows = [];
    for (let start = 0; ; start += 500) {
      let q = context.supabase
        .from("em_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, start + 499);
      if (data.year) q = q.eq("year_id", data.year);
      const r = await q;
      check(r.error);
      rows.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < 500) break;
    }
    return rows;
  });
export const emHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase);
    const r = await context.supabase
      .from("em_audit")
      .select("*")
      .eq("entity_id", data.id)
      .order("created_at", { ascending: false });
    check(r.error);
    return r.data ?? [];
  });
export const emCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ temple: z.string().uuid(), q: z.string().max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    let q = context.supabase
      .from("membres")
      .select("id,nom,prenoms,matricule,temple_id")
      .eq("temple_id", data.temple)
      .order("nom")
      .limit(100);
    const term = data.q.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
    if (term) q = q.or(`nom.ilike.%${term}%,prenoms.ilike.%${term}%,matricule.ilike.%${term}%`);
    const r = await q;
    check(r.error);
    return r.data ?? [];
  });
export const emSaveYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ nom: z.string().trim().min(1), debut: z.string().date(), fin: z.string().date() })
      .refine((v) => v.fin > v.debut, { message: "La fin doit suivre le début." })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    const r = await context.supabase.from("em_years").insert(data).select().single();
    check(r.error);
    return r.data;
  });
export const emYearAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["activer", "archiver"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    const r =
      data.action === "activer"
        ? await context.supabase.rpc("em_activate_year", { _id: data.id })
        : await context.supabase
            .from("em_years")
            .update({ archive: true, actif: false })
            .eq("id", data.id);
    check(r.error);
    return { ok: true };
  });
export const emSaveEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        membre_id: z.string().uuid(),
        year_id: z.string().uuid(),
        classe: cls,
        admission: z.string().date(),
        statut: z.enum(["actif", "suspendu", "transfere", "diplome", "abandonne"]),
        notes: z.string().max(10000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    const { id, ...row } = data;
    if (id) {
      const previous = await context.supabase.from("em_enrollments").select("membre_id,year_id").eq("id", id).single();
      check(previous.error);
      if (!previous.data || previous.data.membre_id !== row.membre_id) throw new Error("La fiche membre liée ne peut pas être remplacée.");
      if (previous.data.year_id !== row.year_id) {
        const transfer = await context.supabase.rpc("em_transfer_year", {_id:id,_year:row.year_id,_classe:row.classe,_admission:row.admission,_statut:row.statut,_notes:row.notes});
        check(transfer.error);
        const enrolled = await context.supabase.from("em_enrollments").select().eq("id", transfer.data ?? "").single();
        check(enrolled.error);
        return enrolled.data;
      }
    }
    const r = id
      ? await context.supabase.from("em_enrollments").update(row).eq("id", id).select().single()
      : await context.supabase.from("em_enrollments").insert(row).select().single();
    check(r.error);
    return r.data;
  });
export const emAssignMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        year_id: z.string().uuid(),
        classe: cls,
        actif: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    const db = context.supabase;
    const user = await db
      .from("profiles")
      .select("id")
      .eq("id", data.user_id)
      .eq("actif", true)
      .single();
    check(user.error);
    check(
      (
        await db
          .from("em_mentors")
          .upsert({ user_id: data.user_id }, { onConflict: "user_id", ignoreDuplicates: true })
      ).error,
    );
    const r = await db
      .from("em_assignments")
      .upsert(data, { onConflict: "user_id,year_id,classe" });
    check(r.error);
    return { ok: true };
  });
export const emSaveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        year_id: z.string().uuid(),
        enrollment_id: z.string().uuid().nullable(),
        temple_id: z.string().uuid().nullable(),
        classe: cls,
        type: z.enum(["priere", "cellule", "garde"]),
        statut: z.enum(["brouillon", "soumis"]),
        contenu: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase);
    const { id, ...row } = data;
    const contenu = row.contenu as Database["public"]["Tables"]["em_reports"]["Insert"]["contenu"];
    const r = id
      ? await context.supabase
          .from("em_reports")
          .update({ contenu, statut: row.statut })
          .eq("id", id)
          .select()
          .single()
      : await context.supabase
          .from("em_reports")
          .insert({ ...row, contenu, auteur_id: context.userId })
          .select()
          .single();
    check(r.error);
    return r.data;
  });
export const emReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        statut: z.enum(["examen", "complement", "reserve", "valide", "rejete", "brouillon"]),
        observations: z.string().max(10000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, true);
    const r = await context.supabase
      .from("em_reports")
      .update({ statut: data.statut, observations: data.observations })
      .eq("id", data.id)
      .select()
      .single();
    check(r.error);
    return r.data;
  });
