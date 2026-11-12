import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PilotageErrorBoundary } from "@/components/PilotageErrorBoundary";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users, Sparkles, UserCheck, Network, GraduationCap, RefreshCw, ArrowUpRight, Bell, Target, History, Globe2, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { PERIODS, type PilotagePeriod } from "@/lib/pilotage";
import { getPilotage } from "@/lib/pilotage.functions";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { useAuth } from "@/hooks/use-auth";

export type PilotageSearch = { period: PilotagePeriod; scope: string; q: string };

const DATASET_LABELS: Record<string,string> = { countries:"Pays", members:"Membres", services:"Cultes", departments:"Départements", programs:"Programmes de formation", goals:"Objectifs", activities:"Activités des départements", requests:"Demandes de validation", logs:"Journal d’activité", attendance:"Présences", enrollments:"Inscriptions aux formations", finances:"Finances des cultes", payments:"Versements", reliquats:"Reliquats", audit:"Historique", names:"Noms des utilisateurs" };

// Never hide the real cause: show the exact message returned by the server or the database.
export function describePilotageError(e: unknown): string {
  if (e instanceof Response) return `Réponse HTTP ${e.status}${e.statusText ? ` ${e.statusText}` : ""}`;
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function fmt(value: string | number | Date | null | undefined, pattern: string) {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : format(d, pattern, { locale: fr });
}

export function PilotageDashboard({ search }: { search: PilotageSearch }) {
  return <PilotageErrorBoundary key={`${search.period}:${search.scope}`} onReset={()=>{}}><PilotageContent search={search}/></PilotageErrorBoundary>;
}

function PilotageContent({ search }: { search: PilotageSearch }) {
  const fetchPilotage = useServerFn(getPilotage);
  const { user } = useAuth();
  const query = useQuery({queryKey:["pilotage",user?.id,search.period,search.scope],queryFn:()=>fetchPilotage({data:{period:search.period,scope:search.scope}}),staleTime:60000,retry:2,retryDelay:1500,placeholderData:keepPreviousData,enabled:!!user?.id});
  const navigate = useNavigate();
  if (query.error) console.error("[pilotage] chargement échoué :", describePilotageError(query.error), query.error);
  if (!query.data) {
    if (query.isError) return <div role="alert" className="space-y-4"><h1 className="text-2xl font-bold">CENTRE DE PILOTAGE MCA</h1><div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5"><h2 className="font-semibold">Impossible de charger le Centre de Pilotage MCA</h2><p className="text-sm text-muted-foreground">Aucun chiffre n’a été remplacé par zéro. Détail technique :</p><pre className="whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">{describePilotageError(query.error)}</pre><div className="flex flex-wrap gap-2"><Button onClick={()=>void query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching?"animate-spin":""}`}/>Réessayer</Button>{search.scope!=="global" && <Button variant="outline" onClick={()=>void navigate({to:"/dashboard",search:{period:search.period,scope:"global",q:""}})}><Globe2 className="mr-2 h-4 w-4"/>Revenir à MCA GLOBAL</Button>}</div></div></div>;
    return <div role="status" className="space-y-4"><h1 className="text-2xl font-bold">CENTRE DE PILOTAGE MCA</h1><p className="text-muted-foreground">Chargement des données autorisées…</p><div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{Array.from({length:6},(_,i)=><div key={i} className="h-32 animate-pulse rounded-lg bg-muted"/>)}</div></div>;
  }
  const data = query.data;
  const { refetch, isFetching } = query;
  const isRefetchError = query.isError;
  const { setActiveTempleId } = useActiveTemple();
  const update = (value:Partial<PilotageSearch>) => navigate({to:"/dashboard",search:prev=>({period:prev.period ?? "30d",scope:prev.scope ?? "global",q:prev.q ?? "",...value})});
  const scopeLabel = data.scopeLabel;
  const off = (...keys:string[]) => keys.some(k => data.unavailable.includes(k));
  const NA = "Non disponible";
  const delta = (value:number|null,unit="") => value === null ? "Comparaison non disponible" : `${value>0?"+":""}${value}${unit} vs période précédente`;
  const filtered = data.temples.filter(t=>`${t.nom_temple} ${t.pays ?? ""}`.toLocaleLowerCase("fr").includes(search.q.toLocaleLowerCase("fr")));
  const selectTemple = (id:string) => { setActiveTempleId(id); void update({scope:id,q:""}); };
  const alerts = [
    {label:"Demandes de validation",value:data.alerts.requests,to:"/demandes"},
    {label:"Rapports de cultes en brouillon",value:data.alerts.reports,to:"/rapports"},
    {label:"Activités en retard",value:data.alerts.lateActivities,to:"/departements"},
    {label:"Absences aux 3 derniers cultes de la période",value:data.alerts.repeatedAbsences,to:"/alertes"},
  ];
  return <div className="min-w-0 space-y-8">
    <section className="space-y-4 border-b pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Globe2 className="h-4 w-4"/>{scopeLabel}</div><h1 className="text-2xl font-bold lg:text-3xl">CENTRE DE PILOTAGE MCA</h1><p className="mt-2 text-sm text-muted-foreground">{fmt(data.bounds.start,"dd MMM yyyy")} — {fmt(data.bounds.end,"dd MMM yyyy")}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Select value={search.period} onValueChange={value=>void update({period:value as PilotagePeriod})}><SelectTrigger aria-label="Période" className="w-44"><SelectValue/></SelectTrigger><SelectContent>{PERIODS.map(p=><SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select><Button aria-label="Actualiser le centre de pilotage" title="Actualiser" variant="outline" size="icon" disabled={isFetching} onClick={()=>void refetch()}><RefreshCw className={`h-4 w-4 ${isFetching?"animate-spin":""}`}/></Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Dernière actualisation : {fmt(data.updatedAt,"dd/MM/yyyy HH:mm:ss")}</p>{search.scope!=="global" && <Button variant="ghost" size="sm" onClick={()=>void update({scope:"global",q:""})}><Globe2 className="mr-2 h-4 w-4"/>Revenir à MCA GLOBAL</Button>}</div>
      {isRefetchError && <p role="alert" className="text-sm text-destructive">Actualisation échouée ({describePilotageError(query.error)}). Les chiffres affichés datent de la dernière actualisation réussie. <Button variant="link" onClick={()=>void refetch()}>Réessayer</Button></p>}
      {data.notice && <p role="status" className="rounded-md border bg-muted p-3 text-sm">{data.notice}</p>}
      {data.unavailable.length>0 && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>Certaines sections n’ont pas pu être chargées : {data.unavailable.map(k=>DATASET_LABELS[k] ?? k).join(", ")}. Elles affichent « Non disponible » ; les autres sont à jour. <Button variant="link" className="h-auto p-0" onClick={()=>void refetch()}>Réessayer</Button></p><details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Détail technique</summary><ul className="mt-1 space-y-1 text-xs">{data.errors.map(e=><li key={e.key} className="break-words"><strong>{DATASET_LABELS[e.key] ?? e.key}</strong> — {e.message}</li>)}</ul></details></div>}
    </section>
    {(search.scope==="global" || search.scope.startsWith("country:")) && data.countries.length>0 && <section className="space-y-4 border-b pb-6"><h2 className="text-lg font-semibold">Pays</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.countries.map(c=><article key={c.id} className="min-w-0 rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{c.nom}</h3>{search.scope==="global" && <Button variant="ghost" size="sm" onClick={()=>void update({scope:`country:${c.id}`,q:""})}>Voir<ArrowUpRight className="ml-1 h-4 w-4"/></Button>}</div><dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Temples</dt><dd className="font-semibold">{c.temples}</dd></div><div><dt className="text-xs text-muted-foreground">Membres</dt><dd className="font-semibold">{off("members")?"—":c.members}</dd></div><div><dt className="text-xs text-muted-foreground">Présence</dt><dd className="font-semibold">{c.presence===null?"—":`${c.presence}%`}</dd></div></dl>{c.temples===0 && <p className="mt-2 text-xs text-muted-foreground">Aucun temple enregistré dans ce pays.</p>}<Link to="/temples" search={{ajout:c.id}} className="mt-3 inline-flex text-xs font-medium text-primary">+ Ajouter un temple</Link></article>)}</div></section>}
    <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Pays enregistrés" value={data.stats.countries ?? "—"} hint={data.stats.countries===null?NA:"Pays du périmètre consulté"} icon={Globe2}/>
      <StatCard label="Temples enregistrés" value={data.stats.temples} hint={`${data.stats.activeTemples} actifs · périmètre consulté`} icon={Building2}/>
      <StatCard label="Membres inscrits" value={off("members")?"—":data.stats.members} hint={off("members")?NA:`${data.stats.activeMembers} actifs · ${data.stats.newMembers} inscriptions sur la période`} icon={Users}/>
      <StatCard label="Nouvelles âmes · période" value={off("members")?"—":data.stats.souls} hint={off("members")?NA:delta(data.stats.soulsDelta)} icon={Sparkles} variant="gold"/>
      <StatCard label="Taux de présence · période" value={off("services","attendance","members")||data.stats.presence.rate===null?"—":`${data.stats.presence.rate}%`} hint={off("services","attendance","members")?NA:`${data.stats.presence.present} pointages présents · ${data.stats.services} cultes · ${delta(data.stats.presenceDelta," points")}`} icon={UserCheck} variant="success"/>
      <StatCard label="Départements actifs" value={off("departments")?"—":data.stats.departments} hint={off("departments")?NA:"État actuel · périmètre consulté"} icon={Network}/>
      <StatCard label="Membres en formation" value={off("programs","enrollments")?"—":data.stats.training} hint={off("programs","enrollments")?NA:"Inscrits ou en cours · programmes actifs"} icon={GraduationCap}/>
    </section>
    <section className="min-w-0 border-b pb-6"><h2 className="mb-1 text-lg font-semibold">Évolution des indicateurs</h2><p className="mb-5 text-xs text-muted-foreground">Inscriptions enregistrées, nouvelles âmes actuellement classées et pointages de présence. L’effectif historique total n’est pas disponible.</p>{data.chart.length ? <div className="h-72 min-w-0 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.chart} margin={{top:10,right:12,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="date" tickFormatter={d=>fmt(d,"dd/MM")} stroke="var(--muted-foreground)" fontSize={11} minTickGap={28}/><YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false}/><Tooltip labelFormatter={d=>fmt(String(d),"dd MMM yyyy")} contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8}}/><Legend wrapperStyle={{fontSize:12}}/><Line type="linear" dataKey="presents" name="Pointages présents" stroke="var(--primary)" strokeWidth={2} dot={false}/><Line type="linear" dataKey="inscriptions" name="Inscriptions" stroke="var(--success)" strokeWidth={2} dot={false}/><Line type="linear" dataKey="nouvelles" name="Nouvelles âmes" stroke="var(--gold)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div> : <p className="py-8 text-sm text-muted-foreground">Aucune inscription ni aucun culte enregistré sur cette période. Aucun historique d’effectif n’est reconstitué.</p>}</section>
    {(search.scope==="global" || search.scope.startsWith("country:")) && <section className="space-y-4 border-b pb-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">État des temples</h2><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Rechercher un temple" placeholder="Rechercher un temple…" className="pl-9" value={search.q} onChange={e=>void update({q:e.target.value})}/></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(t=><article key={t.id} className="min-w-0 rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-2"><h3 className="break-words font-semibold">{t.nom_temple}</h3><Button aria-label={`Consulter ${t.nom_temple}`} title="Consulter ce temple" variant="ghost" size="icon" className="shrink-0" onClick={()=>selectTemple(t.id)}><ArrowUpRight className="h-4 w-4"/></Button></div><p className="mb-4 text-xs text-muted-foreground">{t.pays ?? "Pays non renseigné"} · {t.actif?"Actif":"Inactif"}</p><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Membres inscrits</dt><dd className="font-semibold">{t.members} <span className="text-xs font-normal text-muted-foreground">({t.activeMembers} actifs)</span></dd></div><div><dt className="text-xs text-muted-foreground">Présence · période</dt><dd className="font-semibold">{t.presence===null?"—":`${t.presence}%`}</dd></div><div><dt className="text-xs text-muted-foreground">Activités · période</dt><dd>{t.activities}</dd></div><div><dt className="text-xs text-muted-foreground">Rapports validés</dt><dd>{t.totalReports?`${t.reports} / ${t.totalReports}`:"—"}</dd></div></dl></article>)}</div>{!filtered.length && <p className="text-sm text-muted-foreground">Aucun temple dans ce périmètre ou pour cette recherche.</p>}</section>}
    <section className="grid gap-8 xl:grid-cols-2">
      <div className="min-w-0"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5 text-gold"/>Alertes et validations</h2><Link to="/alertes" className="text-xs font-medium text-primary">Alertes <ArrowUpRight className="inline h-3 w-3"/></Link></div><div className="divide-y">{alerts.map(a=><Link key={a.to} to={a.to} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{a.label}</span><Badge variant={a.value?"default":"secondary"}>{a.value}</Badge></Link>)}{data.alerts.finance.map(f=><Link key={f.op} to={f.op==="mission_offering"?"/finances/missions":"/finances/cotisations"} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{f.op==="mission_offering"?"Offrandes missionnaires":"Cotisations sociales"}<span className="block text-xs text-muted-foreground">Reliquats dont la date prévue est dépassée</span></span><Badge variant={f.count?"default":"secondary"}>{f.count}</Badge></Link>)}</div><p className="mt-2 text-xs text-muted-foreground">Activités en retard : état actuel. Les autres indicateurs suivent la période sélectionnée.</p></div>
      <div className="min-w-0"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><Target className="h-5 w-5 text-primary"/>Progression des objectifs MCA</h2><Link to="/objectifs" className="text-xs font-medium text-primary">Objectifs <ArrowUpRight className="inline h-3 w-3"/></Link></div><p className="mb-3 text-xs text-muted-foreground">Objectifs annuels {data.bounds.year} · progression au {fmt(data.bounds.end,"dd/MM/yyyy")}</p>{!data.objectives.length && <p className="py-6 text-sm text-muted-foreground">Aucun objectif enregistré pour {data.bounds.year} dans ce périmètre.</p>}<div className="space-y-5">{data.objectives.map(o=><div key={o.id}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{o.label}</span><Badge variant="secondary">{o.rate===null?"Non disponible":o.rate>=100?"Atteint":"En cours"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{o.temple} · {o.actual===null?"—":o.actual.toLocaleString("fr-FR")} / {o.target.toLocaleString("fr-FR")} · {o.rate===null?"—":`${o.rate}%`}</p>{o.rate!==null && <Progress value={Math.min(100,Math.max(0,o.rate))} className="mt-2 h-2"/>}</div>)}</div></div>
    </section>
    <section className="border-t pt-6"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5 text-primary"/>Activité récente</h2><Link to="/historique" className="text-xs font-medium text-primary">Historique <ArrowUpRight className="inline h-3 w-3"/></Link></div>{!data.recent.length && <p className="text-sm text-muted-foreground">Aucune action rattachée à ce périmètre sur la période sélectionnée.</p>}<div className="divide-y">{data.recent.map(r=><div key={r.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[140px_1fr_1fr]"><time className="text-xs text-muted-foreground">{fmt(r.date,"dd/MM/yyyy HH:mm")}</time><div><p className="break-words font-medium">{r.action}</p><p className="text-xs text-muted-foreground">{r.user}</p></div><p className="break-words text-xs text-muted-foreground">{r.temple}</p></div>)}</div></section>
  </div>;
}