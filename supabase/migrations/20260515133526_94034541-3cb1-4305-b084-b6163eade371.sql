-- 1. Statut de validation sur cultes
DO $$ BEGIN
  CREATE TYPE culte_statut AS ENUM ('brouillon','valide','corrige_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cultes
  ADD COLUMN IF NOT EXISTS statut culte_statut NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by UUID;

-- 2. Table finances_culte (1-1 avec cultes)
CREATE TABLE IF NOT EXISTS public.finances_culte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culte_id UUID NOT NULL UNIQUE REFERENCES public.cultes(id) ON DELETE CASCADE,
  offrande NUMERIC NOT NULL DEFAULT 0,
  dime NUMERIC NOT NULL DEFAULT 0,
  action_grace NUMERIC NOT NULL DEFAULT 0,
  semence NUMERIC NOT NULL DEFAULT 0,
  contribution_speciale NUMERIC NOT NULL DEFAULT 0,
  depense NUMERIC NOT NULL DEFAULT 0,
  solde NUMERIC NOT NULL DEFAULT 0,
  observation TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finances_culte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read finances" ON public.finances_culte;
CREATE POLICY "admin read finances" ON public.finances_culte
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin insert finances" ON public.finances_culte;
CREATE POLICY "admin insert finances" ON public.finances_culte
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin update finances" ON public.finances_culte;
CREATE POLICY "admin update finances" ON public.finances_culte
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "super_admin delete finances" ON public.finances_culte;
CREATE POLICY "super_admin delete finances" ON public.finances_culte
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER finances_culte_updated_at
  BEFORE UPDATE ON public.finances_culte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_finances_culte_culte ON public.finances_culte(culte_id);

-- 3. Historique des modifications
CREATE TABLE IF NOT EXISTS public.historique_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID,
  table_modifiee TEXT NOT NULL,
  enregistrement_id UUID,
  champ TEXT,
  ancienne_valeur TEXT,
  nouvelle_valeur TEXT,
  action TEXT NOT NULL DEFAULT 'update',
  date_modification TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.historique_modifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin read historique" ON public.historique_modifications;
CREATE POLICY "super_admin read historique" ON public.historique_modifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "auth insert historique" ON public.historique_modifications;
CREATE POLICY "auth insert historique" ON public.historique_modifications
  FOR INSERT TO authenticated WITH CHECK (utilisateur_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hist_mod_table ON public.historique_modifications(table_modifiee);
CREATE INDEX IF NOT EXISTS idx_hist_mod_date ON public.historique_modifications(date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_hist_mod_user ON public.historique_modifications(utilisateur_id);

-- 4. Renforcer la politique de modification des cultes : un culte validé n'est modifiable que par super_admin
DROP POLICY IF EXISTS "auth update cultes" ON public.cultes;
CREATE POLICY "update cultes when not locked or super_admin" ON public.cultes
  FOR UPDATE TO authenticated USING (
    statut = 'brouillon' OR public.has_role(auth.uid(), 'super_admin')
  );