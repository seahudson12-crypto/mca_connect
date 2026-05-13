import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { ROLES, roleLabel } from "@/lib/constants";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app/parametres")({ component: ParametresPage });

function ParametresPage() {
  const { isSuperAdmin, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*, user_roles(role)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setRole = async (userId: string, newRole: string) => {
    if (!isSuperAdmin) return toast.error("Réservé au super-administrateur");
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as never });
    if (error) return toast.error(error.message);
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["all-profiles"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Gestion des utilisateurs et des rôles</p>
      </div>

      <Card className="p-5 border-0 shadow-elegant">
        <h2 className="text-base font-semibold mb-4">Utilisateurs</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[220px]">Rôle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const currentRole = (p as { user_roles?: { role: string }[] }).user_roles?.[0]?.role ?? "utilisateur";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select value={currentRole} onValueChange={(v) => setRole(p.id, v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{roleLabel(currentRole)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!isSuperAdmin && (
          <p className="mt-4 text-xs text-muted-foreground">Seul le super-administrateur peut modifier les rôles.</p>
        )}
      </Card>
    </div>
  );
}
