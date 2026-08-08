import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { type AppRole, allowedPaths, canAccessPath, defaultRoute } from "@/lib/permissions";

export type Role = AppRole;

interface Profile {
  id: string;
  nom: string | null;
  email: string | null;
  temple_id: string | null;
  actif?: boolean | null;
}

export interface UserRoleRow {
  role: Role;
  temple_id: string | null;
  departement_id: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  roleRows: UserRoleRow[];
  role: Role;
  templeId: string | null;
  /** Départements dont l'utilisateur est responsable. */
  departementIds: string[];
  loading: boolean;
  isAdmin: boolean;
  isAdminTemple: boolean;
  isSuperAdmin: boolean;
  isPrincipal: boolean;
  isFinances: boolean;
  isDepartementLead: boolean;
  canSeeFinances: boolean;
  canSeeMembres: boolean;
  canManageUsers: boolean;
  allowedPaths: string[] | null;
  canAccessPath: (path: string) => boolean;
  defaultRoute: string;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roleRows, setRoleRows] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,nom,email,temple_id,actif").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role,temple_id,departement_id").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    setRoleRows(((r ?? []) as Array<{ role: string; temple_id: string | null; departement_id: string | null }>).map((x) => ({
      role: x.role as Role,
      temple_id: x.temple_id,
      departement_id: x.departement_id,
    })));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => {
          loadUserData(sess.user.id);
          if (event === "SIGNED_IN") {
            supabase.from("profiles").update({ derniere_connexion: new Date().toISOString() }).eq("id", sess.user.id).then(() => {});
            supabase.from("activites_utilisateurs").insert({
              utilisateur_id: sess.user.id,
              type_action: "login",
              description: "Connexion à l'application",
            }).then(() => {});
          }
        }, 0);
      } else {
        setProfile(null);
        setRoleRows([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadUserData(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (user) {
      await supabase.from("activites_utilisateurs").insert({
        utilisateur_id: user.id,
        type_action: "logout",
        description: "Déconnexion",
      });
    }
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  const roles = roleRows.map((r) => r.role);
  const isPrincipal = roles.includes("super_admin_principal");
  const isSuperAdmin = isPrincipal || roles.includes("super_admin");
  const isAdminTemple = roles.includes("admin_temple");
  const isAdmin = isSuperAdmin || isAdminTemple;
  const isFinances = !isAdmin && roles.includes("finances");
  const isDepartementLead = !isAdmin && roles.includes("responsable_departement");
  const role: Role =
    isPrincipal ? "super_admin_principal"
    : roles.includes("super_admin") ? "super_admin"
    : isAdminTemple ? "admin_temple"
    : roles.includes("finances") ? "finances"
    : roles.includes("responsable_departement") ? "responsable_departement"
    : "utilisateur";

  const departementIds = roleRows
    .filter((r) => r.role === "responsable_departement" && r.departement_id)
    .map((r) => r.departement_id as string);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        roleRows,
        role,
        templeId: profile?.temple_id ?? roleRows.find((r) => r.temple_id)?.temple_id ?? null,
        departementIds,
        loading,
        isAdmin,
        isAdminTemple,
        isSuperAdmin,
        isPrincipal,
        isFinances,
        isDepartementLead,
        canSeeFinances: isAdmin || isFinances,
        canSeeMembres: isAdmin || (!isFinances && !isDepartementLead),
        canManageUsers: isAdmin,
        allowedPaths: allowedPaths(role),
        canAccessPath: (path: string) => canAccessPath(role, path),
        defaultRoute: defaultRoute(role),
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
