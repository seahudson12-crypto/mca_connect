import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { periodBounds, presenceRate } from "./pilotage";

// Keep pagination generic without importing a privileged client or returning SDK values.
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw new Error("Impossible de charger les données du centre de pilotage. Réessayez.");
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}

export const getPilotage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ period: z.enum(["today", "7d", "30d", "3m", "year"]), scope: z.string().max(200).default("global") }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const [roles, profile] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", context.userId),
      db.from("profiles").select("actif").eq("id", context.userId).maybeSingle(),
    ]);
    if (roles.error || profile.error) throw new Error("Impossible de vérifier votre accès.");
    if (!roles.data?.some(r => r.role === "super_admin_principal") || profile.data?.actif === false) throw new Error("Accès non autorisé au Centre de Pilotage MCA.");
    const bounds = periodBounds(data.period);
    const visible = await allRows((from, to) => db.from("temples").select("id,nom_temple,pays,actif").order("id").range(from, to));
    // The temples policy also has a super-admin manage policy: verify each temple explicitly.
    const checks = await Promise.all(visible.map(t => db.rpc("can_access_temple", { _user_id: context.userId, _temple_id: t.id })));
    if (checks.some(c => c.error)) throw new Error("Impossible de vérifier le périmètre autorisé.");
    const allowed = visible.filter((_, i) => checks[i].data === true);
    const selected = data.scope === "global" ? allowed : data.scope.startsWith("country:") ? allowed.filter(t => t.pays === data.scope.slice(8)) : allowed.filter(t => t.id === data.scope);
    if (data.scope !== "global" && !selected.length) throw new Error("Ce périmètre n’est pas disponible pour votre compte.");
    const ids = selected.map(t => t.id);
    const empty = ids.length === 0;
    const [members, services, departments, programs, goals, activities, requests, logs] = await Promise.all([
      empty ? [] : allRows((a,b) => db.from("membres").select("id,temple_id,actif,categorie,date_ajout").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("cultes").select("id,temple_id,date,type_culte,statut").in("temple_id",ids).gte("date",`${bounds.year-1}-01-01`).lte("date",bounds.end).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("departements").select("id,temple_id,actif").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("programmes_formation").select("id,temple_id,actif").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("objectifs_temple").select("id,temple_id,libelle,type_objectif,valeur_cible,annee").in("temple_id",ids).eq("annee",bounds.year).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("activites_departement").select("id,temple_id,titre,date_prevue,date_realisation,statut").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("role_requests").select("id,temple_id,statut").in("temple_id",ids).eq("statut","en_attente").order("id").range(a,b)),
      // Do not project before/after values, email, metadata or descriptions from the audit trail.
      empty ? [] : allRows((a,b) => db.from("activites_utilisateurs").select("id,temple_id,type_action,utilisateur_id,created_at").in("temple_id",ids).gte("created_at",bounds.start).lt("created_at",`${bounds.end}T23:59:59.999Z`).order("id").range(a,b)),
    ]);
    const serviceIds = services.map(s => s.id);
    const programIds = programs.filter(p => p.actif).map(p => p.id);
    const [attendance, enrollments, finances, payments, overrides, exclusions, tariffs, audit] = await Promise.all([
      serviceIds.length ? allRows((a,b) => db.from("presences").select("id,culte_id,membre_id,statut").in("culte_id",serviceIds).order("id").range(a,b)) : [],
      programIds.length ? allRows((a,b) => db.from("inscriptions_formation").select("id,membre_id,statut").in("programme_id",programIds).in("statut",["inscrit","en_cours"]).order("id").range(a,b)) : [],
      serviceIds.length ? allRows((a,b) => db.from("finances_culte").select("id,culte_id,offrande,dime").in("culte_id",serviceIds).order("id").range(a,b)) : [],
      empty ? [] : allRows((a,b) => db.from("finance_paiements").select("id,temple_id,membre_id,op_type,periode,montant_paye,date_paiement").in("temple_id",ids).gte("date_paiement",bounds.start).lte("date_paiement",bounds.end).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("finance_montants_membre").select("id,temple_id,membre_id,op_type,montant_prevu").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("finance_liste_membre").select("id,membre_id,op_type,inclus").in("temple_id",ids).order("id").range(a,b)),
      empty ? [] : allRows((a,b) => db.from("finance_baremes").select("id,temple_id,op_type,actif").in("temple_id",ids).order("id").range(a,b)),
      // Existing history has no temple column: only correlate visible entity IDs, never guess scope.
      allRows((a,b) => db.from("historique_modifications").select("id,table_modifiee,enregistrement_id,action,utilisateur_id,date_modification").gte("date_modification",bounds.start).lte("date_modification",`${bounds.end}T23:59:59.999Z`).order("id").range(a,b)),
    ]);
    const memberMap = new Map(members.map(m => [m.id,m]));
    const serviceMap = new Map(services.map(s => [s.id,s]));
    const filteredAttendance = attendance.filter(p => {
      const s = serviceMap.get(p.culte_id); const m = memberMap.get(p.membre_id);
      return s && (!m || m.temple_id === s.temple_id) && (s.type_culte === "dimanche" || m?.categorie !== "ecodim");
    });
    const currentServices = services.filter(s => s.date >= bounds.start);
    const inCurrent = new Set(currentServices.map(s => s.id));
    const currentPresence = filteredAttendance.filter(p => inCurrent.has(p.culte_id));
    const previousIds = new Set(services.filter(s => s.date >= bounds.previousStart && s.date <= bounds.previousEnd).map(s => s.id));
    const currentRate = presenceRate(currentPresence);
    const previousRate = presenceRate(filteredAttendance.filter(p => previousIds.has(p.culte_id))).rate;
    const souls = members.filter(m => m.categorie === "nouvelles_ames" && m.date_ajout >= bounds.start && m.date_ajout <= bounds.end).length;
    const previousSouls = members.filter(m => m.categorie === "nouvelles_ames" && m.date_ajout >= bounds.previousStart && m.date_ajout <= bounds.previousEnd).length;
    const newMembers = members.filter(m => m.date_ajout >= bounds.start && m.date_ajout <= bounds.end).length;
    const dates = [...new Set([...currentServices.map(s => s.date), ...members.filter(m => m.date_ajout >= bounds.start && m.date_ajout <= bounds.end).map(m => m.date_ajout)])].sort();
    const chart = dates.map(date => ({ date, presents: currentPresence.filter(p => serviceMap.get(p.culte_id)?.date === date).length, inscriptions: members.filter(m => m.date_ajout === date).length, nouvelles: members.filter(m => m.date_ajout === date && m.categorie === "nouvelles_ames").length }));
    const temples = selected.map(t => {
      const ts = currentServices.filter(s => s.temple_id === t.id); const set = new Set(ts.map(s => s.id));
      return { ...t, members: members.filter(m => m.temple_id === t.id).length, activeMembers: members.filter(m => m.temple_id === t.id && m.actif).length, presence: presenceRate(currentPresence.filter(p => set.has(p.culte_id))).rate, activities: activities.filter(a => a.temple_id === t.id && ((a.date_realisation ?? a.date_prevue ?? "") >= bounds.start) && ((a.date_realisation ?? a.date_prevue ?? "") <= bounds.end)).length, reports: ts.filter(s => s.statut !== "brouillon").length, totalReports: ts.length };
    });
    const objectiveLabels: Record<string,string> = { membres:"Membres actifs", nouvelles_ames:"Nouvelles âmes", presence_moyenne:"Présence moyenne", offrandes:"Offrandes", dimes:"Dîmes", baptemes:"Baptêmes", visiteurs:"Visiteurs", autre:"Autre" };
    const objectives = goals.map(g => {
      const yearServices = services.filter(s => s.temple_id === g.temple_id && s.date >= `${bounds.year}-01-01`);
      const yearIds = new Set(yearServices.map(s => s.id));
      const actual = g.type_objectif === "membres" ? members.filter(m => m.temple_id === g.temple_id && m.actif).length : g.type_objectif === "nouvelles_ames" ? members.filter(m => m.temple_id === g.temple_id && m.categorie === "nouvelles_ames" && m.date_ajout >= `${bounds.year}-01-01` && m.date_ajout <= bounds.end).length : g.type_objectif === "presence_moyenne" ? (yearServices.length ? Math.round(filteredAttendance.filter(p => yearIds.has(p.culte_id) && p.statut === "present").length/yearServices.length) : null) : g.type_objectif === "offrandes" || g.type_objectif === "dimes" ? finances.filter(f => yearIds.has(f.culte_id)).reduce((sum,f) => sum + Number(g.type_objectif === "offrandes" ? f.offrande : f.dime),0) : null;
      return { id:g.id, label:g.libelle || objectiveLabels[g.type_objectif], temple:selected.find(t => t.id===g.temple_id)?.nom_temple ?? "—", target:Number(g.valeur_cible), actual, rate:actual !== null && Number(g.valeur_cible)>0 ? Math.round(actual*100/Number(g.valeur_cible)) : null };
    });
    const repeatedAbsences = members.filter(m => {
      const last = currentServices.filter(s => s.temple_id === m.temple_id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
      return m.actif && last.length === 3 && last.every(s => filteredAttendance.some(p => p.culte_id === s.id && p.membre_id === m.id && p.statut === "absent"));
    }).length;
    const financeAlerts = (["social_contribution","mission_offering"] as const).map(op => {
      // Reuse the explicit member commitments, not invented arrears for missing expectations.
      const commitments = overrides.filter(o => o.op_type === op && Number(o.montant_prevu)>0 && memberMap.get(o.membre_id)?.actif && memberMap.get(o.membre_id)?.categorie !== "nouvelles_ames" && !exclusions.some(e => e.op_type === op && e.membre_id === o.membre_id && !e.inclus));
      return { op, count:commitments.filter(o => payments.filter(p => p.op_type === op && p.membre_id === o.membre_id && p.temple_id === o.temple_id).reduce((sum,p)=>sum+Number(p.montant_paye),0) < Number(o.montant_prevu)).length, available: commitments.length>0, configured:tariffs.some(t=>t.op_type===op && t.actif) };
    });
    const entities = new Map([...members.map(m=>[m.id,m.temple_id] as const),...services.map(s=>[s.id,s.temple_id] as const),...departments.map(d=>[d.id,d.temple_id] as const),...selected.map(t=>[t.id,t.id] as const),...payments.map(p=>[p.id,p.temple_id] as const),...goals.map(g=>[g.id,g.temple_id] as const)]);
    const recent = [...logs.map(l=>({id:l.id,date:l.created_at,action:l.type_action,userId:l.utilisateur_id,templeId:l.temple_id})),...audit.filter(a=>a.enregistrement_id && entities.has(a.enregistrement_id)).map(a=>({id:a.id,date:a.date_modification,action:`${a.action} · ${a.table_modifiee}`,userId:a.utilisateur_id,templeId:a.enregistrement_id ? entities.get(a.enregistrement_id) ?? null : null}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    const userIds = [...new Set(recent.map(r=>r.userId).filter((id): id is string => !!id))];
    const names = userIds.length ? await db.from("profiles").select("id,nom").in("id",userIds) : {data:[],error:null};
    if(names.error) throw new Error("Impossible de charger l’activité récente.");
    return { bounds, updatedAt:new Date().toISOString(), temples, stats:{ temples:selected.length, activeTemples:selected.filter(t=>t.actif).length, members:memberMap.size, activeMembers:members.filter(m=>m.actif).length, newMembers, souls, soulsDelta:souls-previousSouls, presence:currentRate, presenceDelta:currentRate.rate !== null && previousRate !== null ? currentRate.rate-previousRate : null, services:currentServices.length, departments:departments.filter(d=>d.actif).length, training:new Set(enrollments.map(e=>e.membre_id)).size }, chart, objectives, alerts:{ requests:requests.length, reports:currentServices.filter(s=>s.statut==="brouillon").length, lateActivities:activities.filter(a=>a.date_prevue && a.date_prevue<bounds.end && ["a_faire","en_cours"].includes(a.statut)).length, repeatedAbsences, finance:financeAlerts }, recent:recent.map(r=>({id:r.id,date:r.date,action:r.action,user:names.data?.find(n=>n.id===r.userId)?.nom || "Non disponible",temple:selected.find(t=>t.id===r.templeId)?.nom_temple ?? "—"})) };
  });