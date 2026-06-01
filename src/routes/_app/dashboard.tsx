import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, UserCheck, UserX, TrendingUp, CalendarCheck, Building2, Sparkles, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { culteTypeLabel } from "@/lib/constants";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { useAuth } from "@/hooks/use-auth";
import { formatXof } from "@/lib/audit";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
        <Tabs defaultValue="temple">
          <TabsList>
            <TabsTrigger value="temple"><Building2 className="h-4 w-4 mr-1" />Temple actif</TabsTrigger>
            <TabsTrigger value="global"><TrendingUp className="h-4 w-4 mr-1" />Vue globale</TabsTrigger>
          </TabsList>
          <TabsContent value="temple" className="mt-4"><TempleDashboard /></TabsContent>
          <TabsContent value="global" className="mt-4"><GlobalDashboard /></TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
      </div>
      <TempleDashboard />
    </div>
  );
}

function TempleDashboard() {
  const { activeTempleId } = useActiveTemple();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(startOfDay(new Date()), 30), "yyyy-MM-dd");

      const [{ count: totalMembres }, { count: nouvellesAmes }, { data: cultesRecents }, { data: presencesRecentes }] = await Promise.all([
        supabase.from("membres").select("*", { count: "exact", head: true }).eq("actif", true).eq("temple_id", activeTempleId!),
        supabase.from("membres").select("*", { count: "exact", head: true }).eq("categorie", "nouvelles_ames").eq("temple_id", activeTempleId!),
        supabase.from("cultes").select("*").eq("temple_id", activeTempleId!).gte("date", sevenDaysAgo).order("date", { ascending: false }).limit(10),
        supabase.from("presences").select("statut, culte:cultes!inner(date, type_culte, temple_id)").eq("cultes.temple_id", activeTempleId!).gte("cultes.date", sevenDaysAgo),
      ]);

      const culteAujourdhui = await supabase.from("cultes").select("id").eq("temple_id", activeTempleId!).eq("date", today).maybeSingle();
      let presentToday = 0, absentToday = 0;
      if (culteAujourdhui.data?.id) {
        const { data: pToday } = await supabase.from("presences").select("statut").eq("culte_id", culteAujourdhui.data.id);
        presentToday = pToday?.filter((p) => p.statut === "present").length ?? 0;
        absentToday = pToday?.filter((p) => p.statut === "absent").length ?? 0;
      }

      const byDate: Record<string, { present: number; absent: number }> = {};
      (presencesRecentes ?? []).forEach((p: { statut: string; culte: { date: string } | null }) => {
        const d = p.culte?.date;
        if (!d) return;
        if (!byDate[d]) byDate[d] = { present: 0, absent: 0 };
        if (p.statut === "present") byDate[d].present++;
        else if (p.statut === "absent") byDate[d].absent++;
      });
      const chartData = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([d, v]) => ({ date: format(new Date(d), "dd/MM"), ...v }));

      const totalP = chartData.reduce((s, x) => s + x.present, 0);
      const totalA = chartData.reduce((s, x) => s + x.absent, 0);
      const taux = totalP + totalA > 0 ? Math.round((totalP * 100) / (totalP + totalA)) : 0;

      return {
        totalMembres: totalMembres ?? 0,
        nouvellesAmes: nouvellesAmes ?? 0,
        presentToday,
        absentToday,
        taux,
        chartData,
        cultesRecents: cultesRecents ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membres actifs" value={isLoading ? "—" : data!.totalMembres} icon={Users} />
        <StatCard label="Présents aujourd'hui" value={isLoading ? "—" : data!.presentToday} icon={UserCheck} variant="success" />
        <StatCard label="Absents aujourd'hui" value={isLoading ? "—" : data!.absentToday} icon={UserX} variant="warning" />
        <StatCard label="Taux de présence (30j)" value={isLoading ? "—" : `${data!.taux}%`} icon={TrendingUp} variant="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 border-0 shadow-elegant">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Évolution des présences</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="present" stroke="var(--primary)" strokeWidth={3} name="Présents" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="absent" stroke="var(--destructive)" strokeWidth={2} name="Absents" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 border-0 shadow-elegant">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Cultes récents</h2>
          </div>
          <div className="space-y-3">
            {(data?.cultesRecents ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun culte récent</div>
            )}
            {(data?.cultesRecents ?? []).slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{culteTypeLabel(c.type_culte)}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(c.date), "dd MMM yyyy", { locale: fr })}</div>
                </div>
                <div className="text-xs text-gold font-semibold">{c.theme_principal ? "✓" : "—"}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function GlobalDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-global"],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { data: temples } = await supabase.from("temples").select("id,nom_temple").eq("actif", true).order("nom_temple");
      const tlist = (temples ?? []) as Array<{ id: string; nom_temple: string }>;

      const rows = await Promise.all(tlist.map(async (t) => {
        const [{ count: membres }, { count: nouvelles }, { data: presences }, { data: fin }] = await Promise.all([
          supabase.from("membres").select("*", { count: "exact", head: true }).eq("actif", true).eq("temple_id", t.id),
          supabase.from("membres").select("*", { count: "exact", head: true }).eq("categorie", "nouvelles_ames").eq("temple_id", t.id),
          supabase.from("presences").select("statut, culte:cultes!inner(date,temple_id)").eq("cultes.temple_id", t.id).gte("cultes.date", monthStart),
          supabase.from("finances_culte").select("offrande,dime,action_grace,semence,contribution_speciale,depense,solde, culte:cultes!inner(date,temple_id)").eq("culte.temple_id", t.id).gte("culte.date", monthStart),
        ]);
        const present = (presences ?? []).filter((p: { statut: string }) => p.statut === "present").length;
        const absent = (presences ?? []).filter((p: { statut: string }) => p.statut === "absent").length;
        const taux = present + absent > 0 ? Math.round((present * 100) / (present + absent)) : 0;
        const recettes = (fin ?? []).reduce((s: number, r: { offrande: number; dime: number; action_grace: number; semence: number; contribution_speciale: number }) =>
          s + Number(r.offrande) + Number(r.dime) + Number(r.action_grace) + Number(r.semence) + Number(r.contribution_speciale), 0);
        const depenses = (fin ?? []).reduce((s: number, r: { depense: number }) => s + Number(r.depense), 0);
        return {
          id: t.id,
          temple: t.nom_temple,
          court: t.nom_temple.replace(/^MCA\s+/, "").split("–")[0].trim(),
          membres: membres ?? 0,
          nouvelles: nouvelles ?? 0,
          present, absent, taux,
          recettes, depenses, solde: recettes - depenses,
        };
      }));

      const totals = rows.reduce((acc, r) => ({
        membres: acc.membres + r.membres,
        nouvelles: acc.nouvelles + r.nouvelles,
        present: acc.present + r.present,
        absent: acc.absent + r.absent,
        recettes: acc.recettes + r.recettes,
        depenses: acc.depenses + r.depenses,
      }), { membres: 0, nouvelles: 0, present: 0, absent: 0, recettes: 0, depenses: 0 });

      return { rows, totals };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Chargement…</div>;

  const tauxGlobal = data.totals.present + data.totals.absent > 0
    ? Math.round((data.totals.present * 100) / (data.totals.present + data.totals.absent)) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membres (tous temples)" value={data.totals.membres} icon={Users} />
        <StatCard label="Nouvelles âmes" value={data.totals.nouvelles} icon={Sparkles} variant="gold" />
        <StatCard label="Taux présence (mois)" value={`${tauxGlobal}%`} icon={TrendingUp} variant="success" />
        <StatCard label="Solde global (mois)" value={formatXof(data.totals.recettes - data.totals.depenses)} icon={Wallet} />
      </div>

      <Card className="p-5 border-0 shadow-elegant">
        <h2 className="mb-4 text-base font-semibold">Comparatif présences par temple (mois en cours)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="court" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="present" fill="var(--primary)" name="Présents" />
            <Bar dataKey="absent" fill="var(--destructive)" name="Absents" />
            <Bar dataKey="nouvelles" fill="var(--gold)" name="Nouvelles âmes" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 border-0 shadow-elegant">
        <h2 className="mb-4 text-base font-semibold">Comparatif finances par temple (mois en cours)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="court" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
              formatter={(v: number) => formatXof(v)} />
            <Legend />
            <Bar dataKey="recettes" fill="var(--success, #10b981)" name="Recettes" />
            <Bar dataKey="depenses" fill="var(--destructive)" name="Dépenses" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b"><h2 className="text-base font-semibold">Détail par temple</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Temple</th>
                <th className="px-4 py-2 text-right">Membres</th>
                <th className="px-4 py-2 text-right">Nouvelles âmes</th>
                <th className="px-4 py-2 text-right">Présents</th>
                <th className="px-4 py-2 text-right">Taux</th>
                <th className="px-4 py-2 text-right">Recettes</th>
                <th className="px-4 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{r.temple}</td>
                  <td className="px-4 py-2 text-right">{r.membres}</td>
                  <td className="px-4 py-2 text-right">{r.nouvelles}</td>
                  <td className="px-4 py-2 text-right text-success">{r.present}</td>
                  <td className="px-4 py-2 text-right font-semibold">{r.taux}%</td>
                  <td className="px-4 py-2 text-right">{formatXof(r.recettes)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatXof(r.solde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
