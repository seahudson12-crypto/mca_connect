
-- Profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS derniere_connexion timestamptz;

-- Temples
ALTER TABLE public.temples
  ADD COLUMN IF NOT EXISTS couleur_primaire text DEFAULT '#1e40af',
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_principal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin_principal'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin'::app_role,'super_admin_principal'::app_role))
$$;

CREATE OR REPLACE FUNCTION public.current_user_temple_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT temple_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_access_temple(_user_id uuid, _temple_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super(_user_id)
      OR (SELECT temple_id FROM public.profiles WHERE id = _user_id) = _temple_id
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin_principal'::app_role,'super_admin'::app_role,'admin_temple'::app_role))
$$;

-- Activites
CREATE TABLE IF NOT EXISTS public.activites_utilisateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid,
  temple_id uuid,
  type_action text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activites_utilisateurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth insert activites" ON public.activites_utilisateurs;
CREATE POLICY "auth insert activites" ON public.activites_utilisateurs
  FOR INSERT TO authenticated WITH CHECK (utilisateur_id = auth.uid() OR utilisateur_id IS NULL);
DROP POLICY IF EXISTS "super read activites" ON public.activites_utilisateurs;
CREATE POLICY "super read activites" ON public.activites_utilisateurs
  FOR SELECT TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(), 'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );
CREATE INDEX IF NOT EXISTS idx_activites_created ON public.activites_utilisateurs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activites_temple ON public.activites_utilisateurs(temple_id);

-- MEMBRES
DROP POLICY IF EXISTS "auth read membres" ON public.membres;
DROP POLICY IF EXISTS "auth insert membres" ON public.membres;
DROP POLICY IF EXISTS "admin update membres" ON public.membres;
DROP POLICY IF EXISTS "admin delete membres" ON public.membres;
CREATE POLICY "scoped read membres" ON public.membres
  FOR SELECT TO authenticated USING (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "scoped insert membres" ON public.membres
  FOR INSERT TO authenticated WITH CHECK (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin update membres" ON public.membres
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin delete membres" ON public.membres
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

-- CULTES
DROP POLICY IF EXISTS "auth read cultes" ON public.cultes;
DROP POLICY IF EXISTS "auth insert cultes" ON public.cultes;
DROP POLICY IF EXISTS "update cultes when not locked or super_admin" ON public.cultes;
DROP POLICY IF EXISTS "admin delete cultes" ON public.cultes;
CREATE POLICY "scoped read cultes" ON public.cultes
  FOR SELECT TO authenticated USING (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "scoped insert cultes" ON public.cultes
  FOR INSERT TO authenticated WITH CHECK (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "scoped update cultes" ON public.cultes
  FOR UPDATE TO authenticated USING (
    public.can_access_temple(auth.uid(), temple_id)
    AND (statut = 'brouillon'::culte_statut OR public.is_admin(auth.uid()))
  );
CREATE POLICY "admin delete cultes" ON public.cultes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

-- PRESENCES
DROP POLICY IF EXISTS "auth manage presences" ON public.presences;
DROP POLICY IF EXISTS "auth read presences" ON public.presences;
CREATE POLICY "scoped read presences" ON public.presences
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "scoped insert presences" ON public.presences
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "scoped update presences" ON public.presences
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "scoped delete presences" ON public.presences
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );

-- FINANCES
DROP POLICY IF EXISTS "admin read finances" ON public.finances_culte;
DROP POLICY IF EXISTS "admin insert finances" ON public.finances_culte;
DROP POLICY IF EXISTS "admin update finances" ON public.finances_culte;
DROP POLICY IF EXISTS "super_admin delete finances" ON public.finances_culte;
CREATE POLICY "admin read finances" ON public.finances_culte
  FOR SELECT TO authenticated USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "admin insert finances" ON public.finances_culte
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "admin update finances" ON public.finances_culte
  FOR UPDATE TO authenticated USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id))
  );
CREATE POLICY "super delete finances" ON public.finances_culte
  FOR DELETE TO authenticated USING (public.is_super(auth.uid()));

-- PROFILES
DROP POLICY IF EXISTS "admin manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (
    auth.uid() = id
    OR public.is_super(auth.uid())
    OR (public.has_role(auth.uid(), 'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );
CREATE POLICY "super manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_super(auth.uid())) WITH CHECK (public.is_super(auth.uid()));

-- USER_ROLES
DROP POLICY IF EXISTS "super_admin manage roles" ON public.user_roles;
CREATE POLICY "super manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_super(auth.uid())) WITH CHECK (public.is_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_principal_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('DELETE','UPDATE') AND OLD.role = 'super_admin_principal'::app_role THEN
    IF NOT public.is_principal(auth.uid()) THEN
      RAISE EXCEPTION 'Le Super Admin Principal est protégé.';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.role IN ('super_admin'::app_role,'super_admin_principal'::app_role) THEN
    IF NOT public.is_principal(auth.uid()) THEN
      RAISE EXCEPTION 'Seul le Super Admin Principal peut accorder ce rôle.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_principal_role ON public.user_roles;
CREATE TRIGGER trg_protect_principal_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_principal_role();

-- Seed temples
INSERT INTO public.temples (nom_temple, ville, commune, pays, pasteur_responsable)
SELECT 'Temple Philadelphie', 'Casablanca', 'Casablanca', 'Maroc', 'Pasteur MCA Casablanca'
WHERE NOT EXISTS (SELECT 1 FROM public.temples WHERE nom_temple = 'Temple Philadelphie');

INSERT INTO public.temples (nom_temple, ville, commune, pays, pasteur_responsable)
SELECT 'Temple Résurrection', 'Cotonou', 'Cotonou', 'Bénin', 'Pasteur MCA Bénin'
WHERE NOT EXISTS (SELECT 1 FROM public.temples WHERE nom_temple = 'Temple Résurrection');
