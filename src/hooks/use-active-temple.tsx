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
  /** Le temple actuellement affiché (peut différer du temple de l'utilisateur si super admin a switché). */
  activeTemple: Temple | null;
  /** Le temple de rattachement de l'utilisateur. */
  userTemple: Temple | null;
  /** Tous les temples (uniquement chargés pour les super admins). */
  allTemples: Temple[];
  /** Change le temple actif (super admin uniquement). */
  setActiveTempleId: (id: string) => void;
  /** True si l'utilisateur peut switcher entre temples. */
  canSwitch: boolean;
  loading: boolean;
}

const Ctx = createContext<ActiveTempleCtx | undefined>(undefined);

const STORAGE_KEY = "mca:activeTempleId";

export function ActiveTempleProvider({ children }: { children: ReactNode }) {
  const { user, templeId, isSuperAdmin, loading: authLoading } = useAuth();
  const [overrideId, setOverrideId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Charger tous les temples si super admin, sinon juste celui de l'utilisateur
  const { data: allTemples = [], isLoading: templesLoading } = useQuery({
    queryKey: ["temples", "all", isSuperAdmin],
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

  const userTemple = useMemo(
    () => allTemples.find((t) => t.id === templeId) ?? null,
    [allTemples, templeId],
  );

  const activeTempleId = isSuperAdmin && overrideId ? overrideId : templeId;
  const activeTemple = useMemo(
    () => allTemples.find((t) => t.id === activeTempleId) ?? userTemple,
    [allTemples, activeTempleId, userTemple],
  );

  const setActiveTempleId = (id: string) => {
    if (!isSuperAdmin) return;
    setOverrideId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  // Si l'utilisateur n'est pas super admin, on nettoie l'override
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
        userTemple,
        allTemples,
        setActiveTempleId,
        canSwitch: isSuperAdmin,
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
