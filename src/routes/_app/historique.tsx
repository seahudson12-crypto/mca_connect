import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_app/historique")({ component: HistoriquePage });

type HistRow = {
  id: string;
  utilisateur_id: string | null;
  table_modifiee: string;
  enregistrement_id: string | null;
  champ: string | null;
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  action: string;
  date_modification: string;
};

function HistoriquePage() {
  const { isSuperAdmin, loading } = useAuth();
  const [filter, setFilter] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["historique-mods"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historique_modifications")
        .select("*")
        .order("date_modification", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as HistRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nom, email");
      return data ?? [];
    },
  });

  const profileName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p?.nom || p?.email || id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return rows;
    return rows.filter((r) =>
      [r.table_modifiee, r.champ, r.action, r.ancienne_valeur, r.nouvelle_valeur, profileName(r.utilisateur_id)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(f)),
    );
  }, [rows, filter, profiles]);

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Historique des modifications</h1>
        <p className="text-sm text-muted-foreground">{rows.length} dernières modifications enregistrées</p>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <Input placeholder="Rechercher (table, champ, utilisateur, valeur...)" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </Card>

      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Utilisateur</th>
                <th className="px-4 py-2 text-left">Table</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Champ</th>
                <th className="px-4 py-2 text-left">Avant → Après</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Aucune modification</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{format(new Date(r.date_modification), "dd/MM/yyyy HH:mm", { locale: fr })}</td>
                  <td className="px-4 py-2">{profileName(r.utilisateur_id)}</td>
                  <td className="px-4 py-2"><Badge variant="secondary">{r.table_modifiee}</Badge></td>
                  <td className="px-4 py-2">
                    <Badge className={
                      r.action === "create" ? "bg-success text-success-foreground"
                      : r.action === "delete" ? "bg-destructive text-destructive-foreground"
                      : r.action === "validate" ? "bg-gold text-gold-foreground"
                      : "bg-primary text-primary-foreground"
                    }>{r.action}</Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.champ ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.action === "update" && (
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground line-through">{r.ancienne_valeur ?? "—"}</div>
                        <div className="text-success-foreground bg-success/10 inline-block px-1 rounded">{r.nouvelle_valeur ?? "—"}</div>
                      </div>
                    )}
                    {r.action !== "update" && (
                      <span className="text-muted-foreground">{r.action === "delete" ? "Supprimé" : r.action === "create" ? "Créé" : r.action}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
