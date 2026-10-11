CREATE TABLE public.pays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  code text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pays_nom_unique ON public.pays (lower(btrim(nom)));
GRANT SELECT, INSERT, UPDATE ON public.pays TO authenticated;
GRANT ALL ON public.pays TO service_role;
ALTER TABLE public.pays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read pays" ON public.pays FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin insert pays" ON public.pays FOR INSERT TO authenticated WITH CHECK (public.is_super(auth.uid()));
CREATE POLICY "super admin update pays" ON public.pays FOR UPDATE TO authenticated USING (public.is_super(auth.uid())) WITH CHECK (public.is_super(auth.uid()));
CREATE TRIGGER trg_pays_updated BEFORE UPDATE ON public.pays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.temples ADD COLUMN pays_id uuid REFERENCES public.pays(id) ON DELETE RESTRICT;
ALTER TABLE public.temples ADD COLUMN date_ouverture date;
CREATE INDEX temples_pays_id_idx ON public.temples(pays_id);

-- Backfill : un pays par nom déjà enregistré sur les temples (aucun pays inventé)
INSERT INTO public.pays (nom, code)
SELECT DISTINCT ON (lower(btrim(t.pays))) btrim(t.pays), NULLIF(t.code_pays,'')
FROM public.temples t
WHERE t.pays IS NOT NULL AND btrim(t.pays) <> ''
ORDER BY lower(btrim(t.pays)), t.created_at;

UPDATE public.temples t SET pays_id = p.id
FROM public.pays p WHERE lower(btrim(t.pays)) = lower(btrim(p.nom)) AND t.pays_id IS NULL;

-- Garde le libellé texte existant synchronisé (matricules, écrans existants)
CREATE OR REPLACE FUNCTION public.sync_temple_pays()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p_nom text; p_code text;
BEGIN
  IF NEW.pays_id IS NOT NULL THEN
    SELECT nom, code INTO p_nom, p_code FROM public.pays WHERE id = NEW.pays_id;
    NEW.pays := p_nom;
    IF (NEW.code_pays IS NULL OR NEW.code_pays = '') AND p_code IS NOT NULL THEN NEW.code_pays := p_code; END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.sync_temple_pays() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_temples_sync_pays BEFORE INSERT OR UPDATE OF pays_id ON public.temples FOR EACH ROW EXECUTE FUNCTION public.sync_temple_pays();

CREATE UNIQUE INDEX temples_nom_par_pays_unique ON public.temples (pays_id, lower(btrim(nom_temple))) WHERE pays_id IS NOT NULL;