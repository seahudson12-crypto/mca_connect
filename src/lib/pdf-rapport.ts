import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CATEGORIES, categoryLabel, culteTypeLabel, isEcodimAllowed, ECODIM_CATEGORY } from "@/lib/constants";
import { formatXof } from "@/lib/audit";

export interface RapportPdfData {
  culte: {
    id: string;
    date: string;
    type_culte: string;
    heure_debut?: string | null;
    heure_fin?: string | null;
    president?: string | null;
    theme_presidence?: string | null;
    versets?: string | null;
    responsable_priere?: string | null;
    orateur?: string | null;
    theme_principal?: string | null;
    statut?: string;
    validated_at?: string | null;
    priere_intense_active?: boolean;
  };
  temple: { nom_temple: string; ville?: string | null; pays?: string | null };
  membres: Array<{ id: string; categorie: string; nom: string; prenoms: string }>;
  presences: Array<{ membre_id: string; statut: string }>;
  orateurs?: Array<{ nom: string; fonction?: string | null; theme?: string | null; versets?: string | null }>;
  finance?: {
    offrande: number; dime: number; action_grace: number; semence: number;
    contribution_speciale: number; depense: number; solde: number; observation: string | null;
  } | null;
  includeFinances?: boolean;
}

type LastTable = { lastAutoTable?: { finalY: number } };

export function generateRapportPdf({
  culte, temple, membres: membresIn, presences, orateurs, finance, includeFinances = true,
}: RapportPdfData): jsPDF {
  // Règle ECODIM : exclure les enfants si le culte n'est pas du dimanche
  const membres = isEcodimAllowed(culte.type_culte)
    ? membresIn
    : membresIn.filter((m) => m.categorie !== ECODIM_CATEGORY);
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.text("RAPPORT DE CULTE", pageW / 2, 16, { align: "center" });
  doc.setFontSize(11);
  doc.text(temple.nom_temple, pageW / 2, 23, { align: "center" });
  if (temple.ville || temple.pays) {
    doc.setFontSize(9);
    doc.text(
      [temple.ville, temple.pays].filter(Boolean).join(" – "),
      pageW / 2, 28, { align: "center" },
    );
  }

  // Infos culte
  doc.setFontSize(10);
  let y = 38;
  doc.text(
    `${culteTypeLabel(culte.type_culte)} — ${format(new Date(culte.date), "EEEE d MMMM yyyy", { locale: fr })}`,
    14, y,
  );
  y += 6;
  const infos: Array<[string, string | null | undefined]> = [
    ["Horaire", [culte.heure_debut, culte.heure_fin].filter(Boolean).join(" – ") || null],
    ["Président", culte.president],
    ["Thème présidence", culte.theme_presidence],
    ["Versets", culte.versets],
    ["Responsable prière", culte.responsable_priere],
    ["Orateur", culte.orateur],
    ["Thème principal", culte.theme_principal],
  ];
  infos.forEach(([k, v]) => {
    if (v) {
      doc.setFont(undefined as never, "bold"); doc.text(`${k} :`, 14, y);
      doc.setFont(undefined as never, "normal");
      const split = doc.splitTextToSize(String(v), 150);
      doc.text(split, 50, y);
      y += 5 * split.length;
    }
  });

  // Stats globales
  const presMap = new Map(presences.map((p) => [p.membre_id, p.statut]));
  const totalPres = membres.filter((m) => presMap.get(m.id) === "present").length;
  const totalAbs = membres.filter((m) => presMap.get(m.id) === "absent").length;
  const totalMb = membres.length;
  const tauxG = totalMb > 0 ? Math.round((totalPres * 100) / totalMb) : 0;

  y += 4;
  doc.setFontSize(11);
  doc.text(
    `Total membres : ${totalMb}    Présents : ${totalPres}    Absents : ${totalAbs}    Taux : ${tauxG}%`,
    14, y,
  );

  // Ventilation par catégorie
  const byCat: Record<string, { present: number; absent: number; total: number }> = {};
  CATEGORIES.forEach((c) => { byCat[c.value] = { present: 0, absent: 0, total: 0 }; });
  membres.forEach((m) => {
    const bucket = byCat[m.categorie] ||= { present: 0, absent: 0, total: 0 };
    bucket.total++;
    const s = presMap.get(m.id);
    if (s === "present") bucket.present++;
    else if (s === "absent") bucket.absent++;
  });

  const catRows = CATEGORIES
    .map((c) => {
      const b = byCat[c.value];
      const taux = b.total > 0 ? Math.round((b.present * 100) / b.total) : 0;
      return [c.label, String(b.total), String(b.present), String(b.absent), `${taux}%`];
    })
    .filter((r) => Number(r[1]) > 0);

  autoTable(doc, {
    startY: y + 6,
    head: [["Catégorie", "Effectif", "Présents", "Absents", "Taux"]],
    body: catRows.length > 0 ? catRows : [["—", "0", "0", "0", "0%"]],
    headStyles: { fillColor: [42, 80, 180] },
    styles: { fontSize: 9 },
  });

  // Finances
  if (includeFinances && finance) {
    const f = finance;
    const recettes = Number(f.offrande) + Number(f.dime) + Number(f.action_grace) + Number(f.semence) + Number(f.contribution_speciale);
    const lastY = (doc as unknown as LastTable).lastAutoTable?.finalY ?? y;
    autoTable(doc, {
      startY: lastY + 8,
      head: [["Rapport financier", "Montant"]],
      body: [
        ["Offrandes", formatXof(Number(f.offrande))],
        ["Dîmes", formatXof(Number(f.dime))],
        ["Actions de grâce", formatXof(Number(f.action_grace))],
        ["Semences", formatXof(Number(f.semence))],
        ["Contributions spéciales", formatXof(Number(f.contribution_speciale))],
        ["Total recettes", formatXof(recettes)],
        ["Dépenses", formatXof(Number(f.depense))],
        ["Solde final", formatXof(Number(f.solde))],
      ],
      headStyles: { fillColor: [180, 140, 40] },
      styles: { fontSize: 10 },
    });
    if (f.observation) {
      const yo = (doc as unknown as LastTable).lastAutoTable?.finalY ?? lastY + 30;
      doc.setFontSize(10);
      doc.setFont(undefined as never, "bold");
      doc.text("Observations :", 14, yo + 8);
      doc.setFont(undefined as never, "normal");
      doc.setFontSize(9);
      const split = doc.splitTextToSize(f.observation, 180);
      doc.text(split, 14, yo + 14);
    }
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  const statutTxt = culte.statut === "valide" ? "Rapport validé" : culte.statut === "corrige_admin" ? "Corrigé par Super Admin" : "Brouillon";
  const validTxt = culte.validated_at ? ` le ${format(new Date(culte.validated_at), "dd/MM/yyyy HH:mm")}` : "";
  doc.text(`${statutTxt}${validTxt}    •    Généré le ${format(new Date(), "dd/MM/yyyy HH:mm")}    •    MCA Connect`, pageW / 2, pageH - 8, { align: "center" });

  return doc;
}
