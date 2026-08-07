DROP VIEW IF EXISTS public.temples_public;

-- Column-level grant: anon can never read pasteur/telephone/email
GRANT SELECT (id, nom_temple, ville, commune, pays, couleur_primaire, logo, actif) ON public.temples TO anon;

CREATE POLICY "anon read active temples" ON public.temples
  FOR SELECT TO anon USING (actif = true);

CREATE VIEW public.temples_public WITH (security_invoker = on) AS
  SELECT id, nom_temple, ville, commune, pays, couleur_primaire, logo
  FROM public.temples
  WHERE actif = true;

GRANT SELECT ON public.temples_public TO anon, authenticated;