-- 1. search_path fix
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 2. Revoke EXECUTE from PUBLIC/anon on all public functions
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_principal_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_principal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_temple(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_temple_id() FROM PUBLIC, anon;

-- 3. Public temples: expose only non-sensitive columns to anonymous visitors
DROP POLICY IF EXISTS "anon read active temples" ON public.temples;
REVOKE SELECT ON public.temples FROM anon;

DROP VIEW IF EXISTS public.temples_public;
CREATE VIEW public.temples_public AS
  SELECT id, nom_temple, ville, commune, pays, couleur_primaire, logo
  FROM public.temples
  WHERE actif = true;

GRANT SELECT ON public.temples_public TO anon, authenticated;