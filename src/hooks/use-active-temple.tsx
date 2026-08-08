import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface Temple {
  id: string;
  nom_temple: string;
  ville: string | null;
  pays: string | null;
  logo: string | null;
}

interface ActiveTempleCtx {
  activeTemple: Temple | null;
  /** ID du temple actif — à utiliser pour filtrer toutes les requêtes scoppées au temple. */
  activeTempleId: string | null;
  userTemple: Temple | null;
  allTemples: Temple[];
  setActiveTempleId: (id: string) => void;
  canSwitch: boolean;
  loading: boolean;
}

const Ctx = createContext<ActiveTempleCtx | undefined>(undefined);

const STORAGE_KEY = "mca:activeTempleId";

export function ActiveTempleProvider({ children }: { children: ReactNode }) {
  const { user, templeId, isSuperAdmin, isPrincipal, loading: authLoading } = useAuth();
  const [overrideId, setOverrideId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: temples = [], isLoading: templesLoading } = useQuery({
    queryKey: ["temples", "all"],
    enabled: !!user && !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("temples")
        .select("id,nom_temple,ville,pays,logo")
        .eq("actif", true)
        .order("nom_temple");
      if (error) throw error;
      return (data ?? []) as Temple[];
    },
  });

  // Périmètre d'un super admin non principal : temples explicitement attribués
  const { data: scope = [] } = useQuery({
    queryKey: ["super-admin-scope", user?.id],
    enabled: !!user && isSuperAdmin && !isPrincipal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("super_admin_temples")
        .select("temple_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as Array<{ temple_id: string }>).map((x) => x.temple_id);
    },
  });

  // Temples visibles : principal => tous ; super admin => périmètre (ou tous si aucun périmètre défini) ; sinon son temple
  const allTemples = useMemo(() => {
    if (isPrincipal) return temples;
    if (isSuperAdmin) return scope.length > 0 ? temples.filter((t) => scope.includes(t.id)) : temples;
    return temples.filter((t) => t.id === templeId);
  }, [temples, isPrincipal, isSuperAdmin, scope, templeId]);

  const userTemple = useMemo(
    () => temples.find((t) => t.id === templeId) ?? null,
    [temples, templeId],
  );

  const canSwitch = isSuperAdmin && allTemples.length > 1;
  const validOverride = canSwitch && overrideId && allTemples.some((t) => t.id === overrideId) ? overrideId : null;
  const activeTempleId = validOverride ?? templeId ?? allTemples[0]?.id ?? null;
  const activeTemple = useMemo(
    () => allTemples.find((t) => t.id === activeTempleId) ?? userTemple,
    [allTemples, activeTempleId, userTemple],
  );

  const setActiveTempleId = (id: string) => {
    if (!canSwitch) return;
    setOverrideId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  // Nettoyage de l'override si l'utilisateur n'a plus le droit de changer de temple
  useEffect(() => {
    if (!isSuperAdmin && overrideId) {
      setOverrideId(null);
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    }
  }, [isSuperAdmin, overrideId]);

  return (
    <Ctx.Provider
      value={{
        activeTemple,
        activeTempleId: activeTemple?.id ?? activeTempleId ?? null,
        userTemple,
        allTemples,
        setActiveTempleId,
        canSwitch,
        loading: authLoading || templesLoading,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useActiveTemple() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveTemple must be used within ActiveTempleProvider");
  return ctx;
}
