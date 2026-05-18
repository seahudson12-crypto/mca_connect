import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, UserX, Sparkles, TrendingUp, CalendarCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { categoryLabel, culteTypeLabel } from "@/lib/constants";
import { useActiveTemple } from "@/hooks/use-active-temple";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { activeTempleId } = useActiveTemple();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(startOfDay(new Date()), 30), "yyyy-MM-dd");

      const [{ count: totalMembres }, { data: nouvellesAmes }, { data: cultesRecents }, { data: presencesRecentes }] = await Promise.all([
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

      // Group presences by date
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
        nouvellesAmes: (nouvellesAmes as unknown as { length: number })?.length ?? 0,
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
      </div>

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
