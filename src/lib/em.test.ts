import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  attendanceStats,
  canCreateReportForClass,
  canEditReport,
  CLASSES,
  reportLocations,
  reportMatchesLocation,
  reportPeriod,
  type Attendance,
} from "./em";

const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const db = new PGlite();
async function user(n: number) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid(n)}',false); SET ROLE authenticated;`,
  );
}
async function rows(sql: string) {
  return (await db.query(sql)).rows as Record<string, unknown>[];
}
async function rejected(sql: string) {
  await assert.rejects(() => db.exec(sql));
}
const report = (type: string, student = 21) =>
  `INSERT INTO public.em_reports(year_id,enrollment_id,classe,temple_id,type) VALUES('${uid(30)}','${uid(student)}','P2','${uid(10)}','${type}') RETURNING id`;
let prayerId = "";
let cellId = "";
let guardId = "";

describe("EM: huit scénarios et contrôles PostgreSQL dans une base isolée", () => {
  before(async () => {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,nom text,email text,temple_id uuid,actif boolean DEFAULT true);
      CREATE TABLE public.user_roles(user_id uuid,role text);
      CREATE TABLE public.pays(id uuid PRIMARY KEY,nom text);
      CREATE TABLE public.temples(id uuid PRIMARY KEY,nom_temple text,pays_id uuid,pays text,ville text,pasteur_responsable text,telephone text);
      CREATE TABLE public.membres(id uuid PRIMARY KEY,temple_id uuid,nom text,prenoms text,telephone text,matricule text,categorie text);
      CREATE FUNCTION public.is_principal(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role='super_admin_principal') $$;
      CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role=r) $$;
      GRANT SELECT ON public.profiles,public.membres,public.temples,public.pays TO authenticated;
      INSERT INTO public.pays VALUES('${uid(50)}','Côte d’Ivoire'),('${uid(51)}','Maroc');
      INSERT INTO public.temples VALUES('${uid(10)}','Treichville','${uid(50)}','Côte d’Ivoire','Abidjan','Pasteur T','1'),('${uid(11)}','Casablanca','${uid(51)}','Maroc','Casablanca','Pasteur C','2');
      INSERT INTO public.profiles(id,nom,temple_id) VALUES('${uid(1)}','Principal','${uid(10)}'),('${uid(2)}','Admin T','${uid(10)}'),('${uid(3)}','Admin C','${uid(11)}'),('${uid(4)}','Mentor P2','${uid(10)}'),('${uid(5)}','Utilisateur','${uid(10)}');
      INSERT INTO public.user_roles VALUES('${uid(1)}','super_admin_principal'),('${uid(2)}','admin_temple'),('${uid(3)}','admin_temple');
      INSERT INTO public.membres VALUES
        ('${uid(20)}','${uid(10)}','A','T',NULL,'MCA-CI-0001','appeles'),
        ('${uid(22)}','${uid(11)}','B','C',NULL,'MCA-MA-0001','serviteurs_de_dieu'),
        ('${uid(24)}','${uid(10)}','C','T',NULL,'MCA-CI-0002','appeles'),
        ('${uid(27)}','${uid(10)}','D','T',NULL,'MCA-CI-0003','serviteurs_de_dieu'),
        ('${uid(28)}','${uid(10)}','E','T',NULL,'MCA-CI-0004','hommes_adultes');`);
    for (const file of [
      "0001_ecole_ministere.sql",
      "0002_em_insert_read_paths.sql",
      "0003_em_preserve_years_and_submission.sql",
      "0004_em_transfer_audit_permission.sql",
      "0005_em_eligible_categories.sql",
      "0006_em_report_automation_rules.sql",
    ]) {
      await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
    }
    await user(1);
    await db.exec(`INSERT INTO public.em_years(id,nom,debut,fin,actif) VALUES('${uid(30)}','2026-2027','2026-11-01','2027-10-31',true),('${uid(31)}','2025-2026','2025-11-01','2026-10-31',false);
      INSERT INTO public.em_mentors VALUES('${uid(4)}');
      INSERT INTO public.em_assignments(user_id,year_id,classe) VALUES('${uid(4)}','${uid(30)}','P2');
      INSERT INTO public.em_enrollments(id,membre_id,year_id,classe) VALUES
        ('${uid(21)}','${uid(20)}','${uid(30)}','P2'),
        ('${uid(23)}','${uid(22)}','${uid(30)}','P2'),
        ('${uid(25)}','${uid(24)}','${uid(30)}','P1'),
        ('${uid(26)}','${uid(24)}','${uid(31)}','P5'),
        ('${uid(29)}','${uid(27)}','${uid(30)}','P3');`);
  });
  after(() => db.close());

  it("1. Le principal consulte tous les pays et temples sans mélanger les années", async () => {
    await user(1);
    assert.equal(
      (await rows(`SELECT * FROM public.em_enrollments WHERE year_id='${uid(30)}'`)).length,
      4,
    );
    const directory = await rows(`SELECT public.em_directory('${uid(30)}') AS d`);
    assert.equal(directory[0]?.d instanceof Array, true);
    const students = directory[0]?.d as { mentor: string }[];
    assert.equal(students.find((s) => s.mentor === "Mentor P2") !== undefined, true);
  });

  it("2. L’admin Treichville ne voit que son temple et ne peut pas admettre", async () => {
    await user(2);
    const directory = await rows("SELECT public.em_directory() AS d");
    assert.equal((directory[0]?.d as unknown[]).length, 4);
    await rejected(
      `INSERT INTO public.em_enrollments(membre_id,year_id,classe) VALUES('${uid(22)}','${uid(31)}','P2')`,
    );
  });

  it("3. L’admin Casablanca reste limité à Casablanca", async () => {
    await user(3);
    const visible = await rows("SELECT * FROM public.em_enrollments");
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.id, uid(23));
  });

  it("4. Le mentor P2 voit ses deux étudiants de deux pays, et aucune autre classe", async () => {
    await user(4);
    const directory = await rows("SELECT public.em_directory() AS d");
    assert.equal((directory[0]?.d as unknown[]).length, 2);
    assert.equal(
      (await rows(`SELECT * FROM public.em_enrollments WHERE classe IN ('P1','P3','P4','P5')`))
        .length,
      0,
    );
  });

  it("5. Un utilisateur sans affectation est bloqué", async () => {
    await user(5);
    assert.equal((await rows("SELECT * FROM public.em_enrollments")).length, 0);
    assert.equal((await rows("SELECT public.em_access() AS ok"))[0]?.ok, false);
  });

  it("6. Prière CPEM–P5 et cellule P3 autorisées ; cellule P1 et autre temple refusés", async () => {
    await user(2);
    prayerId = String((await rows(report("priere")))[0]?.id);
    cellId = String((await rows(report("cellule", 29)))[0]?.id);
    await rejected(report("cellule", 25));
    await rejected(report("priere", 23));
    await rejected(`UPDATE public.em_reports SET statut='soumis' WHERE id='${prayerId}'`);
    for (const id of [prayerId, cellId]) {
      await db.exec(
        `UPDATE public.em_reports SET contenu='{"attestant":"Pasteur T","fonction":"Pasteur Principal","attestation":true,"date_attestation":"2026-11-15","periode":"Novembre 2026"}',statut='soumis' WHERE id='${id}'`,
      );
    }
    assert.equal(
      (await rows(`SELECT classe FROM public.em_reports WHERE id='${cellId}'`))[0]?.classe,
      "P3",
    );
  });

  it("7. Le mentor ne peut pas lire les rapports pastoraux de sa classe", async () => {
    await user(4);
    assert.equal((await rows("SELECT * FROM public.em_reports")).length, 0);
    await user(1);
    await rejected(report("priere"));
  });

  it("8. Le principal reçoit, exige un motif, valide et verrouille", async () => {
    await user(1);
    assert.equal((await rows("SELECT * FROM public.em_reports WHERE statut='soumis'")).length, 2);
    await rejected(
      `UPDATE public.em_reports SET statut='rejete',observations='' WHERE id='${cellId}'`,
    );
    await db.exec(`UPDATE public.em_reports SET statut='valide' WHERE id='${prayerId}'`);
    await user(2);
    await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${prayerId}'`);
  });

  it("9. Le mentor P2 renseigne et transmet toutes les présences de deux pays", async () => {
    await user(4);
    await rejected(
      `INSERT INTO public.em_reports(year_id,classe,type) VALUES('${uid(30)}','P1','garde')`,
    );
    guardId = String(
      (
        await rows(
          `INSERT INTO public.em_reports(year_id,classe,type) VALUES('${uid(30)}','P2','garde') RETURNING id`,
        )
      )[0]?.id,
    );
    const content = {
      attestant: "Mentor P2",
      fonction: "Mentor EM",
      attestation: true,
      date: "2026-11-15",
      date_attestation: "2026-11-15",
      responsable_id: uid(21),
      attendance: [
        {
          id: uid(21),
          nom: "Nom falsifié",
          presence: "P",
          ponctuel: false,
          participation: "active",
        },
        { id: uid(23), nom: "B C", presence: "J", ponctuel: true, participation: "faible" },
      ],
      evaluation_0: "Satisfaisant",
      evaluation_1: "Satisfaisant",
      evaluation_2: "Satisfaisant",
      evaluation_3: "Satisfaisant",
      evaluation_4: "Satisfaisant",
      evaluation_5: "Satisfaisant",
    };
    await db.exec(
      `UPDATE public.em_reports SET contenu='${JSON.stringify(content)}',statut='soumis' WHERE id='${guardId}'`,
    );
    await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${guardId}'`);
    assert.equal((await rows("SELECT * FROM public.em_reports")).length, 1);
  });

  it("10. Le principal demande un complément et le mentor corrige sans perdre les versions", async () => {
    await user(1);
    await db.exec(
      `UPDATE public.em_reports SET statut='complement',observations='Préciser les retards' WHERE id='${guardId}'`,
    );
    await user(4);
    await db.exec(
      `UPDATE public.em_reports SET statut='brouillon',contenu=jsonb_set(contenu,'{observations}','"Retards précisés"') WHERE id='${guardId}'`,
    );
    const audit = await rows(`SELECT * FROM public.em_audit WHERE entity_id='${guardId}'`);
    assert.ok(audit.length >= 4);
    assert.ok(audit.every((event) => event.avant !== undefined));
  });

  it("11. Les calculs et les instantanés pays/temple sont conservés", async () => {
    await user(1);
    const result = await rows(`SELECT contenu FROM public.em_reports WHERE id='${guardId}'`);
    const data = result[0]?.contenu as {
      attendance: (Attendance & { pays: string; temple: string })[];
      evaluation_0: string;
    };
    assert.equal(data.evaluation_0, "Satisfaisant");
    assert.equal(data.attendance[0]?.nom, "A T");
    assert.equal(data.attendance[0]?.pays, "Côte d’Ivoire");
    assert.equal(data.attendance[1]?.pays, "Maroc");
    assert.deepEqual(attendanceStats(data.attendance), {
      presents: 1,
      absents: 0,
      justifies: 1,
      retards: 1,
      taux: 50,
      active: 1,
      moyenne: 0,
      faible: 0,
    });
  });

  it("12. Archives et historique restent lisibles ; une année archivée est verrouillée", async () => {
    await user(1);
    await db.exec(`UPDATE public.em_reports SET statut='brouillon',observations='Compléter le suivi' WHERE id='${prayerId}';
      UPDATE public.em_years SET archive=true,actif=false WHERE id='${uid(30)}'`);
    assert.ok(
      (await rows(`SELECT * FROM public.em_audit WHERE entity_id='${prayerId}'`)).length >= 4,
    );
    await user(2);
    assert.ok((await rows("SELECT * FROM public.em_reports")).length >= 2);
    await rejected(`UPDATE public.em_reports SET contenu='{}' WHERE id='${prayerId}'`);
    await rejected("UPDATE public.em_audit SET action='FAUX'");
  });

  it("13. Seuls Appelés et Serviteurs de Dieu sont admissibles", async () => {
    await user(1);
    await rejected(
      `INSERT INTO public.em_enrollments(membre_id,year_id,classe) VALUES('${uid(28)}','${uid(31)}','CPEM')`,
    );
  });

  it("14. Le transfert annuel conserve l’inscription et les rapports précédents", async () => {
    await user(1);
    await rejected(`UPDATE public.em_enrollments SET year_id='${uid(31)}' WHERE id='${uid(21)}'`);
    const transfer = await rows(
      `SELECT public.em_transfer_year('${uid(21)}','${uid(31)}','P3','2025-11-01','actif','Nouvelle année') AS id`,
    );
    assert.ok(transfer[0]?.id);
    assert.equal(
      (await rows(`SELECT year_id FROM public.em_enrollments WHERE id='${uid(21)}'`))[0]?.year_id,
      uid(30),
    );
    assert.ok(
      (await rows(`SELECT * FROM public.em_reports WHERE enrollment_id='${uid(21)}'`)).length > 0,
    );
    await rejected(
      `SELECT public.em_transfer_year('${uid(21)}','${uid(31)}','P3','2025-11-01','actif','Doublon')`,
    );
  });

  it("15. Aucune fiche, aucun matricule et aucun temple n’est modifié", async () => {
    await db.exec("RESET ROLE");
    assert.equal((await rows("SELECT * FROM public.membres")).length, 5);
    assert.equal((await rows("SELECT * FROM public.temples")).length, 2);
    assert.equal(
      (await rows(`SELECT matricule FROM public.membres WHERE id='${uid(20)}'`))[0]?.matricule,
      "MCA-CI-0001",
    );
  });
});

describe("EM: règles de formulaire, filtres et verrouillage", () => {
  it("classes officielles exactes", () => {
    assert.deepEqual(CLASSES, ["CPEM", "P1", "P2", "P3", "P4", "P5"]);
  });
  it("cellule limitée à P3, P4 et P5 dans tous les parcours", () => {
    for (const classe of CLASSES) {
      assert.equal(canCreateReportForClass("cellule", classe), ["P3", "P4", "P5"].includes(classe));
      assert.equal(canCreateReportForClass("priere", classe), true);
      assert.equal(canCreateReportForClass("garde", classe), true);
    }
  });
  it("complément rouvert pour les trois types, rapport soumis verrouillé", () => {
    assert.equal(canEditReport(false, true, "valide", "priere"), false);
    assert.equal(canEditReport(false, true, "soumis", "garde"), false);
    for (const type of ["priere", "cellule", "garde"]) {
      assert.equal(canEditReport(false, true, "complement", type), true);
    }
  });
  it("absence de présences ne signifie pas 0 %", () => {
    assert.equal(attendanceStats([]).taux, null);
  });
  it("les filtres utilisent l’instantané du rapport, pas une affectation ultérieure", () => {
    const snapshot = {
      type: "priere",
      temple_id: uid(10),
      enrollment_id: uid(21),
      identification: { temple_id: uid(10), pays_id: uid(50), nom: "A", prenoms: "T" },
      contenu: { periode: "Novembre 2026" },
    };
    assert.equal(reportMatchesLocation(snapshot, [], { country: uid(50) }), true);
    assert.equal(reportMatchesLocation(snapshot, [], { country: uid(51) }), false);
    assert.equal(reportMatchesLocation(snapshot, [], { student: uid(21) }), true);
    assert.equal(reportLocations(snapshot)[0]?.name, "A T");
    assert.equal(reportPeriod(snapshot), "Novembre 2026");
  });
  it("un brouillon de garde vide reste visible sans filtre géographique", () => {
    const snapshot = {
      type: "garde",
      temple_id: null,
      enrollment_id: null,
      identification: {},
      contenu: { attendance: [] },
    };
    assert.equal(reportMatchesLocation(snapshot, [], {}), true);
    assert.equal(reportMatchesLocation(snapshot, [], { country: uid(50) }), false);
  });
});
