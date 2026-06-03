
DO $$ BEGIN
  CREATE TYPE public.objectif_type AS ENUM (
    'membres','nouvelles_ames','baptemes','visiteurs',
    'presence_moyenne','offrandes','dimes','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.objectifs_temple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id uuid NOT NULL,
  annee integer NOT NULL,
  type_objectif public.objectif_type NOT NULL,
  libelle text,
  valeur_cible numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temple_id, annee, type_objectif, libelle)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objectifs_temple TO authenticated;
GRANT ALL ON public.objectifs_temple TO service_role;

ALTER TABLE public.objectifs_temple ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read objectifs"
  ON public.objectifs_temple FOR SELECT TO authenticated
  USING (public.can_access_temple(auth.uid(), temple_id));

CREATE POLICY "admin insert objectifs"
  ON public.objectifs_temple FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE POLICY "admin update objectifs"
  ON public.objectifs_temple FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE POLICY "admin delete objectifs"
  ON public.objectifs_temple FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE TRIGGER trg_objectifs_updated_at
  BEFORE UPDATE ON public.objectifs_temple
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_objectifs_temple_annee ON public.objectifs_temple(temple_id, annee);
