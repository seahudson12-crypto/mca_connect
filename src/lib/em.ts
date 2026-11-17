export const CLASSES = ["CPEM", "P1", "P2", "P3", "P4", "P5"] as const;
export const CELL_CLASSES = ["P3", "P4", "P5"] as const;
export const CLASS_NAMES: Record<string, string> = {
  CPEM: "Classe Préparatoire pour l’École du Ministère",
  P1: "Pastorale 1",
  P2: "Pastorale 2",
  P3: "Pastorale 3",
  P4: "Pastorale 4",
  P5: "Pastorale 5",
};
export const REPORT_NAMES: Record<string, string> = {
  priere: "Participation à la vie de prière collective",
  cellule: "Implantation et développement d’une cellule de prière",
  garde: "Suivi de la participation à la tour de garde hebdomadaire",
};
export const REPORT_CREATE_NAMES: Record<string, string> = {
  priere: "+ Créer un rapport de participation à la vie de prière collective",
  cellule: "+ Créer un rapport d'implantation et de développement d'une cellule de prière",
  garde: "+ Créer un rapport de tour de garde hebdomadaire",
};
export const STATUS_NAMES: Record<string, string> = {
  brouillon: "Brouillon",
  soumis: "Soumis",
  examen: "En cours d’examen",
  complement: "Complément d’information demandé",
  reserve: "Validé sous réserve",
  valide: "Validé",
  rejete: "Non validé",
};
export interface Student {
  id: string;
  membre_id: string;
  nom: string;
  prenoms: string;
  telephone: string | null;
  matricule: string | null;
  year_id: string;
  classe: string;
  admission: string;
  statut: string;
  notes: string;
  temple_id: string;
  temple: string;
  pays_id: string | null;
  pays: string;
  ville: string | null;
  pasteur: string | null;
  contact: string | null;
  mentor: string | null;
}
export interface Attendance {
  id: string;
  nom: string;
  presence: "P" | "A" | "J";
  ponctuel: boolean;
  participation: "active" | "moyenne" | "faible";
  temple_id?: string;
  temple?: string;
  pays_id?: string;
  pays?: string;
}
export interface ReportSnapshot {
  type: string;
  temple_id: string | null;
  enrollment_id: string | null;
  identification: unknown;
  contenu: unknown;
}
export interface ReportLocation {
  studentId: string | null;
  name: string;
  templeId: string | null;
  temple: string;
  countryId: string | null;
  country: string;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function canCreateReportForClass(type: string, classe: string) {
  return type !== "cellule" || (CELL_CLASSES as readonly string[]).includes(classe);
}
export function reportLocations(
  report: ReportSnapshot,
  students: Student[] = [],
): ReportLocation[] {
  const identification = object(report.identification);
  if (report.type === "garde") {
    const attendance = object(report.contenu).attendance;
    if (!Array.isArray(attendance)) return [];
    return attendance.map((value) => {
      const row = object(value);
      const student = students.find((s) => s.id === row.id);
      return {
        studentId: text(row.id) || student?.id || null,
        name: text(row.nom) || (student ? `${student.nom} ${student.prenoms}` : ""),
        templeId: text(row.temple_id) || student?.temple_id || null,
        temple: text(row.temple) || student?.temple || "",
        countryId: text(row.pays_id) || student?.pays_id || null,
        country: text(row.pays) || student?.pays || "",
      };
    });
  }
  const student = students.find((s) => s.id === report.enrollment_id);
  return [
    {
      studentId: report.enrollment_id,
      name:
        `${text(identification.nom)} ${text(identification.prenoms)}`.trim() ||
        (student ? `${student.nom} ${student.prenoms}` : ""),
      templeId: text(identification.temple_id) || report.temple_id || student?.temple_id || null,
      temple: text(identification.temple) || student?.temple || "",
      countryId: text(identification.pays_id) || student?.pays_id || null,
      country: text(identification.pays) || student?.pays || "",
    },
  ];
}
export function reportMatchesLocation(
  report: ReportSnapshot,
  students: Student[],
  filters: { country?: string; temple?: string; student?: string },
) {
  if (!filters.country && !filters.temple && !filters.student) return true;
  const locations = reportLocations(report, students);
  return locations.some(
    (location) =>
      (!filters.country || location.countryId === filters.country) &&
      (!filters.temple || location.templeId === filters.temple) &&
      (!filters.student || location.studentId === filters.student),
  );
}
export function reportPeriod(report: Pick<ReportSnapshot, "type" | "contenu">) {
  const content = object(report.contenu);
  return (
    text(content.periode) ||
    text(content.date) ||
    text(content.date_debut) ||
    text(content.dernier_suivi) ||
    "Non renseignée"
  );
}
export function attendanceStats(rows: Attendance[]) {
  const presents = rows.filter((r) => r.presence === "P");
  return {
    presents: presents.length,
    absents: rows.filter((r) => r.presence === "A").length,
    justifies: rows.filter((r) => r.presence === "J").length,
    retards: presents.filter((r) => !r.ponctuel).length,
    taux: rows.length ? Math.round((presents.length / rows.length) * 100) : null,
    active: presents.filter((r) => r.participation === "active").length,
    moyenne: presents.filter((r) => r.participation === "moyenne").length,
    faible: presents.filter((r) => r.participation === "faible").length,
  };
}
export function filterStudents(
  rows: Student[],
  filters: { year?: string; country?: string; temple?: string; classe?: string; query?: string },
) {
  return rows.filter(
    (s) =>
      (!filters.year || s.year_id === filters.year) &&
      (!filters.country || s.pays_id === filters.country) &&
      (!filters.temple || s.temple_id === filters.temple) &&
      (!filters.classe || s.classe === filters.classe) &&
      (!filters.query ||
        `${s.nom} ${s.prenoms} ${s.matricule}`
          .toLocaleLowerCase()
          .includes(filters.query.toLocaleLowerCase())),
  );
}
export function canEditReport(principal: boolean, author: boolean, status: string, _type: string) {
  return !principal && author && (status === "brouillon" || status === "complement");
}
