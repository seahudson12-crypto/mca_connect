-- 1) Departements
CREATE TABLE IF NOT EXISTS public.departements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temple_id, nom)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departements TO authenticated;
GRANT ALL ON public.departements TO service_role;
ALTER TABLE public.departements ENABLE ROW LEVEL SECURITY;

-- 2) Super admin scope
CREATE TABLE IF NOT EXISTS public.super_admin_temples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, temple_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_temples TO authenticated;
GRANT ALL ON public.super_admin_temples TO service_role;
ALTER TABLE public.super_admin_temples ENABLE ROW LEVEL SECURITY;

-- 3) departement on user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS departement_id uuid REFERENCES public.departements(id) ON DELETE SET NULL;

-- 4) Activity status enum + activities table
DO $$ BEGIN
  CREATE TYPE public.activite_dept_statut AS ENUM ('a_faire','en_cours','realise','reporte','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.activites_departement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departement_id uuid NOT NULL REFERENCES public.departements(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  date_prevue date,
  date_realisation date,
  responsable text,
  statut public.activite_dept_statut NOT NULL DEFAULT 'a_faire',
  avancement integer NOT NULL DEFAULT 0,
  observations text,
  rapport text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activites_departement TO authenticated;
GRANT ALL ON public.activites_departement TO service_role;
ALTER TABLE public.activites_departement ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_departements_updated BEFORE UPDATE ON public.departements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_activites_dept_updated BEFORE UPDATE ON public.activites_departement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Helper functions
CREATE OR REPLACE FUNCTION public.super_admin_scope_count(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.super_admin_temples WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.can_access_temple(_user_id uuid, _temple_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_principal(_user_id)
      OR (
        public.has_role(_user_id, 'super_admin'::app_role)
        AND (
          public.super_admin_scope_count(_user_id) = 0
          OR EXISTS (SELECT 1 FROM public.super_admin_temples s
                     WHERE s.user_id = _user_id AND s.temple_id = _temple_id)
        )
      )
      OR EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = _user_id AND ur.temple_id = _temple_id)
      OR (SELECT p.temple_id FROM public.profiles p WHERE p.id = _user_id) = _temple_id
$$;

CREATE OR REPLACE FUNCTION public.is_finances(_user_id uuid, _temple_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'finances'::app_role
      AND (ur.temple_id = _temple_id
           OR (ur.temple_id IS NULL
               AND (SELECT p.temple_id FROM public.profiles p WHERE p.id = _user_id) = _temple_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_restricted_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_admin(_user_id)
     AND EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = _user_id
                   AND ur.role IN ('finances'::app_role,'responsable_departement'::app_role))
$$;

CREATE OR REPLACE FUNCTION public.can_access_departement(_user_id uuid, _departement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departements d
    WHERE d.id = _departement_id
      AND (
        (public.is_admin(_user_id) AND public.can_access_temple(_user_id, d.temple_id))
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = _user_id
            AND ur.role = 'responsable_departement'::app_role
            AND ur.departement_id = d.id
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.super_admin_scope_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_restricted_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_finances(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_departement(uuid, uuid) FROM PUBLIC, anon;

-- 6) Policies: departements
CREATE POLICY "scoped read departements" ON public.departements FOR SELECT TO authenticated
USING (
  (public.can_access_temple(auth.uid(), temple_id) AND NOT public.is_restricted_role(auth.uid()))
  OR public.can_access_departement(auth.uid(), id)
);
CREATE POLICY "admin insert departements" ON public.departements FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin update departements" ON public.departements FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin delete departements" ON public.departements FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

-- 7) Policies: activites_departement
CREATE POLICY "scoped read activites_dept" ON public.activites_departement FOR SELECT TO authenticated
USING (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "scoped insert activites_dept" ON public.activites_departement FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_departement(auth.uid(), departement_id)
  AND EXISTS (SELECT 1 FROM public.departements d WHERE d.id = departement_id AND d.temple_id = activites_departement.temple_id)
);
CREATE POLICY "scoped update activites_dept" ON public.activites_departement FOR UPDATE TO authenticated
USING (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "scoped delete activites_dept" ON public.activites_departement FOR DELETE TO authenticated
USING (public.can_access_departement(auth.uid(), departement_id));

-- 8) Policies: super_admin_temples
CREATE POLICY "principal manage scope" ON public.super_admin_temples FOR ALL TO authenticated
USING (public.is_principal(auth.uid())) WITH CHECK (public.is_principal(auth.uid()));
CREATE POLICY "users read own scope" ON public.super_admin_temples FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super(auth.uid()));

-- 9) Membres: hide member data from finances / departement leads
DROP POLICY IF EXISTS "scoped read membres" ON public.membres;
CREATE POLICY "scoped read membres" ON public.membres FOR SELECT TO authenticated
USING (public.can_access_temple(auth.uid(), temple_id) AND NOT public.is_restricted_role(auth.uid()));

DROP POLICY IF EXISTS "scoped insert membres" ON public.membres;
CREATE POLICY "scoped insert membres" ON public.membres FOR INSERT TO authenticated
WITH CHECK (public.can_access_temple(auth.uid(), temple_id) AND NOT public.is_restricted_role(auth.uid()));

-- 10) Finances: allow the finances role of the same temple
DROP POLICY IF EXISTS "admin read finances" ON public.finances_culte;
CREATE POLICY "admin read finances" ON public.finances_culte FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cultes c
  WHERE c.id = finances_culte.culte_id
    AND public.can_access_temple(auth.uid(), c.temple_id)
    AND (public.is_admin(auth.uid()) OR public.is_finances(auth.uid(), c.temple_id))
));

DROP POLICY IF EXISTS "admin insert finances" ON public.finances_culte;
CREATE POLICY "admin insert finances" ON public.finances_culte FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cultes c
  WHERE c.id = finances_culte.culte_id
    AND public.can_access_temple(auth.uid(), c.temple_id)
    AND (public.is_admin(auth.uid()) OR public.is_finances(auth.uid(), c.temple_id))
));

DROP POLICY IF EXISTS "admin update finances" ON public.finances_culte;
CREATE POLICY "admin update finances" ON public.finances_culte FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cultes c
  WHERE c.id = finances_culte.culte_id
    AND public.can_access_temple(auth.uid(), c.temple_id)
    AND (public.is_admin(auth.uid()) OR public.is_finances(auth.uid(), c.temple_id))
));

-- 11) Admin temple can manage limited roles inside its own temple
CREATE POLICY "admin_temple manage local roles" ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_temple'::app_role)
  AND temple_id = public.current_user_temple_id()
  AND role IN ('utilisateur'::app_role,'finances'::app_role,'responsable_departement'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_temple'::app_role)
  AND temple_id = public.current_user_temple_id()
  AND role IN ('utilisateur'::app_role,'finances'::app_role,'responsable_departement'::app_role)
);

-- 12) Role change history readable/writable by all admins
DROP POLICY IF EXISTS "super_admin read role_changes" ON public.role_changes;
CREATE POLICY "admins read role_changes" ON public.role_changes FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "super_admin insert role_changes" ON public.role_changes;
CREATE POLICY "admins insert role_changes" ON public.role_changes FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND changed_by = auth.uid());

-- 13) Admins can read profiles of accessible temples (needed for user management)
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_principal(auth.uid())
  OR (public.is_admin(auth.uid()) AND temple_id IS NOT NULL AND public.can_access_temple(auth.uid(), temple_id))
);