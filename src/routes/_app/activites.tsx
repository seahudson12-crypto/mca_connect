import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_app/activites")({ component: ActivitesPage });

type Row = {
  id: string;
  utilisateur_id: string | null;
  temple_id: string | null;
  type_action: string;
  description: string | null;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  logout: "bg-muted text-muted-foreground",
  promotion: "bg-primary text-primary-foreground",
  suppression: "bg-destructive text-destructive-foreground",
  validation: "bg-accent text-accent-foreground",
  correction: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  modification: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  creation: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
};

function ActivitesPage() {
  const { isSuperAdmin, isAdminTemple, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin && !isAdminTemple) {
      toast.error("Accès réservé aux administrateurs");
      navigate({ to: "/dashboard" });
    }
  }, [loading, isSuperAdmin, isAdminTemple, navigate]);

  const { data: rows = [] } = useQuery({
    queryKey: ["activites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activites_utilisateurs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Row[];
    },
    enabled: isSuperAdmin || isAdminTemple,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,nom,email");
      return (data ?? []) as Array<{ id: string; nom: string | null; email: string | null }>;
    },
  });
  const pmap = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <Activity className="h-7 w-7 text-primary" /> Activités utilisateurs
        </h1>
        <p className="text-sm text-muted-foreground">
          Journal complet : connexions, promotions, validations, corrections, modifications.
        </p>
      </div>

      <Card className="p-4 border-0 shadow-elegant overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune activité</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const p = r.utilisateur_id ? pmap.get(r.utilisateur_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell>{p?.nom || p?.email || "Système"}</TableCell>
                  <TableCell>
                    <Badge className={ACTION_COLORS[r.type_action] ?? ""}>{r.type_action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
