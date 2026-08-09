-- 1) Statut des demandes / attributions
DO $$ BEGIN
  CREATE TYPE public.demande_statut AS ENUM ('en_attente','approuve','refuse','suspendu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Demandes de rôle (responsable département / finances)
CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  requested_role app_role NOT NULL,
  nom text,
  prenoms text,
  email text,
  telephone text,
  statut public.demande_statut NOT NULL DEFAULT 'en_attente',
  motif text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_requests_temple ON public.role_requests(temple_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_user ON public.role_requests(user_id);

GRANT SELECT, INSERT, UPDATE ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_requests_select" ON public.role_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin_requests_select" ON public.role_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "own_requests_insert" ON public.role_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND statut = 'en_attente');
CREATE POLICY "admin_requests_update" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE TRIGGER trg_role_requests_updated BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Départements demandés dans une demande
CREATE TABLE IF NOT EXISTS public.role_request_departements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.role_requests(id) ON DELETE CASCADE,
  departement_id uuid NOT NULL REFERENCES public.departements(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, departement_id)
);
GRANT SELECT, INSERT, DELETE ON public.role_request_departements TO authenticated;
GRANT ALL ON public.role_request_departements TO service_role;
ALTER TABLE public.role_request_departements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rrd_select" ON public.role_request_departements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.role_requests r WHERE r.id = request_id
      AND (r.user_id = auth.uid()
        OR (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), r.temple_id))))
  );
CREATE POLICY "rrd_insert_own" ON public.role_request_departements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.role_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
  );

-- 4) Relation N-N utilisateur / départements (attributions validées)
CREATE TABLE IF NOT EXISTS public.user_departements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  departement_id uuid NOT NULL REFERENCES public.departements(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  statut public.demande_statut NOT NULL DEFAULT 'en_attente',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, departement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_dept_user ON public.user_departements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_temple ON public.user_departements(temple_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_departements TO authenticated;
GRANT ALL ON public.user_departements TO service_role;
ALTER TABLE public.user_departements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ud_select_own" ON public.user_departements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ud_admin_select" ON public.user_departements
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "ud_admin_write" ON public.user_departements
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE TRIGGER trg_user_departements_updated BEFORE UPDATE ON public.user_departements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Accès département : prise en compte de la relation N-N validée
CREATE OR REPLACE FUNCTION public.can_access_departement(_user_id uuid, _departement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
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
        OR EXISTS (
          SELECT 1 FROM public.user_departements ud
          WHERE ud.user_id = _user_id
            AND ud.departement_id = d.id
            AND ud.statut = 'approuve'::public.demande_statut
        )
      )
  )
$function$;
REVOKE EXECUTE ON FUNCTION public.can_access_departement(uuid, uuid) FROM PUBLIC, anon;

-- 6) Migration des attributions existantes (user_roles.departement_id) vers la relation N-N
INSERT INTO public.user_departements (user_id, departement_id, temple_id, statut, approved_at)
SELECT ur.user_id, ur.departement_id, d.temple_id, 'approuve'::public.demande_statut, now()
FROM public.user_roles ur
JOIN public.departements d ON d.id = ur.departement_id
WHERE ur.role = 'responsable_departement'::app_role AND ur.departement_id IS NOT NULL
ON CONFLICT (user_id, departement_id) DO NOTHING;

-- 7) Liste publique des départements (pour le formulaire d'inscription)
CREATE OR REPLACE VIEW public.departements_public AS
  SELECT d.id, d.nom, d.temple_id
  FROM public.departements d
  WHERE d.actif = true;
GRANT SELECT ON public.departements_public TO anon, authenticated;