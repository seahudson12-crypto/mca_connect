-- Keep the public department list as a normal (invoker) view and limit
-- anonymous access with column-level privileges instead of a definer view.
ALTER VIEW public.departements_public SET (security_invoker = on);

CREATE POLICY "departements_anon_active_read" ON public.departements
  FOR SELECT TO anon
  USING (actif = true);

GRANT SELECT (id, nom, temple_id, actif) ON public.departements TO anon;