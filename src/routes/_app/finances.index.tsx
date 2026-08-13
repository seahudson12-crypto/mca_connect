import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, TrendingUp, TrendingDown, Coins, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { CULTE_TYPES, culteTypeLabel } from "@/lib/constants";
import { formatXof } from "@/lib/audit";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/finances/")({ component: FinancesPage });

type FinanceRow = {
  id: string;
  culte_id: string;
  offrande: number;
  dime: number;
  action_grace: number;
  semence: number;
  contribution_speciale: number;
  depense: number;
  solde: number;
  observation: string | null;
  culte: { date: string; type_culte: string; theme_principal: string | null } | null;
};

function FinancesPage() {
  const { canSeeFinances, loading, defaultRoute } = useAuth();
  const { activeTempleId } = useActiveTemple();
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["finances", from, to, typeFilter, activeTempleId],
    enabled: canSeeFinances && !!activeTempleId,
    queryFn: async () => {
      let q = supabase
        .from("finances_culte")
        .select("*, culte:cultes!inner(date,type_culte,theme_principal,temple_id)")
        .eq("culte.temple_id", activeTempleId!)
        .gte("culte.date", from)
        .lte("culte.date", to);
      if (typeFilter !== "all") q = q.eq("culte.type_culte", typeFilter as never);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FinanceRow[];
    },
  });

  const stats = useMemo(() => {
    const recettes = rows.reduce(
      (s, r) => s + Number(r.offrande) + Number(r.dime) + Number(r.action_grace) + Number(r.semence) + Number(r.contribution_speciale),
      0,
    );
    const depenses = rows.reduce((s, r) => s + Number(r.depense), 0);
    const offrandes = rows.reduce((s, r) => s + Number(r.offrande), 0);
    const dimes = rows.reduce((s, r) => s + Number(r.dime), 0);
    return { recettes, depenses, solde: recettes - depenses, offrandes, dimes };
  }, [rows]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { mois: string; offrandes: number; dimes: number; depenses: number }> = {};
    rows.forEach((r) => {
      const d = r.culte?.date;
      if (!d) return;
      const key = format(new Date(d), "yyyy-MM");
      const label = format(new Date(d), "MMM yy", { locale: fr });
      byMonth[key] ||= { mois: label, offrandes: 0, dimes: 0, depenses: 0 };
      byMonth[key].offrandes += Number(r.offrande);
      byMonth[key].dimes += Number(r.dime);
      byMonth[key].depenses += Number(r.depense);
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [rows]);

  const exportExcel = () => {
    const data = rows
      .sort((a, b) => (a.culte?.date ?? "").localeCompare(b.culte?.date ?? ""))
      .map((r) => ({
        Date: r.culte?.date ?? "",
        Type: r.culte ? culteTypeLabel(r.culte.type_culte) : "",
        Thème: r.culte?.theme_principal ?? "",
        Offrandes: Number(r.offrande),
        Dîmes: Number(r.dime),
        "Actions de grâce": Number(r.action_grace),
        Semences: Number(r.semence),
        "Contributions spéciales": Number(r.contribution_speciale),
        Dépenses: Number(r.depense),
        Solde: Number(r.solde),
        Observations: r.observation ?? "",
      }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finances");
    XLSX.writeFile(wb, `finances-${from}_${to}.xlsx`);
  };

  if (loading) return null;
  if (!canSeeFinances) return <Navigate to={defaultRoute} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Finances</h1>
          <p className="text-sm text-muted-foreground">Tableau de bord financier des cultes</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> Excel
        </Button>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5"><Label>Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type de culte</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {CULTE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total offrandes" value={formatXof(stats.offrandes)} icon={Coins} variant="gold" />
        <StatCard label="Total dîmes" value={formatXof(stats.dimes)} icon={Wallet} />
        <StatCard label="Total recettes" value={formatXof(stats.recettes)} icon={TrendingUp} variant="success" />
        <StatCard label="Total dépenses" value={formatXof(stats.depenses)} icon={TrendingDown} variant="warning" />
      </div>

      <Card className="p-5 border-0 shadow-elegant">
        <h2 className="mb-4 text-base font-semibold">Évolution mensuelle</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mois" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="offrandes" fill="var(--primary)" name="Offrandes" />
            <Bar dataKey="dimes" fill="var(--gold)" name="Dîmes" />
            <Bar dataKey="depenses" fill="var(--destructive)" name="Dépenses" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Détail par culte ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Offrandes</th>
                <th className="px-4 py-2 text-right">Dîmes</th>
                <th className="px-4 py-2 text-right">Autres</th>
                <th className="px-4 py-2 text-right">Dépenses</th>
                <th className="px-4 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Chargement...</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucune donnée financière sur la période</td></tr>}
              {rows.sort((a, b) => (b.culte?.date ?? "").localeCompare(a.culte?.date ?? "")).map((r) => {
                const autres = Number(r.action_grace) + Number(r.semence) + Number(r.contribution_speciale);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{r.culte && format(new Date(r.culte.date), "dd/MM/yyyy")}</td>
                    <td className="px-4 py-2">{r.culte && culteTypeLabel(r.culte.type_culte)}</td>
                    <td className="px-4 py-2 text-right">{formatXof(Number(r.offrande))}</td>
                    <td className="px-4 py-2 text-right">{formatXof(Number(r.dime))}</td>
                    <td className="px-4 py-2 text-right">{formatXof(autres)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{formatXof(Number(r.depense))}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatXof(Number(r.solde))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
