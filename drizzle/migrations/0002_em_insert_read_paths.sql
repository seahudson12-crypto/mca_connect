CREATE FUNCTION public.em_member_local(_member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.membres WHERE id=_member AND public.em_local(temple_id)) $$;
REVOKE ALL ON FUNCTION public.em_member_local(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.em_member_local(uuid) TO authenticated,service_role;
DROP POLICY em_enrollment_read ON public.em_enrollments;
CREATE POLICY em_enrollment_read ON public.em_enrollments FOR SELECT TO authenticated USING(public.em_principal() OR public.em_member_local(membre_id) OR public.em_class(year_id,classe));
DROP POLICY em_report_read ON public.em_reports;
CREATE POLICY em_report_read ON public.em_reports FOR SELECT TO authenticated USING(public.em_principal() OR (type<>'garde' AND public.em_local(temple_id)) OR public.em_class(year_id,classe));