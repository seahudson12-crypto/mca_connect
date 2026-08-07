-- 1) Codes pays / temple sur les temples
ALTER TABLE public.temples
  ADD COLUMN IF NOT EXISTS code_pays TEXT,
  ADD COLUMN IF NOT EXISTS code_temple TEXT;

UPDATE public.temples SET code_pays = 'CI', code_temple = 'TR' WHERE id = '414254bf-5cfd-49f7-aca5-1d98b6824edf';
UPDATE public.temples SET code_pays = 'MA', code_temple = 'CS' WHERE id = '7f16fc61-22f4-49cb-bbbe-c60775101383';
UPDATE public.temples SET code_pays = 'BJ', code_temple = 'BN' WHERE id = '0ce1e193-540c-4b9a-b325-96806283e7ad';

-- Fallback pour tout futur temple sans code explicite
UPDATE public.temples
SET code_pays = COALESCE(code_pays, UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(pays, 'XX'), '[^A-Za-z]', '', 'g') FROM 1 FOR 2))),
    code_temple = COALESCE(code_temple, UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(ville, nom_temple), '[^A-Za-z]', '', 'g') FROM 1 FOR 2)))
WHERE code_pays IS NULL OR code_temple IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS temples_code_unique ON public.temples (code_pays, code_temple);

-- 2) Nouveaux champs de la fiche membre
ALTER TABLE public.membres
  ADD COLUMN IF NOT EXISTS matricule TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS observations TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS membres_matricule_unique ON public.membres (matricule);

-- 3) Génération du préfixe d'un temple
CREATE OR REPLACE FUNCTION public.temple_matricule_prefix(_temple_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'MCA-'
    || COALESCE(NULLIF(t.code_pays, ''), UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(t.pays,'XX'), '[^A-Za-z]', '', 'g') FROM 1 FOR 2)))
    || '-'
    || COALESCE(NULLIF(t.code_temple, ''), UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(t.ville, t.nom_temple), '[^A-Za-z]', '', 'g') FROM 1 FOR 2)))
  FROM public.temples t
  WHERE t.id = _temple_id
$$;

REVOKE ALL ON FUNCTION public.temple_matricule_prefix(UUID) FROM PUBLIC, anon;

-- 4) Attribution automatique du matricule
CREATE OR REPLACE FUNCTION public.assign_matricule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  IF NEW.matricule IS NOT NULL AND NEW.matricule <> '' THEN
    RETURN NEW;
  END IF;
  IF NEW.temple_id IS NULL THEN
    RETURN NEW;
  END IF;

  prefix := public.temple_matricule_prefix(NEW.temple_id);
  -- Verrou par temple pour éviter les collisions de séquence
  PERFORM pg_advisory_xact_lock(hashtext('matricule:' || prefix));

  SELECT COALESCE(MAX(CAST(RIGHT(m.matricule, 4) AS INT)), 0) + 1
  INTO next_num
  FROM public.membres m
  WHERE m.matricule LIKE prefix || '-%'
    AND m.matricule ~ ('^' || prefix || '-[0-9]{4,}$');

  NEW.matricule := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_matricule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_membres_matricule ON public.membres;
CREATE TRIGGER trg_membres_matricule
  BEFORE INSERT ON public.membres
  FOR EACH ROW EXECUTE FUNCTION public.assign_matricule();

-- Le matricule est définitif : on empêche sa modification
CREATE OR REPLACE FUNCTION public.protect_matricule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.matricule IS NOT NULL AND NEW.matricule IS DISTINCT FROM OLD.matricule THEN
    NEW.matricule := OLD.matricule;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_matricule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_membres_matricule_protect ON public.membres;
CREATE TRIGGER trg_membres_matricule_protect
  BEFORE UPDATE ON public.membres
  FOR EACH ROW EXECUTE FUNCTION public.protect_matricule();

-- 5) Backfill des membres existants (par temple, ordre d'ancienneté), sans doublon
DO $$
DECLARE
  r RECORD;
  prefix TEXT;
  counter INT;
BEGIN
  FOR r IN SELECT DISTINCT temple_id FROM public.membres WHERE matricule IS NULL AND temple_id IS NOT NULL LOOP
    prefix := public.temple_matricule_prefix(r.temple_id);
    SELECT COALESCE(MAX(CAST(RIGHT(matricule, 4) AS INT)), 0)
    INTO counter
    FROM public.membres
    WHERE matricule ~ ('^' || prefix || '-[0-9]{4,}$');

    FOR r IN
      SELECT id FROM public.membres
      WHERE temple_id = r.temple_id AND matricule IS NULL
      ORDER BY date_ajout, created_at, nom, prenoms
    LOOP
      counter := counter + 1;
      UPDATE public.membres SET matricule = prefix || '-' || LPAD(counter::TEXT, 4, '0') WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;