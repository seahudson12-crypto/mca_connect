ALTER TABLE public.temples ADD COLUMN IF NOT EXISTS pasteur_adjoint text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.temples TO authenticated;
GRANT SELECT ON public.temples TO anon;
GRANT ALL ON public.temples TO service_role;

DROP POLICY IF EXISTS "super_admin manage temples" ON public.temples;
CREATE POLICY "super_admin manage temples" ON public.temples
  FOR ALL TO authenticated
  USING (public.is_super(auth.uid()))
  WITH CHECK (public.is_super(auth.uid()));