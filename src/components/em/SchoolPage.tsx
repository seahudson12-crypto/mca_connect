import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Plus, RefreshCw, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  emContext,
  emStudents,
  emReports,
  emCandidates,
  emSaveYear,
  emYearAction,
  emSaveEnrollment,
  emAssignMentor,
  emHistory,
} from "@/lib/em.functions";
import {
  CLASSES,
  CLASS_NAMES,
  REPORT_NAMES,
  STATUS_NAMES,
  filterStudents,
  attendanceStats,
  type Student,
  type Attendance,
} from "@/lib/em";
import { Choice, ReportEditor, type Report } from "./ReportEditor";
export const EM_VIEWS = [
  { key: "dashboard", label: "Tableau de bord EM", path: "/ecole-ministere" },
  { key: "etudiants", label: "Étudiants", path: "/ecole-ministere/etudiants" },
  { key: "classes", label: "Classes", path: "/ecole-ministere/classes" },
  { key: "mentors", label: "Mentors", path: "/ecole-ministere/mentors" },
  { key: "priere", label: "Vie de prière collective", path: "/ecole-ministere/priere" },
  { key: "cellule", label: "Implantation des cellules", path: "/ecole-ministere/cellules" },
  { key: "garde", label: "Tours de garde", path: "/ecole-ministere/tours-garde" },
  { key: "rapports", label: "Rapports et évaluations", path: "/ecole-ministere/rapports" },
  { key: "annees", label: "Années académiques", path: "/ecole-ministere/annees" },
];
const options = (vals: readonly string[]) => vals.map((value) => ({ value, label: value }));
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="border border-destructive rounded-md p-4 space-y-2">
      <p>Données indisponibles</p>
      <p className="text-sm break-words">
        {error instanceof Error ? error.message : "Le chargement a échoué."}
      </p>
      <Button variant="outline" onClick={retry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Réessayer
      </Button>
    </div>
  );
}
export function SchoolPage({ view }: { view: string }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const contextFn = useServerFn(emContext),
    studentsFn = useServerFn(emStudents),
    reportsFn = useServerFn(emReports);
  const c = useQuery({
    queryKey: ["em", "context", auth.user?.id],
    queryFn: () => contextFn(),
    enabled: !!auth.user,
  });
  const [yearChoice, setYear] = useState("");
  const year =
    c.data?.years.find((y) => y.id === yearChoice) ??
    c.data?.years.find((y) => y.actif) ??
    c.data?.years[0];
  const s = useQuery({
    queryKey: ["em", "students", year?.id],
    enabled: !!c.data && !!year,
    queryFn: () => studentsFn({ data: { year: year?.id } }),
  });
  const r = useQuery({
    queryKey: ["em", "reports", year?.id],
    enabled: !!c.data && !!year,
    queryFn: () => reportsFn({ data: { year: year?.id } }),
  });
  const [country, setCountry] = useState("all"),
    [temple, setTemple] = useState("all"),
    [classe, setClasse] = useState("all"),
    [mentor, setMentor] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState("");
  const [enrollment, setEnrollment] = useState<Student | "new" | null>(null),
    [yearOpen, setYearOpen] = useState(false),
    [mentorOpen, setMentorOpen] = useState(false),
    [dossier, setDossier] = useState<Student | null>(null);
  const [reportOpen, setReportOpen] = useState<{
    report?: Report;
    type: string;
    student?: Student;
    classe: string;
  } | null>(null);
  const yearActionFn = useServerFn(emYearAction);
  const yearAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "activer" | "archiver" }) =>
      yearActionFn({ data: { id, action } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["em"] });
      toast.success("Année mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (c.isPending) return <p>Chargement de l’École du Ministère…</p>;
  if (c.isError || !c.data) return <Failure error={c.error} retry={() => void c.refetch()} />;
  const context = c.data;
  const rows = s.data ?? [];
  const assignedClasses = context.assignments
    .filter((a) => a.year_id === year?.id && a.actif && (mentor === "all" || a.user_id === mentor))
    .map((a) => a.classe);
  const filtered = filterStudents(rows, {
    year: year?.id,
    country: country === "all" ? undefined : country,
    temple: temple === "all" ? undefined : temple,
    classe: classe === "all" ? undefined : classe,
    query,
  }).filter((e) => mentor === "all" || assignedClasses.includes(e.classe));
  const countries = Array.from(
    new Map(rows.filter((s) => s.pays_id).map((s) => [s.pays_id as string, s.pays])).entries(),
  ).map(([value, label]) => ({ value, label }));
  const temples = Array.from(
    new Map(
      rows
        .filter((s) => country === "all" || s.pays_id === country)
        .map((s) => [s.temple_id, s.temple]),
    ).entries(),
  ).map(([value, label]) => ({ value, label }));
  const filteredIds = new Set(filtered.map((s) => s.id));
  const reports = (r.data ?? []).filter(
    (report) =>
      (view === "priere" || view === "cellule" || view === "garde" ? report.type === view : true) &&
      (classe === "all" || report.classe === classe) &&
      (status === "all" || report.statut === status) &&
      (mentor === "all" || report.auteur_id === mentor) &&
      ((country === "all" && temple === "all") ||
        (report.enrollment_id
          ? filteredIds.has(report.enrollment_id)
          : (
              (report.contenu as Record<string, unknown>).attendance as Attendance[] | undefined
            )?.some((a) => filteredIds.has(a.id)))) &&
      (!query ||
        `${REPORT_NAMES[report.type]} ${JSON.stringify(report.identification)} ${report.classe}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const classAllowed = context.principal
    ? CLASSES
    : CLASSES.filter(
        (k) =>
          context.assignments.some(
            (a) =>
              a.year_id === year?.id && a.user_id === context.userId && a.classe === k && a.actif,
          ) || rows.some((s) => s.classe === k),
      );
  const reportType = ["priere", "cellule", "garde"].includes(view) ? view : null;
  const canCreate =
    reportType === "garde"
      ? context.assignments.some(
          (a) => a.year_id === year?.id && a.user_id === context.userId && a.actif,
        )
      : context.local;
  const chart = (title: string, data: { name: string; total: number }[]) => (
    <section className="min-w-0 space-y-3 border-t pt-5">
      <h2 className="font-semibold">{title}</h2>
      {data.length ? (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill="var(--primary)" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune donnée enregistrée.</p>
      )}
    </section>
  );
  const group = (key: "pays" | "temple" | "admission") =>
    Array.from(
      filtered.reduce((m, s) => {
        const k = key === "admission" ? s.admission.slice(0, 7) : s[key];
        m.set(k, (m.get(k) ?? 0) + 1);
        return m;
      }, new Map<string, number>()),
    ).map(([name, total]) => ({ name, total }));
  return (
    <div className="space-y-6 min-w-0">
      <header className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">École du Ministère</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {EM_VIEWS.find((v) => v.key === view)?.label} ·{" "}
            {context.principal ? "MCA GLOBAL" : context.local ? "Temple local" : "MENTOR EM"}
          </p>
        </div>
        <Button variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["em"] })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </header>
      <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-3">
        {EM_VIEWS.map((v) => (
          <Link
            key={v.key}
            to={v.path}
            className={`text-sm py-1 border-b-2 ${view === v.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {c.data.years.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Choice
            label="Année académique"
            value={year?.id ?? ""}
            onChange={(v) => {
              setYear(v);
              setCountry("all");
              setTemple("all");
              setClasse("all");
            }}
            options={context.years.map((y) => ({
              value: y.id,
              label: y.nom + (y.actif ? " · Active" : y.archive ? " · Archivée" : ""),
            }))}
          />
          {view !== "annees" && view !== "mentors" && (
            <>
              <Choice
                label="Pays"
                value={country}
                onChange={(v) => {
                  setCountry(v);
                  setTemple("all");
                }}
                options={[{ value: "all", label: "Tous les pays" }, ...countries]}
              />
              <Choice
                label="Temple"
                value={temple}
                onChange={setTemple}
                options={[{ value: "all", label: "Tous les temples autorisés" }, ...temples]}
              />
              <Choice
                label="Classe"
                value={classe}
                onChange={setClasse}
                options={[
                  { value: "all", label: "Toutes les classes autorisées" },
                  ...options(classAllowed),
                ]}
              />
              {context.principal && (
                <Choice
                  label="Mentor"
                  value={mentor}
                  onChange={setMentor}
                  options={[
                    { value: "all", label: "Tous les mentors" },
                    ...context.users
                      .filter((u) => context.mentors.some((m) => m.user_id === u.id))
                      .map((u) => ({ value: u.id, label: u.nom ?? u.email ?? u.id })),
                  ]}
                />
              )}
              <Choice
                label="Statut du rapport"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Tous les statuts" },
                  ...Object.entries(STATUS_NAMES).map(([value, label]) => ({ value, label })),
                ]}
              />
            </>
          )}
        </div>
      )}
      {!year && view !== "annees" && (
        <div className="border-y py-8 space-y-3">
          <p>Aucune année académique enregistrée.</p>
          {context.principal && (
            <Button onClick={() => setYearOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une année académique
            </Button>
          )}
        </div>
      )}
      {view === "dashboard" && year && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Étudiants", s.isSuccess ? filtered.length : "—"],
              [
                "Étudiants actifs",
                s.isSuccess ? filtered.filter((e) => e.statut === "actif").length : "—",
              ],
              ["Classes", classAllowed.length],
              [
                "Mentors",
                new Set(
                  context.assignments
                    .filter((a) => a.year_id === year.id && a.actif)
                    .map((a) => a.user_id),
                ).size,
              ],
              ...Object.entries(REPORT_NAMES).map(([k, n]) => [
                `${n} · reçus`,
                r.isSuccess
                  ? reports.filter((x) => x.type === k && x.statut !== "brouillon").length
                  : "—",
              ]),
              [
                "En attente",
                r.isSuccess
                  ? reports.filter((x) => ["soumis", "examen"].includes(x.statut)).length
                  : "—",
              ],
              ["Validés", r.isSuccess ? reports.filter((x) => x.statut === "valide").length : "—"],
              [
                "Compléments",
                r.isSuccess ? reports.filter((x) => x.statut === "complement").length : "—",
              ],
            ].map(([label, n]) => (
              <Card key={label} className="p-4 rounded-md">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold mt-2">{n}</p>
              </Card>
            ))}
          </section>
          {s.isError ? (
            <Failure error={s.error} retry={() => void s.refetch()} />
          ) : s.isPending ? (
            <p>Chargement des étudiants…</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {chart(
                "Étudiants par classe",
                classAllowed.map((name) => ({
                  name,
                  total: filtered.filter((e) => e.classe === name).length,
                })),
              )}
              {chart("Étudiants par pays", group("pays"))}
              {chart("Étudiants par temple", group("temple"))}
              {chart("Évolution des admissions", group("admission"))}
            </div>
          )}
          {r.isError ? (
            <Failure error={r.error} retry={() => void r.refetch()} />
          ) : (
            r.isSuccess && (
              <div className="grid gap-6 lg:grid-cols-2">
                {chart(
                  "Participation aux tours de garde",
                  reports
                    .filter((x) => x.type === "garde" && x.statut !== "brouillon")
                    .map((x) => ({
                      name: String((x.contenu as Record<string, unknown>).date ?? ""),
                      total:
                        attendanceStats(
                          ((x.contenu as Record<string, unknown>).attendance ?? []) as Attendance[],
                        ).taux ?? 0,
                    })),
                )}
                {chart(
                  "Rapports soumis et validés",
                  Object.entries(STATUS_NAMES)
                    .filter(([k]) => k !== "brouillon")
                    .map(([k, name]) => ({
                      name,
                      total: reports.filter((x) => x.statut === k).length,
                    })),
                )}
              </div>
            )
          )}
        </>
      )}
      {view === "etudiants" && year && (
        <>
          <div className="flex flex-wrap gap-3 justify-between">
            <Input
              aria-label="Rechercher un étudiant"
              placeholder="Nom, prénom ou matricule"
              className="sm:max-w-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {context.principal && !year.archive && (
              <Button onClick={() => setEnrollment("new")}>
                <Plus className="h-4 w-4 mr-2" />
                Admettre un étudiant
              </Button>
            )}
          </div>
          {s.isError ? (
            <Failure error={s.error} retry={() => void s.refetch()} />
          ) : s.isPending ? (
            <p>Chargement…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Étudiant / Matricule",
                      "Pays / Temple",
                      "Classe",
                      "Admission",
                      "Statut",
                      "Dossier",
                    ].map((t) => (
                      <th key={t} className="text-left border-b p-3">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="p-3 min-w-44">
                        <p className="font-medium">
                          {e.nom} {e.prenoms}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.matricule}</p>
                      </td>
                      <td className="p-3 min-w-44">
                        {e.pays}
                        <p className="text-xs text-muted-foreground">{e.temple}</p>
                      </td>
                      <td className="p-3">{e.classe}</td>
                      <td className="p-3">{e.admission}</td>
                      <td className="p-3">
                        <Badge variant="outline">{e.statut}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Dossier ${e.nom}`}
                            onClick={() => setDossier(e)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {context.principal && !year.archive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Modifier ${e.nom}`}
                              onClick={() => setEnrollment(e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <p className="py-8 text-muted-foreground text-sm">
                  Aucun étudiant inscrit dans ce périmètre.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {view === "classes" && year && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classAllowed.map((k) => (
            <Card key={k} className="p-5 space-y-3 rounded-md">
              <h2 className="text-xl font-semibold">{k}</h2>
              <p className="text-sm text-muted-foreground">{CLASS_NAMES[k]}</p>
              <p>
                {s.isSuccess ? filtered.filter((e) => e.classe === k).length : "—"} étudiants ·{" "}
                {year.nom}
              </p>
              <p className="text-sm">
                {context.assignments
                  .filter((a) => a.year_id === year.id && a.classe === k && a.actif)
                  .map(
                    (a) =>
                      context.users.find((u) => u.id === a.user_id)?.nom ??
                      (a.user_id === context.userId ? auth.profile?.nom : "Mentor affecté"),
                  )
                  .join(", ") || "Mentor non affecté"}
              </p>
            </Card>
          ))}
        </div>
      )}
      {view === "mentors" && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">MENTOR EM · Affectations par classe</h2>
            {context.principal && year && !year.archive && (
              <Button onClick={() => setMentorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Affecter un mentor
              </Button>
            )}
          </div>
          {context.assignments
            .filter((a) => a.year_id === year?.id)
            .map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
              >
                <div>
                  <p>
                    {context.users.find((u) => u.id === a.user_id)?.nom ??
                      auth.profile?.nom ??
                      "Mentor"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.classe} · {year?.nom} · {a.actif ? "Actif" : "Suspendu"}
                  </p>
                </div>
                {context.principal && <AssignmentToggle assignment={a} />}
              </div>
            ))}
          {!context.assignments.some((a) => a.year_id === year?.id) && (
            <p className="text-muted-foreground text-sm">Aucune affectation pour cette année.</p>
          )}
        </section>
      )}
      {view === "annees" && (
        <section className="space-y-4">
          {context.principal && (
            <Button onClick={() => setYearOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle année académique
            </Button>
          )}
          {context.years.map((y) => (
            <div key={y.id} className="flex flex-wrap justify-between gap-3 border-b py-4">
              <div>
                <h2 className="font-semibold">
                  {y.nom} {y.actif && <Badge>Active</Badge>}{" "}
                  {y.archive && <Badge variant="outline">Archivée</Badge>}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {y.debut} — {y.fin}
                </p>
              </div>
              {context.principal && !y.archive && (
                <div className="flex flex-wrap gap-2">
                  {!y.actif && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm("Définir cette année comme active ?"))
                          yearAction.mutate({ id: y.id, action: "activer" });
                      }}
                    >
                      Activer
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (
                        confirm("Archiver cette année en conservant ses inscriptions et rapports ?")
                      )
                        yearAction.mutate({ id: y.id, action: "archiver" });
                    }}
                  >
                    Archiver
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      {(reportType || view === "rapports") && year && (
        <section className="space-y-4">
          <Input
            aria-label="Rechercher un rapport"
            placeholder="Rechercher un rapport, une classe ou un étudiant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {reportType && canCreate && !year.archive && (
            <div className="flex flex-wrap gap-3 items-end">
              {reportType === "garde" ? (
                <Choice
                  label="Classe du tour de garde"
                  value={classe === "all" ? "" : classe}
                  onChange={setClasse}
                  options={options(
                    CLASSES.filter((k) =>
                      context.assignments.some(
                        (a) =>
                          a.year_id === year.id &&
                          a.user_id === context.userId &&
                          a.classe === k &&
                          a.actif,
                      ),
                    ),
                  )}
                />
              ) : (
                <Choice
                  label="Étudiant du temple"
                  value={dossier?.id ?? ""}
                  onChange={(v) => setDossier(rows.find((e) => e.id === v) ?? null)}
                  options={filtered.map((e) => ({
                    value: e.id,
                    label: `${e.nom} ${e.prenoms} · ${e.classe}`,
                  }))}
                />
              )}
              <Button
                disabled={
                  s.isError || s.isPending || (reportType === "garde" ? classe === "all" : !dossier)
                }
                onClick={() =>
                  setReportOpen({
                    type: reportType,
                    student: reportType === "garde" ? undefined : (dossier ?? undefined),
                    classe: reportType === "garde" ? classe : (dossier?.classe ?? ""),
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau rapport
              </Button>
            </div>
          )}
          {r.isError ? (
            <Failure error={r.error} retry={() => void r.refetch()} />
          ) : r.isPending ? (
            <p>Chargement des rapports…</p>
          ) : (
            <div className="space-y-2">
              {reports.map((x) => (
                <div
                  key={x.id}
                  className="border-b py-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{REPORT_NAMES[x.type]}</p>
                    <p className="text-sm text-muted-foreground">
                      {x.classe} ·{" "}
                      {String(
                        (x.identification as Record<string, unknown>).nom ??
                          (x.identification as Record<string, unknown>).mentor ??
                          "",
                      )}{" "}
                      {String((x.identification as Record<string, unknown>).prenoms ?? "")} ·{" "}
                      {String((x.identification as Record<string, unknown>).temple ?? "")} ·{" "}
                      {x.submitted_at
                        ? new Date(x.submitted_at).toLocaleDateString("fr")
                        : "Brouillon"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Auteur : {context.users.find((u) => u.id === x.auteur_id)?.nom ?? x.auteur_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{STATUS_NAMES[x.statut]}</Badge>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setReportOpen({
                          report: x,
                          type: x.type,
                          classe: x.classe,
                          student: rows.find((s) => s.id === x.enrollment_id),
                        })
                      }
                    >
                      Ouvrir
                    </Button>
                  </div>
                </div>
              ))}
              {!reports.length && (
                <p className="text-sm py-6 text-muted-foreground">
                  Aucun rapport pour cette sélection.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {enrollment && year && (
        <EnrollmentDialog
          row={enrollment === "new" ? undefined : enrollment}
          year={year}
          years={context.years}
          onClose={() => setEnrollment(null)}
        />
      )}
      {yearOpen && <YearDialog onClose={() => setYearOpen(false)} />}
      {mentorOpen && year && (
        <MentorDialog users={context.users} year={year.id} onClose={() => setMentorOpen(false)} />
      )}
      {reportOpen && year && (
        <ReportEditor
          {...reportOpen}
          year={year}
          students={rows}
          principal={context.principal}
          userId={context.userId}
          onClose={() => setReportOpen(null)}
        />
      )}
      {dossier && view === "etudiants" && (
        <Dossier
          student={dossier}
          reports={(r.data ?? []).filter((x) => x.enrollment_id === dossier.id)}
          onClose={() => setDossier(null)}
          onReport={(x) => {
            setReportOpen({ report: x, type: x.type, classe: x.classe, student: dossier });
            setDossier(null);
          }}
        />
      )}
    </div>
  );
}
function YearDialog({ onClose }: { onClose: () => void }) {
  const [nom, setNom] = useState(""),
    [debut, setDebut] = useState(""),
    [fin, setFin] = useState("");
  const fn = useServerFn(emSaveYear),
    qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fn({ data: { nom, debut, fin } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["em"] });
      toast.success("Année créée");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle année académique</DialogTitle>
        </DialogHeader>
        <Label htmlFor="year-name">Année académique</Label>
        <Input
          id="year-name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="2026-2027"
        />
        <Label htmlFor="year-start">Date de début</Label>
        <Input
          id="year-start"
          type="date"
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
        />
        <Label htmlFor="year-end">Date de fin</Label>
        <Input id="year-end" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        <Button disabled={m.isPending} onClick={() => m.mutate()}>
          Créer l’année
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function EnrollmentDialog({
  row,
  year,
  years,
  onClose,
}: {
  row?: Student;
  year: { id: string; nom: string };
  years: { id: string; nom: string; archive: boolean }[];
  onClose: () => void;
}) {
  const [country, setCountry] = useState(row?.pays_id ?? ""),
    [temple, setTemple] = useState(row?.temple_id ?? ""),
    [q, setQ] = useState(""),
    [member, setMember] = useState(row?.membre_id ?? ""),
    [classe, setClasse] = useState(row?.classe ?? "CPEM"),
    [yearId, setYear] = useState(row?.year_id ?? year.id),
    [admission, setAdmission] = useState(row?.admission ?? new Date().toISOString().slice(0, 10)),
    [status, setStatus] = useState(row?.statut ?? "actif"),
    [notes, setNotes] = useState(row?.notes ?? "");
  const candidatesFn = useServerFn(emCandidates),
    save = useServerFn(emSaveEnrollment),
    qc = useQueryClient();
  const temples = useQuery({
    queryKey: ["em", "temples"],
    queryFn: async () => {
      const r = await supabase.from("temples").select("id,nom_temple,pays_id");
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const countries = useQuery({
    queryKey: ["em", "countries"],
    queryFn: async () => {
      const r = await supabase.from("pays").select("id,nom").order("nom");
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const candidates = useQuery({
    queryKey: ["em", "candidates", temple, q],
    enabled: !!temple && !row,
    queryFn: () => candidatesFn({ data: { temple, q } }),
  });
  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: row?.id,
          membre_id: member,
          year_id: yearId,
          classe: classe as "CPEM",
          admission,
          statut: status as "actif",
          notes,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["em"] });
      toast.success("Inscription enregistrée et historisée");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row ? "Modifier / transférer une inscription" : "Admission à l’École du Ministère"}
          </DialogTitle>
        </DialogHeader>
        {row ? (
          <p>
            {row.nom} {row.prenoms} · {row.matricule}
          </p>
        ) : (
          <>
            {countries.isError ? (
              <Failure error={countries.error} retry={() => void countries.refetch()} />
            ) : (
              <Choice
                label="Pays d’origine"
                value={country}
                onChange={(v) => {
                  setCountry(v);
                  setTemple("");
                  setMember("");
                }}
                options={(countries.data ?? []).map((c) => ({ value: c.id, label: c.nom }))}
              />
            )}{" "}
            {temples.isError ? (
              <Failure error={temples.error} retry={() => void temples.refetch()} />
            ) : (
              <Choice
                label="Temple d’origine"
                value={temple}
                onChange={(v) => {
                  setTemple(v);
                  setMember("");
                }}
                options={(temples.data ?? [])
                  .filter((t) => t.pays_id === country)
                  .map((t) => ({ value: t.id, label: t.nom_temple }))}
              />
            )}
            <Label htmlFor="candidate-search">Rechercher par matricule, nom ou prénom</Label>
            <Input id="candidate-search" value={q} onChange={(e) => setQ(e.target.value)} />
            {candidates.isError ? (
              <Failure error={candidates.error} retry={() => void candidates.refetch()} />
            ) : (
              <Choice
                label="Membre existant"
                value={member}
                onChange={setMember}
                options={(candidates.data ?? []).map((m) => ({
                  value: m.id,
                  label: `${m.nom} ${m.prenoms} · ${m.matricule ?? ""}`,
                }))}
              />
            )}
            <Button asChild variant="outline">
              <Link to="/membres">Créer d’abord une fiche membre</Link>
            </Button>
          </>
        )}
        <Choice
          label="Année académique"
          value={yearId}
          onChange={setYear}
          options={years.filter((y) => !y.archive).map((y) => ({ value: y.id, label: y.nom }))}
        />
        <Choice
          label="Classe obligatoire"
          value={classe}
          onChange={setClasse}
          options={CLASSES.map((k) => ({ value: k, label: `${k} · ${CLASS_NAMES[k]}` }))}
        />
        <Label htmlFor="admission">Date d’admission</Label>
        <Input
          id="admission"
          type="date"
          value={admission}
          onChange={(e) => setAdmission(e.target.value)}
        />
        <Choice
          label="Statut de l’étudiant"
          value={status}
          onChange={setStatus}
          options={options(["actif", "suspendu", "transfere", "diplome", "abandonne"])}
        />
        <Label htmlFor="enrollment-notes">Notes</Label>
        <Textarea id="enrollment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button
          disabled={!member || m.isPending}
          onClick={() => {
            if (
              row &&
              (row.classe !== classe || row.year_id !== yearId) &&
              !confirm("Confirmer le transfert ? L’historique sera conservé.")
            )
              return;
            m.mutate();
          }}
        >
          Enregistrer l’inscription
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function MentorDialog({
  users,
  year,
  onClose,
}: {
  users: { id: string; nom: string | null; email: string | null }[];
  year: string;
  onClose: () => void;
}) {
  const [user, setUser] = useState(""),
    [classe, setClasse] = useState("CPEM");
  const fn = useServerFn(emAssignMentor),
    qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { user_id: user, year_id: year, classe: classe as "CPEM", actif: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["em"] });
      toast.success("MENTOR EM affecté");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Affecter un MENTOR EM</DialogTitle>
        </DialogHeader>
        <Choice
          label="Utilisateur existant"
          value={user}
          onChange={setUser}
          options={users.map((u) => ({ value: u.id, label: u.nom ?? u.email ?? u.id }))}
        />
        <Choice
          label="Classe attribuée"
          value={classe}
          onChange={setClasse}
          options={options([...CLASSES])}
        />
        <Button disabled={!user || m.isPending} onClick={() => m.mutate()}>
          Affecter le mentor
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function AssignmentToggle({
  assignment,
}: {
  assignment: { user_id: string; year_id: string; classe: string; actif: boolean };
}) {
  const fn = useServerFn(emAssignMentor),
    qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: { ...assignment, classe: assignment.classe as "CPEM", actif: !assignment.actif },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["em"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      variant="outline"
      disabled={m.isPending}
      onClick={() => {
        if (confirm("Confirmer le changement d’affectation ?")) m.mutate();
      }}
    >
      {assignment.actif ? "Suspendre l’affectation" : "Réactiver"}
    </Button>
  );
}
function Dossier({
  student,
  reports,
  onClose,
  onReport,
}: {
  student: Student;
  reports: Report[];
  onClose: () => void;
  onReport: (r: Report) => void;
}) {
  const fn = useServerFn(emHistory);
  const h = useQuery({
    queryKey: ["em", "history", student.id],
    queryFn: () => fn({ data: { id: student.id } }),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Dossier de {student.nom} {student.prenoms}
          </DialogTitle>
        </DialogHeader>
        <p>
          {student.matricule} · {student.telephone ?? "—"}
        </p>
        <p>
          {student.temple} · {student.pays}
        </p>
        <p>
          {student.classe} · {student.statut} · Admission : {student.admission}
        </p>
        <p>{student.notes}</p>
        <h3 className="font-semibold">Rapports de mentorat</h3>
        {reports.map((r) => (
          <Button
            key={r.id}
            variant="outline"
            className="justify-start h-auto whitespace-normal"
            onClick={() => onReport(r)}
          >
            {REPORT_NAMES[r.type]} · {STATUS_NAMES[r.statut]}
          </Button>
        ))}
        <h3 className="font-semibold">Historique de l’inscription</h3>
        {h.isError ? (
          <Failure error={h.error} retry={() => void h.refetch()} />
        ) : (
          h.data?.map((e) => (
            <div key={e.id} className="border-t py-2 text-sm">
              <p>
                {new Date(e.created_at).toLocaleString("fr")} · {e.action}
              </p>
              <pre className="text-xs whitespace-pre-wrap break-all">
                {JSON.stringify({ avant: e.avant, apres: e.apres }, null, 2)}
              </pre>
            </div>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
