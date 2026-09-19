DROP POLICY IF EXISTS departements_anon_active_read ON public.departements;
DROP POLICY IF EXISTS "auth read temples" ON public.temples;
CREATE POLICY "scoped read temples" ON public.temples FOR SELECT TO authenticated USING (public.can_access_temple(auth.uid(), id));