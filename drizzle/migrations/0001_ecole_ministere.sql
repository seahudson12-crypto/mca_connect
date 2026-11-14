CREATE TABLE public.em_years (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nom text NOT NULL UNIQUE, debut date NOT NULL, fin date NOT NULL, actif boolean NOT NULL DEFAULT false, archive boolean NOT NULL DEFAULT false, CHECK(fin>debut), CHECK(NOT(actif AND archive)));
GRANT SELECT,INSERT,UPDATE ON public.em_years TO authenticated;
GRANT ALL ON public.em_years TO service_role;
ALTER TABLE public.em_years ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX em_active_year ON public.em_years(actif) WHERE actif;
CREATE TABLE public.em_mentors (user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.em_mentors TO authenticated;
GRANT ALL ON public.em_mentors TO service_role;
ALTER TABLE public.em_mentors ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.em_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.em_mentors(user_id), year_id uuid NOT NULL REFERENCES public.em_years(id), classe text NOT NULL CHECK(classe IN ('CPEM','P1','P2','P3','P4','P5')), actif boolean NOT NULL DEFAULT true, UNIQUE(user_id,year_id,classe));
GRANT SELECT,INSERT,UPDATE ON public.em_assignments TO authenticated;
GRANT ALL ON public.em_assignments TO service_role;
ALTER TABLE public.em_assignments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.em_enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membre_id uuid NOT NULL REFERENCES public.membres(id), year_id uuid NOT NULL REFERENCES public.em_years(id), classe text NOT NULL CHECK(classe IN ('CPEM','P1','P2','P3','P4','P5')), admission date NOT NULL DEFAULT current_date, statut text NOT NULL DEFAULT 'actif' CHECK(statut IN ('actif','suspendu','transfere','diplome','abandonne')), notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.em_enrollments TO authenticated;
GRANT ALL ON public.em_enrollments TO service_role;
ALTER TABLE public.em_enrollments ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX em_unique_enrollment ON public.em_enrollments(membre_id,year_id) WHERE statut IN ('actif','suspendu');
CREATE TABLE public.em_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), year_id uuid NOT NULL REFERENCES public.em_years(id), enrollment_id uuid REFERENCES public.em_enrollments(id), classe text NOT NULL CHECK(classe IN ('CPEM','P1','P2','P3','P4','P5')), temple_id uuid REFERENCES public.temples(id), type text NOT NULL CHECK(type IN ('priere','cellule','garde')), auteur_id uuid NOT NULL DEFAULT auth.uid(), statut text NOT NULL DEFAULT 'brouillon' CHECK(statut IN ('brouillon','soumis','examen','complement','reserve','valide','rejete')), contenu jsonb NOT NULL DEFAULT '{}', identification jsonb NOT NULL DEFAULT '{}', observations text NOT NULL DEFAULT '', submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid, created_at timestamptz NOT NULL DEFAULT now(), CHECK((type='garde' AND enrollment_id IS NULL AND temple_id IS NULL) OR (type<>'garde' AND enrollment_id IS NOT NULL AND temple_id IS NOT NULL)));
GRANT SELECT,INSERT,UPDATE ON public.em_reports TO authenticated;
GRANT ALL ON public.em_reports TO service_role;
ALTER TABLE public.em_reports ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.em_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity text NOT NULL, entity_id uuid NOT NULL, acteur_id uuid, action text NOT NULL, avant jsonb, apres jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.em_audit TO authenticated;
GRANT ALL ON public.em_audit TO service_role;
ALTER TABLE public.em_audit ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.em_principal() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_principal(auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND actif) $$;
CREATE FUNCTION public.em_local(_temple uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'admin_temple') AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND actif AND temple_id=_temple) $$;
CREATE FUNCTION public.em_class(_year uuid,_classe text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND actif) AND EXISTS(SELECT 1 FROM public.em_assignments WHERE user_id=auth.uid() AND year_id=_year AND classe=_classe AND actif) $$;
CREATE FUNCTION public.em_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND actif) AND (public.em_principal() OR public.has_role(auth.uid(),'admin_temple') OR EXISTS(SELECT 1 FROM public.em_mentors WHERE user_id=auth.uid())) $$;
CREATE FUNCTION public.em_read_enrollment(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.em_enrollments e JOIN public.membres m ON m.id=e.membre_id WHERE e.id=_id AND (public.em_principal() OR public.em_local(m.temple_id) OR public.em_class(e.year_id,e.classe))) $$;
CREATE FUNCTION public.em_read_report(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.em_reports r WHERE r.id=_id AND (public.em_principal() OR (r.type<>'garde' AND public.em_local(r.temple_id)) OR public.em_class(r.year_id,r.classe))) $$;
REVOKE ALL ON FUNCTION public.em_principal(),public.em_local(uuid),public.em_class(uuid,text),public.em_access(),public.em_read_enrollment(uuid),public.em_read_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.em_principal(),public.em_local(uuid),public.em_class(uuid,text),public.em_access(),public.em_read_enrollment(uuid),public.em_read_report(uuid) TO authenticated,service_role;
CREATE POLICY em_year_read ON public.em_years FOR SELECT TO authenticated USING(public.em_access());
CREATE POLICY em_year_insert ON public.em_years FOR INSERT TO authenticated WITH CHECK(public.em_principal());
CREATE POLICY em_year_update ON public.em_years FOR UPDATE TO authenticated USING(public.em_principal()) WITH CHECK(public.em_principal());
CREATE POLICY em_mentor_read ON public.em_mentors FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.em_principal());
CREATE POLICY em_mentor_insert ON public.em_mentors FOR INSERT TO authenticated WITH CHECK(public.em_principal());
CREATE POLICY em_assignment_read ON public.em_assignments FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.em_principal());
CREATE POLICY em_assignment_insert ON public.em_assignments FOR INSERT TO authenticated WITH CHECK(public.em_principal());
CREATE POLICY em_assignment_update ON public.em_assignments FOR UPDATE TO authenticated USING(public.em_principal()) WITH CHECK(public.em_principal());
CREATE POLICY em_enrollment_read ON public.em_enrollments FOR SELECT TO authenticated USING(public.em_read_enrollment(id));
CREATE POLICY em_enrollment_insert ON public.em_enrollments FOR INSERT TO authenticated WITH CHECK(public.em_principal());
CREATE POLICY em_enrollment_update ON public.em_enrollments FOR UPDATE TO authenticated USING(public.em_principal()) WITH CHECK(public.em_principal());
CREATE POLICY em_report_read ON public.em_reports FOR SELECT TO authenticated USING(public.em_read_report(id));
CREATE POLICY em_report_insert ON public.em_reports FOR INSERT TO authenticated WITH CHECK(auteur_id=auth.uid() AND public.em_access());
CREATE POLICY em_report_update ON public.em_reports FOR UPDATE TO authenticated USING(public.em_read_report(id)) WITH CHECK(public.em_read_report(id));
CREATE POLICY em_audit_read ON public.em_audit FOR SELECT TO authenticated USING(public.em_principal() OR (entity='em_enrollments' AND public.em_read_enrollment(entity_id)) OR (entity='em_reports' AND public.em_read_report(entity_id)));
CREATE FUNCTION public.em_directory(_year uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'membre_id',m.id,'nom',m.nom,'prenoms',m.prenoms,'telephone',m.telephone,'matricule',m.matricule,'year_id',e.year_id,'classe',e.classe,'admission',e.admission,'statut',e.statut,'notes',e.notes,'temple_id',t.id,'temple',t.nom_temple,'pays_id',t.pays_id,'pays',coalesce(p.nom,t.pays),'ville',t.ville,'pasteur',t.pasteur_responsable,'contact',t.telephone)), '[]'::jsonb) FROM public.em_enrollments e JOIN public.membres m ON m.id=e.membre_id JOIN public.temples t ON t.id=m.temple_id LEFT JOIN public.pays p ON p.id=t.pays_id WHERE (_year IS NULL OR e.year_id=_year) AND public.em_read_enrollment(e.id) $$;
CREATE FUNCTION public.em_users() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nom',nom,'email',email)), '[]'::jsonb) FROM public.profiles WHERE actif AND public.em_principal() $$;
REVOKE ALL ON FUNCTION public.em_directory(uuid),public.em_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.em_directory(uuid),public.em_users() TO authenticated,service_role;
CREATE FUNCTION public.em_enrollment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NOT public.em_principal() THEN RAISE EXCEPTION 'Admissions réservées au Super Admin Principal' USING ERRCODE='42501'; END IF; IF EXISTS(SELECT 1 FROM public.em_years WHERE id=NEW.year_id AND archive) THEN RAISE EXCEPTION 'Année archivée'; END IF; IF TG_OP='UPDATE' AND NEW.membre_id<>OLD.membre_id THEN RAISE EXCEPTION 'Fiche membre liée immuable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER em_enrollment_guard BEFORE INSERT OR UPDATE ON public.em_enrollments FOR EACH ROW EXECUTE FUNCTION public.em_enrollment_guard();
CREATE FUNCTION public.em_report_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.em_enrollments; mt uuid; item jsonb; ids uuid[]:=ARRAY[]::uuid[]; n integer;
BEGIN
 IF NOT public.em_access() THEN RAISE EXCEPTION 'Accès EM interdit' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.auteur_id<>auth.uid() OR NEW.statut NOT IN ('brouillon','soumis') THEN RAISE EXCEPTION 'Auteur ou statut initial invalide'; END IF;
  NEW.observations=''; NEW.reviewed_at=NULL; NEW.reviewed_by=NULL;
  IF NEW.type<>'garde' THEN
   SELECT * INTO e FROM public.em_enrollments WHERE id=NEW.enrollment_id; IF NOT FOUND THEN RAISE EXCEPTION 'Inscription inexistante'; END IF;
   SELECT temple_id INTO mt FROM public.membres WHERE id=e.membre_id;
   IF NOT public.em_local(mt) THEN RAISE EXCEPTION 'Rapport pastoral réservé au pasteur local' USING ERRCODE='42501'; END IF;
   NEW.year_id=e.year_id; NEW.classe=e.classe; NEW.temple_id=mt;
   SELECT jsonb_build_object('nom',m.nom,'prenoms',m.prenoms,'telephone',m.telephone,'matricule',m.matricule,'admission',e.admission,'temple',t.nom_temple,'pays',coalesce(p.nom,t.pays),'ville',t.ville,'pasteur',t.pasteur_responsable,'contact',t.telephone) INTO NEW.identification FROM public.membres m JOIN public.temples t ON t.id=m.temple_id LEFT JOIN public.pays p ON p.id=t.pays_id WHERE m.id=e.membre_id;
  ELSE
   IF NOT public.em_class(NEW.year_id,NEW.classe) THEN RAISE EXCEPTION 'Tour de garde réservé au mentor affecté' USING ERRCODE='42501'; END IF;
   SELECT jsonb_build_object('mentor',p.nom,'temple',t.nom_temple,'pays',t.pays,'contact',t.telephone) INTO NEW.identification FROM public.profiles p LEFT JOIN public.temples t ON t.id=p.temple_id WHERE p.id=auth.uid();
  END IF;
 ELSE
  IF ROW(NEW.year_id,NEW.enrollment_id,NEW.classe,NEW.temple_id,NEW.type,NEW.auteur_id,NEW.identification) IS DISTINCT FROM ROW(OLD.year_id,OLD.enrollment_id,OLD.classe,OLD.temple_id,OLD.type,OLD.auteur_id,OLD.identification) THEN RAISE EXCEPTION 'Identification verrouillée'; END IF;
  IF public.em_principal() THEN
   IF NEW.contenu IS DISTINCT FROM OLD.contenu THEN RAISE EXCEPTION 'Administration : le contenu de l’auteur est immuable'; END IF;
   IF OLD.statut='brouillon' OR NEW.statut='soumis' THEN RAISE EXCEPTION 'Transition administrative invalide'; END IF;
   IF NEW.statut IN ('rejete','complement','brouillon') AND length(trim(NEW.observations))=0 THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
   NEW.reviewed_at=now(); NEW.reviewed_by=auth.uid();
  ELSE
   IF NEW.auteur_id<>auth.uid() OR OLD.statut NOT IN ('brouillon','complement') OR NEW.statut NOT IN ('brouillon','soumis') OR (NEW.type='garde' AND OLD.statut<>'brouillon') THEN RAISE EXCEPTION 'Rapport verrouillé : réouverture requise' USING ERRCODE='42501'; END IF;
   IF (NEW.type='garde' AND NOT public.em_class(NEW.year_id,NEW.classe)) OR (NEW.type<>'garde' AND NOT public.em_local(NEW.temple_id)) THEN RAISE EXCEPTION 'Périmètre interdit' USING ERRCODE='42501'; END IF;
   IF ROW(NEW.observations,NEW.reviewed_at,NEW.reviewed_by) IS DISTINCT FROM ROW(OLD.observations,OLD.reviewed_at,OLD.reviewed_by) THEN RAISE EXCEPTION 'Validation réservée à l’administration'; END IF;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.em_years WHERE id=NEW.year_id AND archive) AND NOT public.em_principal() THEN RAISE EXCEPTION 'Année archivée'; END IF;
 IF NEW.statut='soumis' AND (TG_OP='INSERT' OR OLD.statut<>'soumis') THEN
  IF coalesce(NEW.contenu->>'attestant','')='' OR coalesce(NEW.contenu->>'fonction','')='' OR coalesce(NEW.contenu->>'attestation','false')<>'true' THEN RAISE EXCEPTION 'Nom, fonction et validation électronique obligatoires'; END IF;
  IF NEW.type='garde' THEN
   IF coalesce(NEW.contenu->>'date','')='' OR jsonb_typeof(NEW.contenu->'attendance') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Date et présences obligatoires'; END IF;
   SELECT count(*) INTO n FROM public.em_enrollments WHERE year_id=NEW.year_id AND classe=NEW.classe AND statut='actif';
   FOR item IN SELECT * FROM jsonb_array_elements(NEW.contenu->'attendance') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.em_enrollments WHERE id=(item->>'id')::uuid AND year_id=NEW.year_id AND classe=NEW.classe AND statut='actif') OR (item->>'id')::uuid=ANY(ids) THEN RAISE EXCEPTION 'Présence hors classe ou dupliquée'; END IF;
    IF coalesce(item->>'presence','') NOT IN ('P','A','J') OR coalesce(item->>'participation','') NOT IN ('active','moyenne','faible') OR jsonb_typeof(item->'ponctuel') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Présence invalide'; END IF;
    ids=array_append(ids,(item->>'id')::uuid);
   END LOOP;
   IF cardinality(ids)<>n THEN RAISE EXCEPTION 'Chaque étudiant actif doit être renseigné'; END IF;
   IF coalesce(NEW.contenu->>'responsable_id','')='' THEN RAISE EXCEPTION 'Responsable de prière obligatoire'; END IF;
   IF NOT ((NEW.contenu->>'responsable_id')::uuid=ANY(ids)) THEN RAISE EXCEPTION 'Responsable hors classe'; END IF;
  END IF;
  NEW.submitted_at=now();
 ELSIF TG_OP='UPDATE' THEN NEW.submitted_at=OLD.submitted_at; ELSE NEW.submitted_at=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER em_report_guard BEFORE INSERT OR UPDATE ON public.em_reports FOR EACH ROW EXECUTE FUNCTION public.em_report_guard();
CREATE FUNCTION public.em_audit_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE obj jsonb; BEGIN obj=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; INSERT INTO public.em_audit(entity,entity_id,acteur_id,action,avant,apres) VALUES(TG_TABLE_NAME,coalesce(obj->>'id',obj->>'user_id')::uuid,auth.uid(),TG_OP,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END); RETURN NEW; END $$;
CREATE TRIGGER em_year_audit AFTER INSERT OR UPDATE ON public.em_years FOR EACH ROW EXECUTE FUNCTION public.em_audit_event();
CREATE TRIGGER em_mentor_audit AFTER INSERT ON public.em_mentors FOR EACH ROW EXECUTE FUNCTION public.em_audit_event();
CREATE TRIGGER em_assignment_audit AFTER INSERT OR UPDATE ON public.em_assignments FOR EACH ROW EXECUTE FUNCTION public.em_audit_event();
CREATE TRIGGER em_enrollment_audit AFTER INSERT OR UPDATE ON public.em_enrollments FOR EACH ROW EXECUTE FUNCTION public.em_audit_event();
CREATE TRIGGER em_report_audit AFTER INSERT OR UPDATE ON public.em_reports FOR EACH ROW EXECUTE FUNCTION public.em_audit_event();
REVOKE ALL ON FUNCTION public.em_enrollment_guard(),public.em_report_guard(),public.em_audit_event() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.em_activate_year(_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NOT public.em_principal() THEN RAISE EXCEPTION 'Accès interdit' USING ERRCODE='42501'; END IF; PERFORM pg_advisory_xact_lock(17261001); IF NOT EXISTS(SELECT 1 FROM public.em_years WHERE id=_id AND NOT archive) THEN RAISE EXCEPTION 'Année inexistante ou archivée'; END IF; UPDATE public.em_years SET actif=false WHERE actif; UPDATE public.em_years SET actif=true WHERE id=_id; END $$;
REVOKE ALL ON FUNCTION public.em_activate_year(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.em_activate_year(uuid) TO authenticated,service_role;