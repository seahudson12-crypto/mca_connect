import {describe,it,before,after} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {attendanceStats,canEditReport,CLASSES,type Attendance} from './em';
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const db=new PGlite();
async function user(n:number){await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid(n)}',false); SET ROLE authenticated;`);}
async function rows(sql:string){return (await db.query(sql)).rows as Record<string,unknown>[];}
async function rejected(sql:string){await assert.rejects(()=>db.exec(sql));}
const report=(type:string,student=21)=>`INSERT INTO public.em_reports(year_id,enrollment_id,classe,temple_id,type) VALUES('${uid(30)}','${uid(student)}','P2','${uid(10)}','${type}') RETURNING id`;
let prayerId='',cellId='',guardId='';
describe('EM: contrôles réels PostgreSQL dans une base isolée',()=>{
 before(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,nom text,email text,temple_id uuid,actif boolean DEFAULT true);
 CREATE TABLE public.user_roles(user_id uuid,role text);
 CREATE TABLE public.pays(id uuid PRIMARY KEY,nom text);
 CREATE TABLE public.temples(id uuid PRIMARY KEY,nom_temple text,pays_id uuid,pays text,ville text,pasteur_responsable text,telephone text);
 CREATE TABLE public.membres(id uuid PRIMARY KEY,temple_id uuid,nom text,prenoms text,telephone text,matricule text);
 CREATE FUNCTION public.is_principal(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='super_admin_principal') $$;
 CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role=r) $$;
 GRANT SELECT ON public.profiles TO authenticated;
 INSERT INTO public.pays VALUES('${uid(50)}','Côte d’Ivoire'),('${uid(51)}','Maroc');
 INSERT INTO public.temples VALUES('${uid(10)}','Treichville','${uid(50)}','Côte d’Ivoire','Abidjan','Pasteur T','1'),('${uid(11)}','Casablanca','${uid(51)}','Maroc','Casablanca','Pasteur C','2');
 INSERT INTO public.profiles(id,nom,temple_id) VALUES('${uid(1)}','Principal','${uid(10)}'),('${uid(2)}','Admin T','${uid(10)}'),('${uid(3)}','Admin C','${uid(11)}'),('${uid(4)}','Mentor','${uid(10)}'),('${uid(5)}','Utilisateur','${uid(10)}');
 INSERT INTO public.user_roles VALUES('${uid(1)}','super_admin_principal'),('${uid(2)}','admin_temple'),('${uid(3)}','admin_temple');
 INSERT INTO public.membres VALUES('${uid(20)}','${uid(10)}','A','T',NULL,'MCA-CI-0001'),('${uid(22)}','${uid(11)}','B','C',NULL,'MCA-MA-0001'),('${uid(24)}','${uid(10)}','C','T',NULL,'MCA-CI-0002');`);
 await db.exec(readFileSync('drizzle/migrations/0001_ecole_ministere.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0002_em_insert_read_paths.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0003_em_preserve_years_and_submission.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0004_em_transfer_audit_permission.sql','utf8'));
 await user(1);
 await db.exec(`INSERT INTO public.em_years(id,nom,debut,fin,actif) VALUES('${uid(30)}','2026-2027','2026-11-01','2027-10-31',true),('${uid(31)}','2025-2026','2025-11-01','2026-10-31',false);
 INSERT INTO public.em_mentors VALUES('${uid(4)}'); INSERT INTO public.em_assignments(user_id,year_id,classe) VALUES('${uid(4)}','${uid(30)}','P2');
 INSERT INTO public.em_enrollments(id,membre_id,year_id,classe) VALUES('${uid(21)}','${uid(20)}','${uid(30)}','P2'),('${uid(23)}','${uid(22)}','${uid(30)}','P2'),('${uid(25)}','${uid(24)}','${uid(30)}','P1'),('${uid(26)}','${uid(24)}','${uid(31)}','P5');`);
 });
 after(()=>db.close());
 it('1. Principal : tous les pays et temples, sans mélanger les années',async()=>{await user(1);assert.equal((await rows(`SELECT * FROM public.em_enrollments WHERE year_id='${uid(30)}'`)).length,3);assert.equal((await rows(`SELECT public.em_directory('${uid(30)}') AS d`))[0]?.d instanceof Array,true);});
 it('2. Admin Treichville : uniquement son temple, admission refusée',async()=>{await user(2);const r=await rows('SELECT public.em_directory() AS d');assert.equal((r[0]?.d as unknown[]).length,3);await rejected(`INSERT INTO public.em_enrollments(membre_id,year_id,classe) VALUES('${uid(22)}','${uid(31)}','P2')`);});
 it('3. Admin Casablanca : uniquement Casablanca',async()=>{await user(3);assert.equal((await rows('SELECT * FROM public.em_enrollments')).length,1);assert.equal((await rows('SELECT * FROM public.em_enrollments'))[0]?.id,uid(23));});
 it('4. Mentor P2 : deux pays accessibles',async()=>{await user(4);const r=await rows('SELECT public.em_directory() AS d');assert.equal((r[0]?.d as unknown[]).length,2);});
 it('5. Mentor : autres classes et utilisateur sans permission bloqués',async()=>{await user(4);assert.equal((await rows(`SELECT * FROM public.em_enrollments WHERE classe IN ('P1','P3','P4','P5')`)).length,0);await user(5);assert.equal((await rows('SELECT * FROM public.em_enrollments')).length,0);assert.equal((await rows('SELECT public.em_access() AS ok'))[0]?.ok,false);});
 it('6. Deux rapports pastoraux : brouillon, soumission et temple forcé',async()=>{await user(2);prayerId=String((await rows(report('priere')))[0]?.id);cellId=String((await rows(report('cellule')))[0]?.id);await rejected(`UPDATE public.em_reports SET statut='soumis' WHERE id='${prayerId}'`);for(const id of [prayerId,cellId])await db.exec(`UPDATE public.em_reports SET contenu='{"attestant":"Pasteur T","fonction":"Pasteur Principal","attestation":true,"date_attestation":"2026-11-15"}',statut='soumis' WHERE id='${id}'`);await rejected(report('priere',23));});
 it('7. Principal : réception, motif obligatoire, validation et verrouillage',async()=>{await user(1);assert.equal((await rows("SELECT * FROM public.em_reports WHERE statut='soumis'")).length,2);await rejected(`UPDATE public.em_reports SET statut='rejete',observations='' WHERE id='${cellId}'`);await db.exec(`UPDATE public.em_reports SET statut='valide' WHERE id='${prayerId}'`);await user(2);await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${prayerId}'`);});
 it('8. Mentor : soumission tour de garde, auteur et classe vérifiés',async()=>{await user(4);await rejected(`INSERT INTO public.em_reports(year_id,classe,type) VALUES('${uid(30)}','P1','garde')`);guardId=String((await rows(`INSERT INTO public.em_reports(year_id,classe,type) VALUES('${uid(30)}','P2','garde') RETURNING id`))[0]?.id);const content={attestant:'Mentor',fonction:'Mentor EM',attestation:true,date:'2026-11-15',date_attestation:'2026-11-15',responsable_id:uid(21),attendance:[{id:uid(21),nom:'A T',presence:'P',ponctuel:false,participation:'active'},{id:uid(23),nom:'B C',presence:'J',ponctuel:true,participation:'faible'}],evaluation_0:'Satisfaisant',evaluation_1:'Satisfaisant',evaluation_2:'Satisfaisant',evaluation_3:'Satisfaisant',evaluation_4:'Satisfaisant',evaluation_5:'Satisfaisant'};await db.exec(`UPDATE public.em_reports SET contenu='${JSON.stringify(content)}',statut='soumis' WHERE id='${guardId}'`);await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${guardId}'`);});
 it('9. Présences, évaluations et calculs conservés',async()=>{await user(1);const r=await rows(`SELECT contenu FROM public.em_reports WHERE id='${guardId}'`);const data=r[0]?.contenu as {attendance:Attendance[];evaluation_0:string};assert.equal(data.evaluation_0,'Satisfaisant');assert.deepEqual(attendanceStats(data.attendance),{presents:1,absents:0,justifies:1,retards:1,taux:50,active:1,moyenne:0,faible:0});});
 it('10. Archives et historique immuables, réouverture motivée',async()=>{await user(1);await db.exec(`UPDATE public.em_reports SET statut='brouillon',observations='Compléter le suivi' WHERE id='${prayerId}'; UPDATE public.em_years SET archive=true,actif=false WHERE id='${uid(30)}'`);assert.ok((await rows(`SELECT * FROM public.em_audit WHERE entity_id='${prayerId}'`)).length>=4);await user(2);assert.ok((await rows('SELECT * FROM public.em_reports')).length>=2);await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${prayerId}'`);await rejected('UPDATE public.em_audit SET action=\'FAUX\'');});
 it('11. Fiches, matricules et temples inchangés',async()=>{await db.exec('RESET ROLE');assert.equal((await rows('SELECT * FROM public.membres')).length,3);assert.equal((await rows('SELECT * FROM public.temples')).length,2);assert.equal((await rows(`SELECT matricule FROM public.membres WHERE id='${uid(20)}'`))[0]?.matricule,'MCA-CI-0001');});
 it('changement annuel : inscription précédente et rapports conservés',async()=>{await user(1);await rejected(`UPDATE public.em_enrollments SET year_id='${uid(31)}' WHERE id='${uid(21)}'`);const transfer=await rows(`SELECT public.em_transfer_year('${uid(21)}','${uid(31)}','P3','2025-11-01','actif','Nouvelle année') AS id`);assert.ok(transfer[0]?.id);assert.equal((await rows(`SELECT year_id FROM public.em_enrollments WHERE id='${uid(21)}'`))[0]?.year_id,uid(30));assert.ok((await rows(`SELECT * FROM public.em_reports WHERE enrollment_id='${uid(21)}'`)).length>0);await rejected(`SELECT public.em_transfer_year('${uid(21)}','${uid(31)}','P3','2025-11-01','actif','Doublon')`);});
});
describe('EM: règles de calcul et verrouillage',()=>{
 it('classes officielles exactes',()=>assert.deepEqual(CLASSES,['CPEM','P1','P2','P3','P4','P5']));
 it('absence de présences ne signifie pas 0 %',()=>assert.equal(attendanceStats([]).taux,null));
 it('rapport validé et tour soumis non modifiables',()=>{assert.equal(canEditReport(false,true,'valide','priere'),false);assert.equal(canEditReport(false,true,'soumis','garde'),false);assert.equal(canEditReport(false,true,'complement','garde'),false);assert.equal(canEditReport(false,true,'complement','priere'),true);});
});
