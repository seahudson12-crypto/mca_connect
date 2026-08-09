import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldX, PauseCircle, Network, Wallet, Pencil, History, Inbox } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { roleLabel } from "@/lib/constants";
import { logChange } from "@/lib/audit";

export const Route = createFileRoute("/_app/demandes")({
  component: DemandesPage,
  head: () => ({
    meta: [
      { title: "Demandes de validation — MCA Connect" },
      { name: "description", content: "Validation des responsables de département et des responsables finances par temple." },
      { property: "og:title", content: "Demandes de validation — MCA Connect" },
      { property: "og:description", content: "Validation des responsables de département et des responsables finances par temple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Statut = "en_attente" | "approuve" | "refuse" | "suspendu";
type Request = {
  id: string;
  user_id: string;
  temple_id: string;
  requested_role: "finances" | "responsable_departement";
  nom: string | null;
  prenoms: string | null;
  email: string | null;
  telephone: string | null;
  statut: Statut;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

const statutBadge = (s: Statut) => {
  const label =
    s === "en_attente" ? "En attente" : s === "approuve" ? "Approuvé" : s === "refuse" ? "Refusé" : "Suspendu";
  const cls =
    s === "approuve" ? "bg-primary text-primary-foreground"
    : s === "refuse" ? "bg-destructive text-destructive-foreground"
    : s === "suspendu" ? "bg-accent text-accent-foreground"
    : undefined;
  return <Badge className={cls} variant={cls ? undefined : "secondary"}>{label}</Badge>;
};

function DemandesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin, loading, user } = useAuth();
  const [filter, setFilter] = useState<Statut | "all">("en_attente");
  const [editUser, setEditUser] = useState<{ userId: string; templeId: string; nom: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Accès réservé aux administrateurs");
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  const { data: requests = [] } = useQuery({
    queryKey: ["role-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
    enabled: isAdmin,
  });

  const { data: requestDepts = [] } = useQuery({
    queryKey: ["role-request-departements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_request_departements").select("request_id,departement_id");
      if (error) throw error;
      return data as Array<{ request_id: string; departement_id: string }>;
    },
    enabled: isAdmin,
  });

  const { data: userDepts = [] } = useQuery({
    queryKey: ["user-departements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_departements")
        .select("id,user_id,departement_id,temple_id,statut,approved_by,approved_at");
      if (error) throw error;
      return data as Array<{
        id: string; user_id: string; departement_id: string; temple_id: string;
        statut: Statut; approved_by: string | null; approved_at: string | null;
      }>;
    },
    enabled: isAdmin,
  });

  const { data: departements = [] } = useQuery({
    queryKey: ["departements-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departements").select("id,nom,temple_id").order("nom");
      if (error) throw error;
      return data as Array<{ id: string; nom: string; temple_id: string }>;
    },
    enabled: isAdmin,
  });

  const { data: temples = [] } = useQuery({
    queryKey: ["temples-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("temples").select("id,nom_temple").order("nom_temple");
      if (error) throw error;
      return data as Array<{ id: string; nom_temple: string }>;
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,nom,email,temple_id").order("nom");
      if (error) throw error;
      return data as Array<{ id: string; nom: string | null; email: string | null; temple_id: string | null }>;
    },
    enabled: isAdmin,
  });

  const { data: roleRows = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role,temple_id,departement_id");
      if (error) throw error;
      return data as Array<{ user_id: string; role: string; temple_id: string | null; departement_id: string | null }>;
    },
    enabled: isAdmin,
  });

  const { data: journal = [] } = useQuery({
    queryKey: ["validation-journal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historique_modifications")
        .select("*")
        .eq("table_modifiee", "role_requests")
        .order("date_modification", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Array<{
        id: string; utilisateur_id: string | null; enregistrement_id: string | null;
        champ: string | null; ancienne_valeur: string | null; nouvelle_valeur: string | null;
        action: string; date_modification: string;
      }>;
    },
    enabled: isAdmin,
  });

  const templeName = (id: string | null) => temples.find((t) => t.id === id)?.nom_temple ?? "—";
  const deptName = (id: string) => departements.find((d) => d.id === id)?.nom ?? "—";
  const personName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p?.nom || p?.email || id.slice(0, 8);
  };

  const decide = useMutation({
    mutationFn: async ({ req, statut }: { req: Request; statut: Statut }) => {
      const now = new Date().toISOString();
      const previous = req.statut;
      const up = await supabase
        .from("role_requests")
        .update({ statut, decided_by: user?.id ?? null, decided_at: now })
        .eq("id", req.id);
      if (up.error) throw new Error(up.error.message);

      const deptIds = requestDepts.filter((d) => d.request_id === req.id).map((d) => d.departement_id);

      if (statut === "approuve") {
        // Attribution du rôle (le rôle utilisateur de base est conservé)
        const existing = roleRows.find((r) => r.user_id === req.user_id && r.role === req.requested_role);
        if (!existing) {
          const ins = await supabase.from("user_roles").insert({
            user_id: req.user_id,
            role: req.requested_role,
            temple_id: req.temple_id,
          });
          if (ins.error) throw new Error(ins.error.message);
        }
        if (req.requested_role === "responsable_departement" && deptIds.length > 0) {
          for (const departement_id of deptIds) {
            const { error } = await supabase.from("user_departements").upsert(
              {
                user_id: req.user_id,
                departement_id,
                temple_id: req.temple_id,
                statut: "approuve",
                approved_by: user?.id ?? null,
                approved_at: now,
              },
              { onConflict: "user_id,departement_id" },
            );
            if (error) throw new Error(error.message);
          }
        }
        await supabase.from("role_changes").insert({
          target_user_id: req.user_id,
          changed_by: user?.id ?? null,
          previous_role: "utilisateur",
          new_role: req.requested_role,
          temple_id: req.temple_id,
        });
      } else {
        // Refus / suspension : retrait des droits liés à la demande
        await supabase.from("user_roles").delete().eq("user_id", req.user_id).eq("role", req.requested_role);
        if (req.requested_role === "responsable_departement") {
          await supabase
            .from("user_departements")
            .update({ statut })
            .eq("user_id", req.user_id)
            .eq("temple_id", req.temple_id);
        }
      }

      await logChange({
        table: "role_requests",
        recordId: req.id,
        action: statut,
        champ: "statut",
        ancienne: previous,
        nouvelle: statut,
      });
    },
    onSuccess: () => {
      toast.success("Demande traitée");
      ["role-requests", "user-departements", "all-roles", "validation-journal"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDepts = useMutation({
    mutationFn: async ({ userId, templeId, ids }: { userId: string; templeId: string; ids: string[] }) => {
      const now = new Date().toISOString();
      const current = userDepts.filter((u) => u.user_id === userId);
      const toRemove = current.filter((c) => !ids.includes(c.departement_id)).map((c) => c.id);
      if (toRemove.length > 0) {
        const { error } = await supabase.from("user_departements").delete().in("id", toRemove);
        if (error) throw new Error(error.message);
      }
      for (const departement_id of ids) {
        const { error } = await supabase.from("user_departements").upsert(
          {
            user_id: userId,
            departement_id,
            temple_id: templeId,
            statut: "approuve",
            approved_by: user?.id ?? null,
            approved_at: now,
          },
          { onConflict: "user_id,departement_id" },
        );
        if (error) throw new Error(error.message);
      }
      await logChange({
        table: "role_requests",
        recordId: userId,
        action: "departements_modifies",
        champ: "departements",
        ancienne: current.map((c) => deptName(c.departement_id)).join(", "),
        nouvelle: ids.map((i) => deptName(i)).join(", "),
      });
    },
    onSuccess: () => {
      toast.success("Départements mis à jour");
      setEditUser(null);
      ["user-departements", "validation-journal"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "finances" | "responsable_departement" }) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw new Error(error.message);
      if (role === "responsable_departement") {
        await supabase.from("user_departements").delete().eq("user_id", userId);
      }
      await logChange({
        table: "role_requests",
        recordId: userId,
        action: "role_retire",
        champ: "role",
        ancienne: role,
        nouvelle: "utilisateur",
      });
    },
    onSuccess: () => {
      toast.success("Rôle retiré");
      ["all-roles", "user-departements", "validation-journal"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => requests.filter((r) => filter === "all" || r.statut === filter),
    [requests, filter],
  );

  const deptLeads = roleRows.filter((r) => r.role === "responsable_departement");
  const financeLeads = roleRows.filter((r) => r.role === "finances");

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-7 w-7 text-primary" /> Demandes de validation
        </h1>
        <p className="text-sm text-muted-foreground">
          Approuver, refuser ou suspendre les demandes de responsable de département et de responsable finances.
        </p>
      </div>

      <Card className="p-4 border-0 shadow-elegant space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filter} onValueChange={(v) => setFilter(v as Statut | "all")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en_attente">En attente</SelectItem>
              <SelectItem value="approuve">Approuvés</SelectItem>
              <SelectItem value="refuse">Refusés</SelectItem>
              <SelectItem value="suspendu">Suspendus</SelectItem>
              <SelectItem value="all">Toutes les demandes</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filtered.length} demande(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom & prénoms</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Temple</TableHead>
                <TableHead>Rôle demandé</TableHead>
                <TableHead>Département(s)</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[260px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucune demande
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const depts = requestDepts.filter((d) => d.request_id === r.id).map((d) => deptName(d.departement_id));
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {[r.nom, r.prenoms].filter(Boolean).join(" ") || personName(r.user_id)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{r.email ?? "—"}</div>
                      {r.telephone && <div>{r.telephone}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{templeName(r.temple_id)}</TableCell>
                    <TableCell className="text-sm">{roleLabel(r.requested_role)}</TableCell>
                    <TableCell className="text-sm">
                      {depts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {depts.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      {statutBadge(r.statut)}
                      {r.decided_at && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          par {personName(r.decided_by)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="gradient-brand text-primary-foreground border-0"
                          disabled={decide.isPending || r.statut === "approuve"}
                          onClick={() => decide.mutate({ req: r, statut: "approuve" })}
                        >
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending || r.statut === "refuse"}
                          onClick={() => decide.mutate({ req: r, statut: "refuse" })}
                        >
                          <ShieldX className="mr-1 h-3.5 w-3.5" /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={decide.isPending || r.statut === "suspendu"}
                          onClick={() => decide.mutate({ req: r, statut: "suspendu" })}
                        >
                          <PauseCircle className="mr-1 h-3.5 w-3.5" /> Suspendre
                        </Button>
                      </div>
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
          <Network className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Responsables de départements</h2>
          <Badge variant="secondary" className="ml-auto">{deptLeads.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Temple</TableHead>
                <TableHead>Département(s)</TableHead>
                <TableHead>Validé le</TableHead>
                <TableHead>Validé par</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptLeads.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Aucun responsable validé</TableCell></TableRow>
              )}
              {deptLeads.map((r) => {
                const grants = userDepts.filter((u) => u.user_id === r.user_id);
                const tId = r.temple_id ?? grants[0]?.temple_id ?? null;
                return (
                  <TableRow key={`${r.user_id}-dept`}>
                    <TableCell className="font-medium">{personName(r.user_id)}</TableCell>
                    <TableCell className="text-sm">{templeName(tId)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {grants.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                        {grants.map((g) => (
                          <Badge key={g.id} variant={g.statut === "approuve" ? "secondary" : "outline"}>
                            {deptName(g.departement_id)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {grants[0]?.approved_at ? format(new Date(grants[0].approved_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{personName(grants[0]?.approved_by ?? null)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!tId}
                          onClick={() => tId && setEditUser({ userId: r.user_id, templeId: tId, nom: personName(r.user_id) })}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Départements
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRole.mutate({ userId: r.user_id, role: "responsable_departement" })}
                        >
                          <ShieldX className="mr-1 h-3.5 w-3.5" /> Retirer
                        </Button>
                      </div>
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
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Responsables finances</h2>
          <Badge variant="secondary" className="ml-auto">{financeLeads.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Temple</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financeLeads.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Aucun responsable finances</TableCell></TableRow>
              )}
              {financeLeads.map((r) => (
                <TableRow key={`${r.user_id}-fin`}>
                  <TableCell className="font-medium">{personName(r.user_id)}</TableCell>
                  <TableCell className="text-sm">{templeName(r.temple_id)}</TableCell>
                  <TableCell>{statutBadge("approuve")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => removeRole.mutate({ userId: r.user_id, role: "finances" })}>
                      <ShieldX className="mr-1 h-3.5 w-3.5" /> Retirer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Journal des validations</h2>
          <Badge variant="secondary" className="ml-auto">{journal.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Ancienne valeur</TableHead>
                <TableHead>Nouvelle valeur</TableHead>
                <TableHead>Administrateur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journal.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune action enregistrée</TableCell></TableRow>
              )}
              {journal.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(j.date_modification), "d MMM yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell className="text-sm">{j.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{j.ancienne_valeur ?? "—"}</TableCell>
                  <TableCell className="text-sm">{j.nouvelle_valeur ?? "—"}</TableCell>
                  <TableCell className="text-sm">{personName(j.utilisateur_id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <EditDeptsDialog
        state={editUser}
        departements={departements.filter((d) => d.temple_id === editUser?.templeId)}
        current={userDepts.filter((u) => u.user_id === editUser?.userId).map((u) => u.departement_id)}
        onClose={() => setEditUser(null)}
        onSave={(ids) => editUser && saveDepts.mutate({ userId: editUser.userId, templeId: editUser.templeId, ids })}
        saving={saveDepts.isPending}
      />
    </div>
  );
}

function EditDeptsDialog({
  state, departements, current, onClose, onSave, saving,
}: {
  state: { userId: string; templeId: string; nom: string } | null;
  departements: Array<{ id: string; nom: string }>;
  current: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
  saving: boolean;
}) {
  const [ids, setIds] = useState<string[]>(current);
  const key = `${state?.userId ?? "none"}-${current.join(",")}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setIds(current);
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Départements de {state?.nom}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Sélection multiple</Label>
          {departements.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun département dans ce temple.</p>
          )}
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
            {departements.map((d) => (
              <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={ids.includes(d.id)}
                  onChange={() =>
                    setIds((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]))
                  }
                />
                {d.nom}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="gradient-brand text-primary-foreground border-0"
            disabled={saving}
            onClick={() => onSave(ids)}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
