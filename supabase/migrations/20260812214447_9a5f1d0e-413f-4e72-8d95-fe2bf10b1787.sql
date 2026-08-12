CREATE OR REPLACE FUNCTION public.protect_matricule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.matricule IS DISTINCT FROM OLD.matricule THEN
    IF auth.uid() IS NOT NULL
       AND public.is_admin(auth.uid())
       AND public.can_access_temple(auth.uid(), NEW.temple_id) THEN
      IF NEW.matricule IS NULL OR btrim(NEW.matricule) = '' THEN
        NEW.matricule := OLD.matricule;
      END IF;
      RETURN NEW;
    END IF;
    NEW.matricule := OLD.matricule;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_matricule() FROM PUBLIC, anon, authenticated;