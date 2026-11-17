CREATE OR REPLACE FUNCTION public.em_directory(_year uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'membre_id',m.id,'nom',m.nom,'prenoms',m.prenoms,'telephone',m.telephone,'matricule',m.matricule,'year_id',e.year_id,'classe',e.classe,'admission',e.admission,'statut',e.statut,'notes',e.notes,'temple_id',t.id,'temple',t.nom_temple,'pays_id',t.pays_id,'pays',coalesce(p.nom,t.pays),'ville',t.ville,'pasteur',t.pasteur_responsable,'contact',t.telephone,'mentor',(SELECT string_agg(pr.nom,', ' ORDER BY pr.nom) FROM public.em_assignments a JOIN public.profiles pr ON pr.id=a.user_id WHERE a.year_id=e.year_id AND a.classe=e.classe AND a.actif))), '[]'::jsonb) FROM public.em_enrollments e JOIN public.membres m ON m.id=e.membre_id JOIN public.temples t ON t.id=m.temple_id LEFT JOIN public.pays p ON p.id=t.pays_id WHERE (_year IS NULL OR e.year_id=_year) AND public.em_read_enrollment(e.id) $$;
CREATE OR REPLACE FUNCTION public.em_read_report(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.em_reports r WHERE r.id=_id AND (public.em_principal() OR (r.type<>'garde' AND public.em_local(r.temple_id)) OR (r.type='garde' AND public.em_class(r.year_id,r.classe)))) $$;
DROP POLICY em_report_read ON public.em_reports;
CREATE POLICY em_report_read ON public.em_reports FOR SELECT TO authenticated USING(public.em_principal() OR (type<>'garde' AND public.em_local(temple_id)) OR (type='garde' AND public.em_class(year_id,classe)));
CREATE OR REPLACE FUNCTION public.em_report_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.em_enrollments; mt uuid; item jsonb; extra jsonb; ids uuid[]:=ARRAY[]::uuid[]; snapshot jsonb:='[]'::jsonb; n integer;
BEGIN
 IF NOT public.em_access() THEN RAISE EXCEPTION 'Accès EM interdit' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.auteur_id<>auth.uid() OR NEW.statut NOT IN ('brouillon','soumis') THEN RAISE EXCEPTION 'Auteur ou statut initial invalide'; END IF;
  NEW.observations=''; NEW.reviewed_at=NULL; NEW.reviewed_by=NULL;
  IF NEW.type<>'garde' THEN
   SELECT * INTO e FROM public.em_enrollments WHERE id=NEW.enrollment_id; IF NOT FOUND THEN RAISE EXCEPTION 'Inscription inexistante'; END IF;
   IF NEW.type='cellule' AND e.classe NOT IN ('P3','P4','P5') THEN RAISE EXCEPTION 'Le rapport de cellule est réservé aux classes P3, P4 et P5' USING ERRCODE='42501'; END IF;
   SELECT temple_id INTO mt FROM public.membres WHERE id=e.membre_id;
   IF NOT public.em_local(mt) THEN RAISE EXCEPTION 'Rapport pastoral réservé au pasteur local' USING ERRCODE='42501'; END IF;
   NEW.year_id=e.year_id; NEW.classe=e.classe; NEW.temple_id=mt;
   SELECT jsonb_build_object('enrollment_id',e.id,'membre_id',m.id,'year_id',e.year_id,'nom',m.nom,'prenoms',m.prenoms,'telephone',m.telephone,'matricule',m.matricule,'admission',e.admission,'temple_id',t.id,'temple',t.nom_temple,'pays_id',p.id,'pays',coalesce(p.nom,t.pays),'ville',t.ville,'pasteur',t.pasteur_responsable,'contact',t.telephone,'mentor',(SELECT string_agg(pr.nom,', ' ORDER BY pr.nom) FROM public.em_assignments a JOIN public.profiles pr ON pr.id=a.user_id WHERE a.year_id=e.year_id AND a.classe=e.classe AND a.actif)) INTO NEW.identification FROM public.membres m JOIN public.temples t ON t.id=m.temple_id LEFT JOIN public.pays p ON p.id=t.pays_id WHERE m.id=e.membre_id;
  ELSE
   IF NOT public.em_class(NEW.year_id,NEW.classe) THEN RAISE EXCEPTION 'Tour de garde réservé au mentor affecté' USING ERRCODE='42501'; END IF;
   SELECT jsonb_build_object('mentor_id',p.id,'mentor',p.nom,'temple_id',t.id,'temple',t.nom_temple,'pays_id',t.pays_id,'pays',t.pays,'contact',t.telephone,'year_id',NEW.year_id,'classe',NEW.classe) INTO NEW.identification FROM public.profiles p LEFT JOIN public.temples t ON t.id=p.temple_id WHERE p.id=auth.uid();
  END IF;
 ELSE
  IF ROW(NEW.year_id,NEW.enrollment_id,NEW.classe,NEW.temple_id,NEW.type,NEW.auteur_id,NEW.identification) IS DISTINCT FROM ROW(OLD.year_id,OLD.enrollment_id,OLD.classe,OLD.temple_id,OLD.type,OLD.auteur_id,OLD.identification) THEN RAISE EXCEPTION 'Identification verrouillée'; END IF;
  IF public.em_principal() THEN
   IF NEW.contenu IS DISTINCT FROM OLD.contenu THEN RAISE EXCEPTION 'Administration : le contenu de l’auteur est immuable'; END IF;
   IF OLD.statut='brouillon' OR NEW.statut='soumis' THEN RAISE EXCEPTION 'Transition administrative invalide'; END IF;
   IF NEW.statut IN ('rejete','complement','brouillon') AND length(trim(NEW.observations))=0 THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
   NEW.reviewed_at=now(); NEW.reviewed_by=auth.uid();
  ELSE
   IF NEW.auteur_id<>auth.uid() OR OLD.statut NOT IN ('brouillon','complement') OR NEW.statut NOT IN ('brouillon','soumis') THEN RAISE EXCEPTION 'Rapport verrouillé : réouverture requise' USING ERRCODE='42501'; END IF;
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
    SELECT jsonb_build_object('nom',concat_ws(' ',m.nom,m.prenoms),'temple_id',t.id,'temple',t.nom_temple,'pays_id',p.id,'pays',coalesce(p.nom,t.pays)) INTO extra FROM public.em_enrollments en JOIN public.membres m ON m.id=en.membre_id JOIN public.temples t ON t.id=m.temple_id LEFT JOIN public.pays p ON p.id=t.pays_id WHERE en.id=(item->>'id')::uuid;
    snapshot=snapshot||jsonb_build_array(item||extra);
    ids=array_append(ids,(item->>'id')::uuid);
   END LOOP;
   NEW.contenu=jsonb_set(NEW.contenu,'{attendance}',snapshot,false);
   IF cardinality(ids)<>n THEN RAISE EXCEPTION 'Chaque étudiant actif doit être renseigné'; END IF;
   IF coalesce(NEW.contenu->>'responsable_id','')='' THEN RAISE EXCEPTION 'Responsable de prière obligatoire'; END IF;
   IF NOT ((NEW.contenu->>'responsable_id')::uuid=ANY(ids)) THEN RAISE EXCEPTION 'Responsable hors classe'; END IF;
  END IF;
  NEW.submitted_at=now();
 ELSIF TG_OP='UPDATE' THEN NEW.submitted_at=OLD.submitted_at; ELSE NEW.submitted_at=NULL;
 END IF;
 RETURN NEW;
END $$;