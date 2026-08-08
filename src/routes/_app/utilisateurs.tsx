import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldCheck, ShieldOff, UserCog, History, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Role = "super_admin_principal" | "super_admin" | "admin_temple" | "finances" | "responsable_departement" | "utilisateur";
type Profile = { id: string; nom: string | null; email: string | null; temple_id: string | null; actif?: boolean | null; derniere_connexion?: string | null };
type RoleRow = { user_id: string; role: Role; temple_id: string | null; departement_id: string | null };
type Departement = { id: string; nom: string; temple_id: string };
type Temple = { id: string; nom_temple: string };
type RoleChange = {
  id: string;
  target_user_id: string;
  changed_by: string | null;
  previous_role: Role | null;
  new_role: Role;
  temple_id: string | null;
  created_at: string;
};

const roleLabel = (r: Role | null) =>
  r === "super_admin_principal" ? "Super Admin Principal"
  : r === "super_admin" ? "Super Admin"
  : r === "admin_temple" ? "Admin Temple"
  : r === "finances" ? "Finances"
  : r === "responsable_departement" ? "Responsable de département"
  : r === "utilisateur" ? "Utilisateur" : "—";

export const Route = createFileRoute("/_app/utilisateurs")({ component: UtilisateursPage });

function UtilisateursPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isSuperAdmin, isAdmin, isAdminTemple, templeId, loading } = useAuth();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Accès réservé aux administrateurs");
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,nom,email,temple_id,actif,derniere_connexion").order("nom");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  const { data: roleRows = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role,temple_id,departement_id");
      if (error) throw error;
      return data as RoleRow[];
    },
    enabled: isAdmin,
  });

  const { data: temples = [] } = useQuery({
    queryKey: ["temples-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("temples").select("id,nom_temple").order("nom_temple");
      if (error) throw error;
      return data as Temple[];
    },
    enabled: isAdmin,
  });

  const { data: departements = [] } = useQuery({
    queryKey: ["departements-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departements").select("id,nom,temple_id").order("nom");
      if (error) throw error;
      return data as Departement[];
    },
    enabled: isAdmin,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["role-changes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_changes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as RoleChange[];
    },
    enabled: isAdmin,
  });

  const rolesByUser = new Map<string, RoleRow[]>();
  roleRows.forEach((r) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r);
    rolesByUser.set(r.user_id, arr);
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const p = profileById.get(id);
    return p?.nom || p?.email || id.slice(0, 8);
  };

  const filtered = profiles.filter((p) =>
    !search || `${p.nom ?? ""} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const setRole = async (userId: string, role: Role, templeId: string | null, previousRole: Role, departementId: string | null = null) => {
    const { data: auth } = await supabase.auth.getUser();
    const actorId = auth.user?.id ?? null;
    // Remove all existing roles for the user, then insert the new one
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) return toast.error(del.error.message);
    const ins = await supabase.from("user_roles").insert({ user_id: userId, role, temple_id: templeId, departement_id: departementId });
    if (ins.error) return toast.error(ins.error.message);
    if (previousRole !== role || (role === "admin_temple")) {
      const log = await supabase.from("role_changes").insert({
        target_user_id: userId,
        changed_by: actorId,
        previous_role: previousRole,
        new_role: role,
        temple_id: templeId,
      });
      if (log.error) console.warn("history log failed", log.error.message);
    }
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["all-roles"] });
    qc.invalidateQueries({ queryKey: ["role-changes"] });
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <UserCog className="h-7 w-7 text-primary" /> Utilisateurs & rôles
        </h1>
        <p className="text-sm text-muted-foreground">
          Promouvoir un utilisateur en super administrateur ou administrateur de temple.
        </p>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="pl-9"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle actuel</TableHead>
                <TableHead>Temple</TableHead>
                <TableHead className="w-[260px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
              )}
              {filtered.map((p) => {
                const userRoles = rolesByUser.get(p.id) ?? [];
                const current: Role = userRoles.find((r) => r.role === "super_admin_principal")?.role
                  ?? userRoles.find((r) => r.role === "super_admin")?.role
                  ?? userRoles.find((r) => r.role === "admin_temple")?.role
                  ?? "utilisateur";
                const currentTempleId = userRoles[0]?.temple_id ?? p.temple_id ?? null;
                const templeName = temples.find((t) => t.id === currentTempleId)?.nom_temple ?? "—";

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.nom ?? "—"}
                      {p.derniere_connexion && (
                        <div className="text-xs text-muted-foreground">Vu le {format(new Date(p.derniere_connexion), "d MMM HH:mm", { locale: fr })}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          current === "super_admin_principal" ? "bg-gold text-foreground"
                          : current === "super_admin" ? "bg-primary text-primary-foreground"
                          : current === "admin_temple" ? "bg-accent text-accent-foreground"
                          : ""
                        }
                        variant={current === "utilisateur" ? "secondary" : undefined}
                      >
                        {roleLabel(current)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{templeName}</TableCell>
                    <TableCell>
                      <RoleEditor
                        currentRole={current}
                        currentTempleId={currentTempleId}
                        temples={temples}
                        currentDepartementId={userRoles[0]?.departement_id ?? null}
                        departements={departements}
                        isSuperAdmin={isSuperAdmin}
                        lockedTempleId={isAdminTemple && !isSuperAdmin ? templeId : null}
                        onApply={(role, tId, deptId) => setRole(p.id, role, tId, current, deptId)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Historique des changements de rôles</h2>
          <Badge variant="secondary" className="ml-auto">{history.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Changement</TableHead>
                <TableHead>Promu par</TableHead>
                <TableHead>Temple</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun changement enregistré pour le moment
                  </TableCell>
                </TableRow>
              )}
              {history.map((h) => {
                const templeName = h.temple_id ? (temples.find((t) => t.id === h.temple_id)?.nom_temple ?? "—") : "—";
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(h.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="font-medium">{nameOf(h.target_user_id)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Badge variant="secondary">{roleLabel(h.previous_role)}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge
                          className={
                            h.new_role === "super_admin"
                              ? "bg-primary text-primary-foreground"
                              : h.new_role === "admin_temple"
                                ? "bg-accent text-accent-foreground"
                                : ""
                          }
                          variant={h.new_role === "utilisateur" ? "secondary" : undefined}
                        >
                          {roleLabel(h.new_role)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{nameOf(h.changed_by)}</TableCell>
                    <TableCell className="text-sm">{templeName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function RoleEditor({
  currentRole, currentTempleId, currentDepartementId, temples, departements, isSuperAdmin, lockedTempleId, onApply,
}: {
  currentRole: Role;
  currentTempleId: string | null;
  currentDepartementId: string | null;
  temples: Temple[];
  departements: Departement[];
  isSuperAdmin: boolean;
  lockedTempleId: string | null;
  onApply: (role: Role, templeId: string | null, departementId: string | null) => void;
}) {
  const [role, setRole] = useState<Role>(currentRole);
  const [templeId, setTempleId] = useState<string | null>(lockedTempleId ?? currentTempleId);
  const [deptId, setDeptId] = useState<string | null>(currentDepartementId);
  const needsTemple = role === "admin_temple" || role === "finances" || role === "responsable_departement";
  const deptOptions = departements.filter((d) => !templeId || d.temple_id === templeId);

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="utilisateur">Utilisateur</SelectItem>
          <SelectItem value="finances">Finances</SelectItem>
          <SelectItem value="responsable_departement">Responsable de département</SelectItem>
          <SelectItem value="admin_temple">Admin Temple</SelectItem>
          {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
          {isSuperAdmin && <SelectItem value="super_admin_principal">Super Admin Principal</SelectItem>}
        </SelectContent>
      </Select>
      {needsTemple && !lockedTempleId && (
        <Select value={templeId ?? ""} onValueChange={(v) => setTempleId(v || null)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Temple" /></SelectTrigger>
          <SelectContent>
            {temples.map((t) => <SelectItem key={t.id} value={t.id}>{t.nom_temple}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {role === "responsable_departement" && (
        <Select value={deptId ?? ""} onValueChange={(v) => setDeptId(v || null)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Département" /></SelectTrigger>
          <SelectContent>
            {deptOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Button
        size="sm"
        className="gradient-brand text-primary-foreground border-0"
        onClick={() => onApply(role, needsTemple ? templeId : null, role === "responsable_departement" ? deptId : null)}
        disabled={
          (needsTemple && !templeId) ||
          (role === "responsable_departement" && !deptId) ||
          (role === currentRole && templeId === currentTempleId && deptId === currentDepartementId)
        }
      >
        {role === "utilisateur" ? <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
        Appliquer
      </Button>
    </div>
  );
}
