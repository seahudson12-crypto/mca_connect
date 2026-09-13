-- 1. Membres du département (relation, jamais de duplication de fiche)
CREATE TABLE public.departement_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departement_id uuid NOT NULL REFERENCES public.departements(id) ON DELETE CASCADE,
  membre_id uuid NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id),
  date_ajout date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departement_id, membre_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departement_membres TO authenticated;
GRANT ALL ON public.departement_membres TO service_role;
ALTER TABLE public.departement_membres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_select" ON public.departement_membres FOR SELECT TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "dm_insert" ON public.departement_membres FOR INSERT TO authenticated
  WITH CHECK (public.can_access_departement(auth.uid(), departement_id)
    AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "dm_update" ON public.departement_membres FOR UPDATE TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id))
  WITH CHECK (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "dm_delete" ON public.departement_membres FOR DELETE TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id));
CREATE TRIGGER trg_dm_updated BEFORE UPDATE ON public.departement_membres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cohérence multi-temples : membre, département et temple_id doivent concorder
CREATE OR REPLACE FUNCTION public.check_departement_membre_temple()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_temple uuid; m_temple uuid;
BEGIN
  SELECT temple_id INTO d_temple FROM public.departements WHERE id = NEW.departement_id;
  SELECT temple_id INTO m_temple FROM public.membres WHERE id = NEW.membre_id;
  IF d_temple IS NULL OR m_temple IS NULL OR d_temple <> m_temple THEN
    RAISE EXCEPTION 'Le membre doit appartenir au même temple que le département.';
  END IF;
  NEW.temple_id := d_temple;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.check_departement_membre_temple() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dm_temple BEFORE INSERT OR UPDATE ON public.departement_membres
  FOR EACH ROW EXECUTE FUNCTION public.check_departement_membre_temple();

-- 2. Fonctions du bureau (configurable par temple)
CREATE TABLE public.departement_fonctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 99,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temple_id, nom)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departement_fonctions TO authenticated;
GRANT ALL ON public.departement_fonctions TO service_role;
ALTER TABLE public.departement_fonctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "df_select" ON public.departement_fonctions FOR SELECT TO authenticated
  USING (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "df_insert" ON public.departement_fonctions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "df_update" ON public.departement_fonctions FOR UPDATE TO authenticated
  USING (public.can_access_temple(auth.uid(), temple_id))
  WITH CHECK (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "df_delete" ON public.departement_fonctions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE TRIGGER trg_df_updated BEFORE UPDATE ON public.departement_fonctions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.departement_fonctions (temple_id, nom, ordre)
SELECT t.id, f.nom, f.ordre
FROM public.temples t
CROSS JOIN (VALUES
  ('Président',1),('Vice-président',2),('Secrétaire',3),('Secrétaire adjoint',4),
  ('Trésorier',5),('Trésorier adjoint',6),('Conseiller',7),('Membre du bureau',8)
) AS f(nom, ordre)
ON CONFLICT DO NOTHING;

-- 3. Bureau du département
CREATE TABLE public.departement_bureau (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departement_id uuid NOT NULL REFERENCES public.departements(id) ON DELETE CASCADE,
  membre_id uuid NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  temple_id uuid NOT NULL REFERENCES public.temples(id),
  fonction text NOT NULL,
  ordre integer NOT NULL DEFAULT 99,
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (departement_id, membre_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departement_bureau TO authenticated;
GRANT ALL ON public.departement_bureau TO service_role;
ALTER TABLE public.departement_bureau ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_select" ON public.departement_bureau FOR SELECT TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "db_insert" ON public.departement_bureau FOR INSERT TO authenticated
  WITH CHECK (public.can_access_departement(auth.uid(), departement_id)
    AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "db_update" ON public.departement_bureau FOR UPDATE TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id))
  WITH CHECK (public.can_access_departement(auth.uid(), departement_id));
CREATE POLICY "db_delete" ON public.departement_bureau FOR DELETE TO authenticated
  USING (public.can_access_departement(auth.uid(), departement_id));
CREATE TRIGGER trg_db_updated BEFORE UPDATE ON public.departement_bureau
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Le membre doit déjà appartenir au département
CREATE OR REPLACE FUNCTION public.check_bureau_membre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_temple uuid;
BEGIN
  SELECT temple_id INTO d_temple FROM public.departements WHERE id = NEW.departement_id;
  IF NOT EXISTS (SELECT 1 FROM public.departement_membres dm
                 WHERE dm.departement_id = NEW.departement_id AND dm.membre_id = NEW.membre_id) THEN
    RAISE EXCEPTION 'La personne doit d''abord être membre du département.';
  END IF;
  NEW.temple_id := d_temple;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.check_bureau_membre() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_db_membre BEFORE INSERT OR UPDATE ON public.departement_bureau
  FOR EACH ROW EXECUTE FUNCTION public.check_bureau_membre();

-- 4. Rapport d'activité enrichi
ALTER TABLE public.activites_departement
  ADD COLUMN IF NOT EXISTS objectif text,
  ADD COLUMN IF NOT EXISTS nb_participants integer,
  ADD COLUMN IF NOT EXISTS resultats text,
  ADD COLUMN IF NOT EXISTS difficultes text,
  ADD COLUMN IF NOT EXISTS actions_a_entreprendre text;

CREATE INDEX IF NOT EXISTS idx_dm_dept ON public.departement_membres(departement_id);
CREATE INDEX IF NOT EXISTS idx_db_dept ON public.departement_bureau(departement_id);