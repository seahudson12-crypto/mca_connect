DROP VIEW IF EXISTS public.departements_public;
CREATE VIEW public.departements_public WITH (security_invoker = on) AS
  SELECT d.id, d.nom, d.temple_id
  FROM public.departements d
  WHERE d.actif = true;
GRANT SELECT ON public.departements_public TO anon, authenticated;

DROP POLICY IF EXISTS "departements_anon_active_read" ON public.departements;
CREATE POLICY "departements_anon_active_read" ON public.departements
  FOR SELECT TO anon USING (actif = true);