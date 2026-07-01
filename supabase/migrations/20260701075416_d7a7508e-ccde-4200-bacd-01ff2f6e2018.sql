GRANT SELECT ON public.temples TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temples TO authenticated;
GRANT ALL ON public.temples TO service_role;

CREATE POLICY "anon read active temples"
  ON public.temples FOR SELECT
  TO anon
  USING (actif = true);