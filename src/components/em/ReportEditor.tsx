import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { emSaveReport, emReview, emHistory } from "@/lib/em.functions";
import {
  REPORT_NAMES,
  STATUS_NAMES,
  attendanceStats,
  canEditReport,
  type Student,
  type Attendance,
} from "@/lib/em";
import {
  PRAYER_FIELDS,
  CELL_FIELDS,
  GUARD_FIELDS,
  OBJECTS,
  attestation,
  type Field,
} from "@/lib/em-report-fields";
import type { Tables } from "@/integrations/supabase/types";
export type Report = Tables<"em_reports">;
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label} aria-required={required} className="w-full">
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function ReportEditor({
  report,
  type,
  year,
  classe,
  students,
  student,
  principal,
  userId,
  authorName,
  onClose,
}: {
  report?: Report;
  type: string;
  year: { id: string; nom: string };
  classe: string;
  students: Student[];
  student?: Student;
  principal: boolean;
  userId: string;
  authorName: string;
  onClose: () => void;
}) {
  const initial = (report?.contenu ?? {}) as Record<string, unknown>;
  const [values, setValues] = useState<Record<string, unknown>>({
    ...initial,
    attestant:
      initial.attestant ?? (type === "garde" ? authorName : student?.pasteur || authorName),
    mentor_suivi:
      initial.mentor_suivi ??
      (type === "garde" ? authorName : student?.mentor || student?.pasteur || authorName),
    fonction: initial.fonction ?? (type === "garde" ? "Mentor EM" : "Pasteur Principal"),
    date_attestation: initial.date_attestation ?? new Date().toISOString().slice(0, 10),
  });
  const [attendance, setAttendance] = useState<Attendance[]>(
    (initial.attendance as Attendance[] | undefined) ??
      students
        .filter((s) => s.classe === classe && s.statut === "actif")
        .map((s) => ({
          id: s.id,
          nom: `${s.nom} ${s.prenoms}`,
          presence: "P",
          ponctuel: true,
          participation: "active",
        })),
  );
  const [observations, setObservations] = useState(report?.observations ?? "");
  const [decision, setDecision] = useState("examen");
  const qc = useQueryClient();
  const save = useServerFn(emSaveReport);
  const review = useServerFn(emReview);
  const history = useServerFn(emHistory);
  const editable = !report
    ? !principal
    : canEditReport(principal, report.auteur_id === userId, report.statut, type);
  const mutation = useMutation({
    mutationFn: async (status: "brouillon" | "soumis") =>
      save({
        data: {
          id: report?.id,
          year_id: year.id,
          enrollment_id: type === "garde" ? null : (student?.id ?? report?.enrollment_id ?? null),
          temple_id: type === "garde" ? null : (student?.temple_id ?? report?.temple_id ?? null),
          classe: classe as "CPEM",
          type: type as "priere",
          statut: status,
          contenu: {
            ...values,
            ...(type === "garde" ? { attendance } : {}),
            objet_officiel: OBJECTS[type],
            attestation_officielle: attestation(
              type,
              String(values.attestant ?? ""),
              student?.temple ??
                String((report?.identification as Record<string, unknown>)?.temple ?? ""),
              student
                ? `${student.nom} ${student.prenoms}`
                : `${(report?.identification as Record<string, unknown>)?.nom ?? ""} ${(report?.identification as Record<string, unknown>)?.prenoms ?? ""}`,
              classe,
            ),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Rapport enregistré");
      void qc.invalidateQueries({ queryKey: ["em"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const validation = useMutation({
    mutationFn: () => {
      if (!report) throw new Error("Rapport introuvable");
      return review({ data: { id: report.id, statut: decision as "examen", observations } });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée et historisée");
      void qc.invalidateQueries({ queryKey: ["em"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const h = useQuery({
    queryKey: ["em", "history", report?.id],
    enabled: !!report,
    queryFn: () => history({ data: { id: report?.id ?? "" } }),
  });
  const fields =
    type === "priere" ? PRAYER_FIELDS : type === "cellule" ? CELL_FIELDS : GUARD_FIELDS;
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  const field = (f: Field) => {
    const val = values[f.key];
    const required =
      ["attestant", "fonction", "date_attestation"].includes(f.key) ||
      (type === "garde" && (f.key === "date" || /^evaluation_[0-5]$/.test(f.key)));
    return (
      <div
        key={f.key}
        className={
          f.type === "long" || f.type === "checks" ? "sm:col-span-2 space-y-2" : "space-y-2"
        }
      >
        {f.type === "select" ? (
          <Choice
            label={f.label}
            value={String(val ?? "")}
            onChange={(v) => set(f.key, v)}
            options={(f.options ?? []).map((v) => ({ value: v, label: v }))}
            disabled={!editable}
            required={required}
          />
        ) : (
          <>
            <Label htmlFor={f.key}>
              {f.label}
              {required && <span className="text-destructive"> *</span>}
            </Label>
            {f.type === "checks" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {f.options?.map((o) => (
                  <label key={o} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={Array.isArray(val) && val.includes(o)}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        set(
                          f.key,
                          checked
                            ? [...(Array.isArray(val) ? val : []), o]
                            : (Array.isArray(val) ? val : []).filter((v) => v !== o),
                        )
                      }
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : f.type === "long" ? (
              <Textarea
                id={f.key}
                value={String(val ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
                disabled={!editable}
                required={required}
              />
            ) : (
              <Input
                id={f.key}
                type={f.type ?? "text"}
                min={f.type === "number" ? 0 : undefined}
                value={String(val ?? "")}
                onChange={(e) =>
                  set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)
                }
                disabled={!editable}
                required={required}
              />
            )}
          </>
        )}
      </div>
    );
  };
  const ident = (report?.identification ?? student ?? {}) as Record<string, unknown>;
  const stats = attendanceStats(attendance);
  const print = () => {
    const content = document.getElementById("em-print-report");
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Autorisez l’ouverture de la fenêtre d’impression.");
      return;
    }
    w.opener = null;
    w.document.write(
      "<html><head><title>Rapport de mentorat MCA — EM</title><style>body{font:12px serif;margin:25mm}h1,h2{text-align:center}section{break-inside:avoid;border-top:1px solid;padding:12px 0}input,textarea{border:0;width:100%;color:inherit}button{display:none}table{border-collapse:collapse;width:100%}th,td{border:1px solid;padding:6px}[role=checkbox]{display:inline-block}p{line-height:1.5}</style></head><body></body></html>",
    );
    const copy = content.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("input,textarea").forEach((el) => {
      const src = Array.from(content.querySelectorAll("input,textarea")).find(
        (input) => input.id === el.id,
      ) as HTMLInputElement | undefined;
      if (src) {
        const p = w.document.createElement("p");
        p.textContent = src.value;
        el.replaceWith(p);
      }
    });
    copy.querySelectorAll('[role="combobox"]').forEach((el) => {
      const p = w.document.createElement("p");
      p.textContent = el.textContent;
      el.replaceWith(p);
    });
    copy.querySelectorAll('[role="checkbox"]').forEach((el) => {
      el.textContent = el.getAttribute("data-state") === "checked" ? "☑" : "☐";
    });
    w.document.body.append(copy);
    w.document.close();
    w.focus();
    w.print();
  };
  const submit = () => {
    if (
      !String(values.attestant ?? "").trim() ||
      !String(values.fonction ?? "").trim() ||
      !values.date_attestation ||
      values.attestation !== true
    ) {
      toast.error("Complétez l’attestation et confirmez électroniquement le rapport.");
      return;
    }
    if (
      type === "garde" &&
      (!values.date ||
        !values.responsable_id ||
        !attendance.length ||
        Array.from({ length: 6 }, (_, i) => values[`evaluation_${i}`]).some((value) => !value))
    ) {
      toast.error(
        "Renseignez la date, toutes les présences, le responsable et les six critères d’évaluation.",
      );
      return;
    }
    if (window.confirm("Soumettre ce rapport à l’administration EM ?")) mutation.mutate("soumis");
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Rapport de mentorat · {report ? STATUS_NAMES[report.statut] : "Nouveau rapport"}
          </DialogTitle>
        </DialogHeader>
        {editable && (
          <p className="text-xs text-muted-foreground">
            Les champs marqués * sont obligatoires pour la transmission.
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={print}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer / PDF
          </Button>
        </div>
        <article id="em-print-report" className="space-y-6">
          <header className="text-center border-b pb-5">
            <h2 className="font-bold">MISSION DE CHRIST EN ACTION (MCA)</h2>
            <p className="font-semibold">ÉCOLE DU MINISTÈRE (EM)</p>
            <p>RAPPORT DE MENTORAT</p>
            <h3 className="text-lg font-semibold mt-3">{REPORT_NAMES[type]}</h3>
            <p className="text-sm mt-2">
              Année académique : {year.nom} · Classe : {classe}
            </p>
            <p className="text-xs text-muted-foreground">
              Créé le {(report ? new Date(report.created_at) : new Date()).toLocaleDateString("fr")}
            </p>
          </header>
          <section>
            <h3 className="font-semibold mb-2">
              I. Identification{" "}
              {type === "garde" ? "de la classe et du mentor" : "de l’église locale"}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {Object.entries(ident)
                .filter(
                  ([key, v]) =>
                    [
                      "temple",
                      "pays",
                      "ville",
                      "pasteur",
                      "contact",
                      "mentor",
                      "telephone",
                      "matricule",
                      "nom",
                      "prenoms",
                      "admission",
                    ].includes(key) && v,
                )
                .map(([key, v]) => (
                  <p key={key}>
                    <span className="capitalize text-muted-foreground">
                      {key.replace("_", " ")} :{" "}
                    </span>
                    {String(v)}
                  </p>
                ))}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {field({
                key: "mentor_suivi",
                label: "Pasteur / Mentor chargé du suivi",
                type: "text",
              })}
              {type !== "garde" &&
                field({
                  key: "periode",
                  label: "Période concernée",
                  type: "text",
                })}
            </div>
          </section>
          <section className="border-t pt-4">
            <h3 className="font-semibold">III. Objet du rapport</h3>
            <p className="text-sm leading-relaxed mt-2">
              {String(initial.objet_officiel ?? OBJECTS[type])}
            </p>
          </section>
          {type === "garde" && (
            <section className="border-t pt-4 space-y-3">
              <h3 className="font-semibold">III. Suivi individuel des étudiants</h3>
              {editable && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setAttendance((v) => v.map((r) => ({ ...r, presence: "P", ponctuel: true })))
                  }
                >
                  Tous présents et ponctuels
                </Button>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["N°", "Étudiant", "Présence", "Ponctualité", "Participation"].map((t) => (
                        <th key={t} className="text-left p-2 border-b">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((r, i) => (
                      <tr key={r.id}>
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 min-w-36">{r.nom}</td>
                        <td className="p-2 min-w-28">
                          <Choice
                            label={`Présence ${r.nom}`}
                            value={r.presence}
                            disabled={!editable}
                            options={["P", "A", "J"].map((v) => ({ value: v, label: v }))}
                            onChange={(v) =>
                              setAttendance((a) =>
                                a.map((x) => (x.id === r.id ? { ...x, presence: v as "P" } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Checkbox
                            aria-label={`Ponctualité ${r.nom}`}
                            checked={r.ponctuel}
                            disabled={!editable}
                            onCheckedChange={(v) =>
                              setAttendance((a) =>
                                a.map((x) => (x.id === r.id ? { ...x, ponctuel: v === true } : x)),
                              )
                            }
                          />
                        </td>
                        <td className="p-2 min-w-36">
                          <Choice
                            label={`Participation ${r.nom}`}
                            value={r.participation}
                            disabled={!editable}
                            options={["active", "moyenne", "faible"].map((v) => ({
                              value: v,
                              label: v,
                            }))}
                            onChange={(v) =>
                              setAttendance((a) =>
                                a.map((x) =>
                                  x.id === r.id ? { ...x, participation: v as "active" } : x,
                                ),
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm">
                {stats.presents} présents · {stats.absents} absents · {stats.justifies} justifiés ·{" "}
                {stats.retards} retards · Présence : {stats.taux === null ? "—" : `${stats.taux}%`}{" "}
                · Participations : {stats.active} actives, {stats.moyenne} moyennes, {stats.faible}{" "}
                faibles
              </p>
              <Choice
                label="Étudiant responsable de la prière"
                value={String(values.responsable_id ?? "")}
                onChange={(v) => set("responsable_id", v)}
                options={attendance.map((r) => ({ value: r.id, label: r.nom }))}
                disabled={!editable}
                required
              />
              {field({
                key: "conducteurs",
                label: "Étudiants ayant conduit des séquences",
                type: "checks",
                options: attendance.map((r) => r.nom),
              })}
            </section>
          )}
          {fields.map((section) => (
            <section key={section.title} className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">{section.title}</h3>
              <div className="grid gap-4 sm:grid-cols-2">{section.fields.map(field)}</div>
              {type === "garde" && section === fields[0] && values.date ? (
                <p className="text-sm">
                  Jour :{" "}
                  {new Date(`${values.date}T12:00:00`).toLocaleDateString("fr", {
                    weekday: "long",
                  })}
                </p>
              ) : null}
            </section>
          ))}
          <section className="border-t pt-4 space-y-3">
            <h3 className="font-semibold">
              {type === "garde"
                ? "VIII. Attestation du mentor"
                : type === "priere"
                  ? "X. Attestation du Pasteur Principal"
                  : "XII. Attestation du Pasteur Principal"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field({
                key: "attestant",
                label: "Nom et prénoms de la personne qui atteste",
                type: "text",
              })}
              {field({ key: "fonction", label: "Fonction", type: "text" })}
              {field({ key: "date_attestation", label: "Date de l’attestation", type: "date" })}
            </div>
            <p className="text-sm leading-relaxed">
              {String(
                initial.attestation_officielle ??
                  attestation(
                    type,
                    String(values.attestant ?? ""),
                    String(ident.temple ?? ""),
                    `${ident.nom ?? ""} ${ident.prenoms ?? ""}`,
                    classe,
                  ),
              )}
            </p>
            <label className="flex gap-2 text-sm">
              <Checkbox
                checked={values.attestation === true}
                disabled={!editable}
                required
                onCheckedChange={(v) => set("attestation", v === true)}
              />
              <span>
                Je confirme l’exactitude des informations et valide électroniquement ce rapport.
                <span className="text-destructive"> *</span>
              </span>
            </label>
          </section>
          {report && (
            <section className="border-t pt-4">
              <h3 className="font-semibold">Cadre réservé à l’administration EM</h3>
              <p>
                Réception :{" "}
                {report.submitted_at
                  ? new Date(report.submitted_at).toLocaleString("fr")
                  : "Non soumis"}
              </p>
              <p>Statut : {STATUS_NAMES[report.statut]}</p>
              <p>Observations : {report.observations || "—"}</p>
              <p>
                Validation :{" "}
                {report.reviewed_at ? new Date(report.reviewed_at).toLocaleString("fr") : "—"}
              </p>
              <p>Validateur : {report.reviewed_by ?? "—"}</p>
            </section>
          )}
        </article>
        {editable && (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("brouillon")}
            >
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le brouillon
            </Button>
            <Button disabled={mutation.isPending} onClick={submit}>
              <Send className="mr-2 h-4 w-4" />
              Soumettre
            </Button>
          </div>
        )}
        {principal && report && report.statut !== "brouillon" && (
          <section className="space-y-3 border-t pt-4">
            <Choice
              label="Décision administrative"
              value={decision}
              onChange={setDecision}
              options={["examen", "complement", "reserve", "valide", "rejete", "brouillon"].map(
                (v) => ({
                  value: v,
                  label: v === "brouillon" ? "Réouvrir le rapport" : STATUS_NAMES[v],
                }),
              )}
            />
            <Label>Observations / motif</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} />
            <Button
              disabled={validation.isPending}
              onClick={() => {
                if (window.confirm("Confirmer cette décision ?")) validation.mutate();
              }}
            >
              Enregistrer la décision
            </Button>
          </section>
        )}
        {report && (
          <details className="border-t pt-4">
            <summary>
              Historique et versions conservées {h.data ? `(${h.data.length})` : ""}
            </summary>
            {h.isError ? (
              <div className="space-y-2 py-3">
                <p>Historique indisponible</p>
                <Button variant="outline" onClick={() => void h.refetch()}>
                  Réessayer
                </Button>
              </div>
            ) : (
              h.data?.map((event, index) => {
                const after = (event.apres ?? {}) as Record<string, unknown>;
                const before = (event.avant ?? {}) as Record<string, unknown>;
                return (
                  <div key={event.id} className="border-b py-3 text-xs space-y-2">
                    <p className="font-medium">
                      Version {h.data.length - index} ·{" "}
                      {new Date(event.created_at).toLocaleString("fr")} ·{" "}
                      {event.action === "INSERT" ? "Création" : "Modification"}
                    </p>
                    <p>
                      Statut : {STATUS_NAMES[String(before.statut)] ?? "Nouveau"} →{" "}
                      {STATUS_NAMES[String(after.statut)] ?? String(after.statut ?? "")}
                    </p>
                    <details>
                      <summary>Consulter les données de cette version</summary>
                      <pre className="whitespace-pre-wrap break-all mt-2 max-h-80 overflow-auto">
                        {JSON.stringify(after, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })
            )}
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
