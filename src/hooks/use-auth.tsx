import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "super_admin_principal" | "super_admin" | "admin_temple" | "utilisateur";

interface Profile {
  id: string;
  nom: string | null;
  email: string | null;
  temple_id: string | null;
  actif?: boolean | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  role: Role;
  templeId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminTemple: boolean;
  isSuperAdmin: boolean;
  isPrincipal: boolean;
  canSeeFinances: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,nom,email,temple_id,actif").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    setRoles(((r ?? []) as Array<{ role: string }>).map((x) => x.role as Role));
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
        setRoles([]);
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

  const isPrincipal = roles.includes("super_admin_principal");
  const isSuperAdmin = isPrincipal || roles.includes("super_admin");
  const isAdminTemple = roles.includes("admin_temple");
  const isAdmin = isSuperAdmin || isAdminTemple;
  const role: Role =
    isPrincipal ? "super_admin_principal"
    : roles.includes("super_admin") ? "super_admin"
    : isAdminTemple ? "admin_temple"
    : "utilisateur";

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        role,
        templeId: profile?.temple_id ?? null,
        loading,
        isAdmin,
        isAdminTemple,
        isSuperAdmin,
        isPrincipal,
        canSeeFinances: isAdmin,
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
