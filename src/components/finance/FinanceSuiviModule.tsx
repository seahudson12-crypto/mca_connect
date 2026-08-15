// Module de suivi financier générique, instancié séparément pour :
// - les cotisations sociales
// - les offrandes missionnaires
// Aucune donnée n'est partagée entre les deux : tout est filtré sur op_type.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { toast } from "sonner";
import {
  Coins, Users, AlertTriangle, CheckCircle2, FileDown, Plus, Settings2, History, Pencil, CalendarClock,
  UserPlus, UserMinus, RotateCcw,

} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatXof } from "@/lib/audit";
import { categoryLabel } from "@/lib/constants";
import * as XLSX from "xlsx";
import {
  FREQUENCES, MODES_PAIEMENT, OP_LABELS, STATUT_LABELS, echeanceFor, finDePeriode,
  periodeCourante, periodeLabel, periodeSuivante, periodesFor, prochainDeuxiemeDimanche, reliquatFor,
  statutMembre, surplusFor,
  type FinanceFrequence, type FinanceOpType, type FinanceStatut,
} from "@/lib/finance-suivi";

type Bareme = {
  id: string;
  temple_id: string;
  op_type: FinanceOpType;
  libelle: string | null;
  montant_attendu: number;
  frequence: FinanceFrequence;
  date_debut: string;
  date_echeance: string | null;
  jours_grace: number;
  actif: boolean;
  notes: string | null;
};

type Paiement = {
  id: string;
  membre_id: string;
  temple_id: string;
  op_type: FinanceOpType;
  periode: string;
  montant_attendu: number;
  montant_paye: number;
  date_paiement: string;
  date_echeance: string | null;
  mode_paiement: string;
  reference: string | null;
  observation: string | null;
  created_by: string | null;
};

type Membre = {
  id: string;
  matricule: string | null;
  nom: string;
  prenoms: string;
  categorie: string;
};

type MontantMembre = { id: string; membre_id: string; montant_prevu: number };
type Reliquat = { id: string; membre_id: string; periode: string; date_prevue: string | null };
type ListeEntry = { id: string; membre_id: string; inclus: boolean; motif: string | null };

/** Catégorie automatiquement exclue des offrandes missionnaires. */
const CAT_AUTO_EXCLUE = "nouvelles_ames";

const statutVariant: Record<FinanceStatut, string> = {
  a_jour: "bg-success text-success-foreground",
  paye_plus: "bg-success text-success-foreground",
  partiel: "bg-warning text-warning-foreground",
  retard: "bg-destructive text-destructive-foreground",
  non_paye: "bg-muted text-muted-foreground",
};


export function FinanceSuiviModule({ opType }: { opType: FinanceOpType }) {
  const labels = OP_LABELS[opType];
  const isMission = opType === "mission_offering";
  const { user } = useAuth();
  const { activeTempleId, activeTemple, allTemples, setActiveTempleId, canSwitch } = useActiveTemple();
  const qc = useQueryClient();

  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState<"all" | FinanceStatut>("all");
  const [sortKey, setSortKey] = useState<"membre" | "matricule" | "reste" | "paye">("membre");
  const [payOpen, setPayOpen] = useState(false);
  const [payFor, setPayFor] = useState<Membre | null>(null);
  const [baremeOpen, setBaremeOpen] = useState(false);
  const [histFor, setHistFor] = useState<Membre | null>(null);
  const [montantFor, setMontantFor] = useState<{ membre: Membre; montant: number } | null>(null);
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [ajoutSearch, setAjoutSearch] = useState("");


  const keyBase = ["finance-suivi", opType, activeTempleId];

  const { data: baremes = [] } = useQuery({
    queryKey: [...keyBase, "baremes"],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_baremes")
        .select("*")
        .eq("temple_id", activeTempleId!)
        .eq("op_type", opType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Bareme[];
    },
  });

  const bareme = baremes.find((b) => b.actif) ?? baremes[0] ?? null;
  const frequence: FinanceFrequence = bareme?.frequence ?? "mensuelle";
  const [periode, setPeriode] = useState<string>(() => periodeCourante("mensuelle"));
  const periodes = periodesFor(frequence, annee);
  const periodeActive = periodes.includes(periode) ? periode : periodes[0];
  const montantDefaut = Number(bareme?.montant_attendu ?? 0);

  const { data: membres = [] } = useQuery({
    queryKey: ["finance-membres", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,matricule,nom,prenoms,categorie")
        .eq("temple_id", activeTempleId!)
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as Membre[];
    },
  });

  // Liste des personnes concernées : inclusions / exclusions manuelles (isolées par temple + op_type)
  const { data: listeEntries = [] } = useQuery({
    queryKey: [...keyBase, "liste"],
    enabled: !!activeTempleId && isMission,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_liste_membre")
        .select("id,membre_id,inclus,motif")
        .eq("temple_id", activeTempleId!)
        .eq("op_type", opType);
      if (error) throw error;
      return (data ?? []) as unknown as ListeEntry[];
    },
  });

  const overrides = useMemo(
    () => new Map(listeEntries.map((e) => [e.membre_id, e])),
    [listeEntries],
  );

  /** Un membre est dans la liste active si aucune exclusion manuelle et catégorie éligible. */
  const estActif = (m: Membre) => {
    if (!isMission) return true;
    const o = overrides.get(m.id);
    if (o) return o.inclus;
    return m.categorie !== CAT_AUTO_EXCLUE;
  };

  const membresActifs = useMemo(() => membres.filter(estActif), [membres, overrides, isMission]);

  const exclus = useMemo(
    () =>
      membres
        .filter((m) => !estActif(m))
        .map((m) => {
          const o = overrides.get(m.id);
          const manuel = !!o && !o.inclus;
          return {
            membre: m,
            manuel,
            motif: manuel ? (o?.motif ?? "Exclu de cette collecte") : "Nouvelles âmes (automatique)",
          };
        }),
    [membres, overrides, isMission],
  );

  const exclusAuto = exclus.filter((e) => !e.manuel).length;
  const exclusManuels = exclus.filter((e) => e.manuel).length;

  const setInclusion = useMutation({
    mutationFn: async ({ membre, inclus, motif }: { membre: Membre; inclus: boolean; motif?: string }) => {
      if (!activeTempleId) throw new Error("Aucun temple sélectionné");
      const { error } = await supabase.from("finance_liste_membre").upsert(
        {
          temple_id: activeTempleId,
          membre_id: membre.id,
          op_type: opType,
          inclus,
          motif: motif ?? (inclus ? null : "Exclu de cette collecte"),
          created_by: user?.id ?? null,
        },
        { onConflict: "membre_id,op_type" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.inclus ? "Personne ajoutée à la liste" : "Personne retirée de la liste");
      qc.invalidateQueries({ queryKey: [...keyBase, "liste"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retirerDeLaListe = (membre: Membre) => setInclusion.mutate({ membre, inclus: false });
  const reintegrer = (membre: Membre) => setInclusion.mutate({ membre, inclus: true });

  const ajouterPersonne = (membre: Membre) => {
    if (estActif(membre)) {
      toast.error("Cette personne est déjà dans la liste.");
      return;
    }
    setInclusion.mutate({ membre, inclus: true });
    setAjoutOpen(false);
    setAjoutSearch("");
  };



  const { data: montants = [] } = useQuery({
    queryKey: [...keyBase, "montants"],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_montants_membre")
        .select("id,membre_id,montant_prevu")
        .eq("temple_id", activeTempleId!)
        .eq("op_type", opType);
      if (error) throw error;
      return (data ?? []) as unknown as MontantMembre[];
    },
  });

  const { data: reliquats = [] } = useQuery({
    queryKey: [...keyBase, "reliquats", periodeActive],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_reliquats")
        .select("id,membre_id,periode,date_prevue")
        .eq("temple_id", activeTempleId!)
        .eq("op_type", opType)
        .eq("periode", periodeActive);
      if (error) throw error;
      return (data ?? []) as unknown as Reliquat[];
    },
  });

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: [...keyBase, "paiements", annee],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_paiements")
        .select("*")
        .eq("temple_id", activeTempleId!)
        .eq("op_type", opType)
        .order("date_paiement", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Paiement[];
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: [...keyBase, "paiements", annee] });
    qc.invalidateQueries({ queryKey: [...keyBase, "reliquats", periodeActive] });
    qc.invalidateQueries({ queryKey: [...keyBase, "montants"] });
  };

  const echeance = useMemo(
    () => echeanceFor(periodeActive, bareme?.jours_grace ?? 0, bareme?.date_echeance ?? null),
    [periodeActive, bareme?.jours_grace, bareme?.date_echeance],
  );

  const montantOf = (membreId: string) => {
    const m = montants.find((x) => x.membre_id === membreId);
    return m ? Number(m.montant_prevu) : montantDefaut;
  };

  const rows = useMemo(() => {
    const byMembre = new Map<string, number>();
    paiements
      .filter((p) => p.periode === periodeActive)
      .forEach((p) => byMembre.set(p.membre_id, (byMembre.get(p.membre_id) ?? 0) + Number(p.montant_paye)));

    return membresActifs.map((m) => {
      const paye = byMembre.get(m.id) ?? 0;
      const prevu = montantOf(m.id);
      const statut = statutMembre(prevu, paye);
      const reste = reliquatFor(prevu, paye);
      return {
        membre: m,
        attendu: prevu,
        paye,
        reste,
        surplus: surplusFor(prevu, paye),
        statut,
        enRetard: statut !== "a_jour" && statut !== "paye_plus" && new Date() > echeance,
        dateReliquat: reliquats.find((r) => r.membre_id === m.id)?.date_prevue ?? "",
      };
    });
  }, [membresActifs, paiements, periodeActive, montants, montantDefaut, echeance, reliquats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (catFilter !== "all" && r.membre.categorie !== catFilter) return false;
      if (statutFilter === "retard" && !r.enRetard) return false;
      if (statutFilter !== "all" && statutFilter !== "retard" && r.statut !== statutFilter) return false;
      if (!q) return true;
      return (
        `${r.membre.nom} ${r.membre.prenoms}`.toLowerCase().includes(q) ||
        (r.membre.matricule ?? "").toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      if (sortKey === "matricule") return (a.membre.matricule ?? "").localeCompare(b.membre.matricule ?? "");
      if (sortKey === "reste") return b.reste - a.reste;
      if (sortKey === "paye") return b.paye - a.paye;
      return `${a.membre.nom} ${a.membre.prenoms}`.localeCompare(`${b.membre.nom} ${b.membre.prenoms}`);
    });
    return out;
  }, [rows, search, catFilter, statutFilter, sortKey]);

  const stats = useMemo(() => {
    const concernes = rows.length;
    const payes = rows.filter((r) => r.statut === "a_jour" || r.statut === "paye_plus").length;
    const partiels = rows.filter((r) => r.statut === "partiel").length;
    const nonPayes = rows.filter((r) => r.statut === "non_paye").length;
    const retards = rows.filter((r) => r.enRetard).length;
    const attendu = rows.reduce((s, r) => s + r.attendu, 0);
    const encaisse = rows.reduce((s, r) => s + r.paye, 0);
    const restant = rows.reduce((s, r) => s + r.reste, 0);
    const surplus = rows.reduce((s, r) => s + r.surplus, 0);
    return {
      concernes, payes, partiels, nonPayes, retards, attendu, encaisse, restant, surplus,
      taux: attendu > 0 ? Math.round((Math.min(encaisse, attendu) / attendu) * 100) : 0,
    };
  }, [rows]);

  const parCategorie = useMemo(() => {
    const map = new Map<string, { membres: number; payes: number; partiels: number; nonPayes: number; prevu: number; verse: number; reliquat: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.membre.categorie) ?? { membres: 0, payes: 0, partiels: 0, nonPayes: 0, prevu: 0, verse: 0, reliquat: 0 };
      cur.membres += 1;
      if (r.statut === "a_jour" || r.statut === "paye_plus") cur.payes += 1;
      else if (r.statut === "partiel") cur.partiels += 1;
      else cur.nonPayes += 1;
      cur.prevu += r.attendu;
      cur.verse += r.paye;
      cur.reliquat += r.reste;
      map.set(r.membre.categorie, cur);
    });
    return Array.from(map.entries()).sort(([a], [b]) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [rows]);

  const categories = useMemo(() => Array.from(new Set(membres.map((m) => m.categorie))), [membres]);

  const prochaineCollecte = useMemo(() => prochainDeuxiemeDimanche(), []);

  // Enregistrement rapide via la case « Payé » : complète exactement le reliquat.
  const quickPay = useMutation({
    mutationFn: async ({ membreId, montant, prevu }: { membreId: string; montant: number; prevu: number }) => {
      if (!activeTempleId) throw new Error("Aucun temple sélectionné");
      if (montant <= 0) throw new Error("Aucun reliquat à régler");
      const { error } = await supabase.from("finance_paiements").insert({
        temple_id: activeTempleId,
        membre_id: membreId,
        bareme_id: bareme?.id ?? null,
        op_type: opType,
        periode: periodeActive,
        montant_attendu: prevu,
        montant_paye: montant,
        date_paiement: format(isMission ? prochaineCollecte : new Date(), "yyyy-MM-dd"),
        date_echeance: format(finDePeriode(periodeActive), "yyyy-MM-dd"),
        mode_paiement: "especes" as never,
        observation: "Paiement intégral (case Payé)",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Paiement enregistré · statut À jour"); refreshAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDateReliquat = useMutation({
    mutationFn: async ({ membreId, date }: { membreId: string; date: string }) => {
      if (!activeTempleId) throw new Error("Aucun temple sélectionné");
      const { error } = await supabase.from("finance_reliquats").upsert(
        {
          temple_id: activeTempleId,
          membre_id: membreId,
          op_type: opType,
          periode: periodeActive,
          date_prevue: date || null,
          created_by: user?.id ?? null,
        },
        { onConflict: "membre_id,op_type,periode" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keyBase, "reliquats", periodeActive] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const exportExcel = () => {
    const data = filtered.map((r) => ({
      Matricule: r.membre.matricule ?? "",
      Nom: r.membre.nom,
      Prénoms: r.membre.prenoms,
      Temple: activeTemple?.nom_temple ?? "",
      Catégorie: categoryLabel(r.membre.categorie),
      Période: periodeLabel(periodeActive),
      "Montant prévu": r.attendu,
      [`Montant ${labels.verse.toLowerCase()}`]: r.paye,
      Reliquat: r.reste,
      Surplus: r.surplus,
      "Date prévue du reliquat": r.reste > 0 ? r.dateReliquat : "",
      Échéance: format(echeance, "dd/MM/yyyy"),
      Statut: STATUT_LABELS[r.statut],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, labels.titre.slice(0, 28));
    XLSX.writeFile(wb, `${opType}-${periodeActive}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">{labels.titre}</h1>
          <p className="text-sm text-muted-foreground">
            {activeTemple?.nom_temple ?? "—"} · {periodeLabel(periodeActive)} · Échéance :{" "}
            {format(echeance, "dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBaremeOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Paramétrage
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>
          {isMission && (
            <Button variant="outline" onClick={() => setAjoutOpen(true)} disabled={!activeTempleId}>
              <UserPlus className="mr-2 h-4 w-4" /> Ajouter une personne
            </Button>
          )}

          <Button onClick={() => { setPayFor(null); setPayOpen(true); }} disabled={!activeTempleId}>
            <Plus className="mr-2 h-4 w-4" /> {labels.bouton}
          </Button>
        </div>
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Temple</Label>
            <Select
              value={activeTempleId ?? ""}
              onValueChange={setActiveTempleId}
              disabled={!canSwitch}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un temple" /></SelectTrigger>
              <SelectContent>
                {allTemples.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nom_temple}{t.ville ? ` — ${t.ville}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Seuls les membres du temple sélectionné sont affichés.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Année</Label>
            <Input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value) || annee)} />
          </div>
          <div className="space-y-1.5">
            <Label>Période</Label>
            <Select value={periodeActive} onValueChange={setPeriode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodes.map((p) => <SelectItem key={p} value={p}>{periodeLabel(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {isMission && (
        <Card className="border-0 shadow-elegant p-4 flex flex-wrap items-center gap-3 text-sm">
          <CalendarClock className="h-5 w-5 text-primary" />
          <span>
            <strong>Offrandes de soutien — chaque 2e dimanche.</strong> Prochaine collecte :{" "}
            {format(prochaineCollecte, "EEEE d MMMM yyyy", { locale: fr })}.
          </span>
          <span className="text-muted-foreground">
            Une offrande peut malgré tout être enregistrée à une autre date.
          </span>
        </Card>
      )}

      {!bareme && (
        <Card className="border-0 shadow-elegant p-4 text-sm text-muted-foreground">
          Aucun paramétrage défini pour ce temple. Cliquez sur « Paramétrage » pour définir le montant par défaut,
          la fréquence et l'échéance. Le montant reste modifiable membre par membre.
        </Card>
      )}

      {isMission && (
        <Card className="border-0 shadow-elegant p-4">
          <h2 className="text-base font-semibold mb-3">Contrôle de la liste — {activeTemple?.nom_temple ?? "—"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Membres du temple</p>
              <p className="text-xl font-bold">{membres.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Nouvelles âmes exclues (auto)</p>
              <p className="text-xl font-bold">{exclusAuto}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Exclusions manuelles</p>
              <p className="text-xl font-bold">{exclusManuels}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Personnes concernées</p>
              <p className="text-xl font-bold text-primary">{stats.concernes}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Montant prévu total</p>
              <p className="text-xl font-bold">{formatXof(stats.attendu)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tous les calculs ci-dessous portent uniquement sur la liste active. Retirer une personne ne la supprime
            jamais de MCA Connect.
          </p>
        </Card>
      )}


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membres concernés" value={stats.concernes} icon={Users} />
        <StatCard label="Payés" value={stats.payes} icon={CheckCircle2} variant="success" hint={`${stats.partiels} partiel(s)`} />
        <StatCard label="Non payés" value={stats.nonPayes} icon={AlertTriangle} variant="warning" hint={`${stats.retards} en retard`} />
        <StatCard label="Taux de paiement" value={`${stats.taux}%`} icon={Coins} variant="gold" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total prévu" value={formatXof(stats.attendu)} icon={Coins} />
        <StatCard label={`Total ${labels.verse.toLowerCase()}`} value={formatXof(stats.encaisse)} icon={Coins} />
        <StatCard label="Total reliquats" value={formatXof(stats.restant)} icon={Coins} variant="warning" />
        <StatCard label="Total surplus" value={formatXof(stats.surplus)} icon={Coins} variant="success" />
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Statut</Label>
            <Select value={statutFilter} onValueChange={(v) => setStatutFilter(v as typeof statutFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(Object.keys(STATUT_LABELS) as FinanceStatut[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUT_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Recherche (nom / matricule)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="MCA-CI-TR-0001" />
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Suivi par membre ({filtered.length})</h2>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="membre">Trier par membre</SelectItem>
              <SelectItem value="matricule">Trier par matricule</SelectItem>
              <SelectItem value="reste">Trier par reliquat</SelectItem>
              <SelectItem value="paye">Trier par montant {labels.verse.toLowerCase()}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Matricule</th>
                <th className="px-3 py-2 text-left">Nom et prénoms</th>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Montant prévu</th>
                <th className="px-3 py-2 text-center">Payé</th>
                <th className="px-3 py-2 text-right">Montant versé</th>
                <th className="px-3 py-2 text-right">Reliquat</th>
                <th className="px-3 py-2 text-left">Date prévue</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Chargement...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Aucun membre correspondant</td></tr>
              )}
              {filtered.map((r) => {
                const paye = r.statut === "a_jour" || r.statut === "paye_plus";
                return (
                  <tr key={r.membre.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.membre.matricule ?? "—"}</td>
                    <td className="px-3 py-2">{r.membre.nom} {r.membre.prenoms}</td>
                    <td className="px-3 py-2">{categoryLabel(r.membre.categorie)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 hover:underline"
                        onClick={() => setMontantFor({ membre: r.membre, montant: r.attendu })}
                      >
                        {formatXof(r.attendu)} <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={paye}
                        disabled={paye || quickPay.isPending || r.attendu <= 0}
                        onCheckedChange={(v) => {
                          if (v === true) quickPay.mutate({ membreId: r.membre.id, montant: r.reste, prevu: r.attendu });
                        }}
                        aria-label="Marquer comme payé"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatXof(r.paye)}
                      {r.surplus > 0 && (
                        <span className="ml-1 text-xs text-success">+{formatXof(r.surplus)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{r.reste > 0 ? formatXof(r.reste) : "—"}</td>
                    <td className="px-3 py-2">
                      {r.reste > 0 ? (
                        <Input
                          type="date"
                          className="h-8 w-36"
                          value={r.dateReliquat ?? ""}
                          onChange={(e) => saveDateReliquat.mutate({ membreId: r.membre.id, date: e.target.value })}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={statutVariant[r.enRetard ? "retard" : r.statut]}>
                        {r.enRetard ? STATUT_LABELS.retard : STATUT_LABELS[r.statut]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => { setPayFor(r.membre); setPayOpen(true); }}>
                        <Plus className="mr-1 h-4 w-4" /> Paiement
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setHistFor(r.membre)}>
                        <History className="mr-1 h-4 w-4" /> Historique
                      </Button>
                      {isMission && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={setInclusion.isPending}
                          onClick={() => retirerDeLaListe(r.membre)}
                          title="Retirer de la liste des offrandes missionnaires"
                        >
                          <UserMinus className="mr-1 h-4 w-4" /> Retirer
                        </Button>
                      )}

                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {isMission && (
        <Card className="border-0 shadow-elegant overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="text-base font-semibold">Personnes exclues ({exclus.length})</h2>
            <p className="text-xs text-muted-foreground">
              Ces personnes ne participent pas à cette collecte et n'entrent dans aucun calcul. Elles restent
              enregistrées dans MCA Connect.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Matricule</th>
                  <th className="px-3 py-2 text-left">Nom et prénoms</th>
                  <th className="px-3 py-2 text-left">Catégorie</th>
                  <th className="px-3 py-2 text-left">Motif d'exclusion</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {exclus.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucune personne exclue</td></tr>
                )}
                {exclus.map((e) => (
                  <tr key={e.membre.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{e.membre.matricule ?? "—"}</td>
                    <td className="px-3 py-2">{e.membre.nom} {e.membre.prenoms}</td>
                    <td className="px-3 py-2">{categoryLabel(e.membre.categorie)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={e.manuel ? "destructive" : "secondary"}>{e.motif}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setInclusion.isPending}
                        onClick={() => reintegrer(e.membre)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" /> Réintégrer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}


      <Card className="border-0 shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Synthèse par catégorie — {labels.titre}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Membres</th>
                <th className="px-3 py-2 text-right">Payés</th>
                <th className="px-3 py-2 text-right">Partiels</th>
                <th className="px-3 py-2 text-right">Non payés</th>
                <th className="px-3 py-2 text-right">Prévu</th>
                <th className="px-3 py-2 text-right">Versé</th>
                <th className="px-3 py-2 text-right">Reliquats</th>
              </tr>
            </thead>
            <tbody>
              {parCategorie.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Aucune donnée</td></tr>
              )}
              {parCategorie.map(([cat, v]) => (
                <tr key={cat} className="border-t">
                  <td className="px-3 py-2">{categoryLabel(cat)}</td>
                  <td className="px-3 py-2 text-right">{v.membres}</td>
                  <td className="px-3 py-2 text-right">{v.payes}</td>
                  <td className="px-3 py-2 text-right">{v.partiels}</td>
                  <td className="px-3 py-2 text-right">{v.nonPayes}</td>
                  <td className="px-3 py-2 text-right">{formatXof(v.prevu)}</td>
                  <td className="px-3 py-2 text-right">{formatXof(v.verse)}</td>
                  <td className="px-3 py-2 text-right">{formatXof(v.reliquat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PaiementDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        opType={opType}
        membres={membres}
        membrePreselect={payFor}
        periodes={periodes}
        periodeDefaut={periodeActive}
        montantPrevuFor={montantOf}
        dateDefaut={format(isMission ? prochaineCollecte : new Date(), "yyyy-MM-dd")}
        baremeId={bareme?.id ?? null}
        templeId={activeTempleId}
        templeNom={activeTemple?.nom_temple ?? ""}
        userId={user?.id ?? null}
        onSaved={refreshAll}
      />

      <BaremeDialog
        open={baremeOpen}
        onOpenChange={setBaremeOpen}
        opType={opType}
        bareme={bareme}
        templeId={activeTempleId}
        userId={user?.id ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: [...keyBase, "baremes"] })}
      />

      <MontantDialog
        state={montantFor}
        onClose={() => setMontantFor(null)}
        opType={opType}
        templeId={activeTempleId}
        userId={user?.id ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: [...keyBase, "montants"] })}
      />

      <HistoriqueDialog
        membre={histFor}
        onClose={() => setHistFor(null)}
        opType={opType}
        paiements={paiements.filter((p) => p.membre_id === histFor?.id)}
        frequence={frequence}
        joursGrace={bareme?.jours_grace ?? 0}
        montantAttendu={histFor ? montantOf(histFor.id) : montantDefaut}
        periodeActive={periodeActive}
      />
    </div>
  );
}

function MontantDialog({
  state, onClose, opType, templeId, userId, onSaved,
}: {
  state: { membre: Membre; montant: number } | null;
  onClose: () => void;
  opType: FinanceOpType;
  templeId: string | null;
  userId: string | null;
  onSaved: () => void;
}) {
  const [valeur, setValeur] = useState("");
  const [dirtyFor, setDirtyFor] = useState<string | null>(null);

  // Synchronise le champ à l'ouverture, sans écraser la saisie en cours.
  if (state && dirtyFor !== state.membre.id) {
    setDirtyFor(state.membre.id);
    setValeur(String(state.montant));
  }

  const { data: changes = [] } = useQuery({
    queryKey: ["finance-montant-changes", opType, state?.membre.id],
    enabled: !!state,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_montant_changes")
        .select("id,ancien_montant,nouveau_montant,changed_by,created_at")
        .eq("membre_id", state!.membre.id)
        .eq("op_type", opType)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!templeId || !state) throw new Error("Aucun temple sélectionné");
      const nouveau = Number(valeur);
      if (!Number.isFinite(nouveau) || nouveau < 0) throw new Error("Montant invalide");
      const { error } = await supabase.from("finance_montants_membre").upsert(
        {
          temple_id: templeId,
          membre_id: state.membre.id,
          op_type: opType,
          montant_prevu: nouveau,
          created_by: userId,
        },
        { onConflict: "membre_id,op_type" },
      );
      if (error) throw error;
      const { error: e2 } = await supabase.from("finance_montant_changes").insert({
        temple_id: templeId,
        membre_id: state.membre.id,
        op_type: opType,
        ancien_montant: state.montant,
        nouveau_montant: nouveau,
        changed_by: userId,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Montant prévu enregistré");
      qc.invalidateQueries({ queryKey: ["finance-montant-changes", opType, state?.membre.id] });
      onSaved();
      setDirtyFor(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!state} onOpenChange={(v) => { if (!v) { setDirtyFor(null); onClose(); } }}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le montant prévu</DialogTitle>
          <DialogDescription>
            {state?.membre.matricule ? `${state.membre.matricule} — ` : ""}
            {state?.membre.nom} {state?.membre.prenoms} · {OP_LABELS[opType].titre}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ancien montant</Label>
              <Input value={formatXof(state?.montant ?? 0)} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Nouveau montant (FCFA)</Label>
              <Input type="number" value={valeur} onChange={(e) => setValeur(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Historique des modifications</Label>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y text-sm">
              {changes.length === 0 && <p className="px-3 py-3 text-muted-foreground">Aucune modification</p>}
              {changes.map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span>
                    {formatXof(Number(c.ancien_montant ?? 0))} → <strong>{formatXof(Number(c.nouveau_montant))}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at as string), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDirtyFor(null); onClose(); }}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaiementDialog({
  open, onOpenChange, opType, membres, membrePreselect, periodes, periodeDefaut, montantPrevuFor, dateDefaut,
  baremeId, templeId, templeNom, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opType: FinanceOpType;
  membres: Membre[];
  membrePreselect: Membre | null;
  periodes: string[];
  periodeDefaut: string;
  montantPrevuFor: (membreId: string) => number;
  dateDefaut: string;
  baremeId: string | null;
  templeId: string | null;
  templeNom: string;
  userId: string | null;
  onSaved: () => void;
}) {
  const labels = OP_LABELS[opType];
  const [membreId, setMembreId] = useState("");
  const [periode, setPeriode] = useState(periodeDefaut);
  const [paye, setPaye] = useState("");
  const [datePaiement, setDatePaiement] = useState(dateDefaut);
  const [mode, setMode] = useState<string>("especes");
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  const openKey = open ? `${membrePreselect?.id ?? "none"}-${periodeDefaut}` : null;
  if (openKey && syncedFor !== openKey) {
    setSyncedFor(openKey);
    setMembreId(membrePreselect?.id ?? "");
    setPeriode(periodeDefaut);
    setDatePaiement(dateDefaut);
  }
  if (!open && syncedFor) setSyncedFor(null);

  const membre = membres.find((m) => m.id === membreId);
  const prevu = membreId ? montantPrevuFor(membreId) : 0;
  const montantSaisi = Number(paye) || 0;
  const reliquat = reliquatFor(prevu, montantSaisi);
  const surplus = surplusFor(prevu, montantSaisi);

  const save = useMutation({
    mutationFn: async () => {
      if (!templeId) throw new Error("Aucun temple actif");
      if (!membreId) throw new Error("Sélectionnez un membre");
      if (!Number.isFinite(montantSaisi) || montantSaisi <= 0) throw new Error("Montant versé invalide");
      const { error } = await supabase.from("finance_paiements").insert({
        temple_id: templeId,
        membre_id: membreId,
        bareme_id: baremeId,
        op_type: opType,
        periode,
        montant_attendu: prevu,
        montant_paye: montantSaisi,
        date_paiement: datePaiement,
        date_echeance: format(finDePeriode(periode), "yyyy-MM-dd"),
        mode_paiement: mode as never,
        reference: reference || null,
        observation: observation || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${labels.singulier.charAt(0).toUpperCase()}${labels.singulier.slice(1)} enregistrée`);
      setPaye(""); setReference(""); setObservation("");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{labels.bouton}</DialogTitle>
          <DialogDescription>
            Les paiements partiels et complémentaires sont conservés : le reliquat est recalculé automatiquement.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Membre</Label>
            <Select value={membreId} onValueChange={setMembreId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
              <SelectContent>
                {membres.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.matricule ? `${m.matricule} — ` : ""}{m.nom} {m.prenoms}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Matricule</Label>
              <Input value={membre?.matricule ?? ""} readOnly className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Temple</Label>
              <Input value={templeNom} readOnly />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Période</Label>
              <Select value={periodes.includes(periode) ? periode : periodeDefaut} onValueChange={setPeriode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodes.map((p) => <SelectItem key={p} value={p}>{periodeLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{opType === "mission_offering" ? "Date du culte" : "Date"}</Label>
              <Input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Montant prévu</Label>
              <Input value={formatXof(prevu)} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Montant {labels.verse.toLowerCase()}</Label>
              <Input type="number" value={paye} onChange={(e) => setPaye(e.target.value)} />
            </div>
          </div>
          {montantSaisi > 0 && (
            <p className="text-sm">
              {reliquat > 0
                ? <>Reliquat : <strong>{formatXof(reliquat)}</strong> — statut « Partiellement payé »</>
                : surplus > 0
                  ? <>Différence : <strong className="text-success">+{formatXof(surplus)}</strong> — statut « Payé », aucun reliquat</>
                  : <>Aucun reliquat — statut « À jour »</>}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES_PAIEMENT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Référence</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observation</Label>
            <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BaremeDialog({
  open, onOpenChange, opType, bareme, templeId, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opType: FinanceOpType;
  bareme: Bareme | null;
  templeId: string | null;
  userId: string | null;
  onSaved: () => void;
}) {
  const labels = OP_LABELS[opType];
  const [libelle, setLibelle] = useState(bareme?.libelle ?? labels.titre);
  const [montant, setMontant] = useState(String(bareme?.montant_attendu ?? 0));
  const [frequence, setFrequence] = useState<FinanceFrequence>(bareme?.frequence ?? "mensuelle");
  const [dateDebut, setDateDebut] = useState(bareme?.date_debut ?? format(new Date(), "yyyy-MM-dd"));
  const [dateEcheance, setDateEcheance] = useState(bareme?.date_echeance ?? "");
  const [grace, setGrace] = useState(String(bareme?.jours_grace ?? 0));
  const [actif, setActif] = useState(bareme?.actif ?? true);

  const save = useMutation({
    mutationFn: async () => {
      if (!templeId) throw new Error("Aucun temple actif");
      const payload = {
        temple_id: templeId,
        op_type: opType,
        libelle: libelle || null,
        montant_attendu: Number(montant) || 0,
        frequence,
        date_debut: dateDebut,
        date_echeance: dateEcheance || null,
        jours_grace: Number(grace) || 0,
        actif,
      };
      if (bareme) {
        const { error } = await supabase.from("finance_baremes").update(payload).eq("id", bareme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_baremes").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Paramétrage enregistré");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Paramétrage — {labels.titre}</DialogTitle>
          <DialogDescription>
            Montant par défaut, fréquence et échéance pour ce temple uniquement. Le montant reste modifiable
            individuellement pour chaque membre.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Libellé</Label>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Montant par défaut (FCFA)</Label>
              <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fréquence</Label>
              <Select value={frequence} onValueChange={(v) => setFrequence(v as FinanceFrequence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date d'échéance (optionnelle)</Label>
              <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Jours de grâce</Label>
              <Input type="number" value={grace} onChange={(e) => setGrace(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={actif} onCheckedChange={setActif} />
              <Label>Paramétrage actif</Label>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoriqueDialog({
  membre, onClose, opType, paiements, frequence, joursGrace, montantAttendu, periodeActive,
}: {
  membre: Membre | null;
  onClose: () => void;
  opType: FinanceOpType;
  paiements: Paiement[];
  frequence: FinanceFrequence;
  joursGrace: number;
  montantAttendu: number;
  periodeActive: string;
}) {
  const labels = OP_LABELS[opType];
  const groupes = useMemo(() => {
    const map = new Map<string, { paye: number; attendu: number; lignes: Paiement[] }>();
    paiements.forEach((p) => {
      const cur = map.get(p.periode) ?? { paye: 0, attendu: montantAttendu, lignes: [] };
      cur.paye += Number(p.montant_paye);
      cur.lignes.push(p);
      map.set(p.periode, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([periode, v]) => ({
        periode,
        ...v,
        lignes: v.lignes.sort((a, b) => a.date_paiement.localeCompare(b.date_paiement)),
        reste: reliquatFor(v.attendu, v.paye),
        surplus: surplusFor(v.attendu, v.paye),
        statut: statutMembre(v.attendu, v.paye),
      }));
  }, [paiements, montantAttendu]);

  const prochaine = periodeSuivante(frequence, periodeActive);

  return (
    <Dialog open={!!membre} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[92dvh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Historique — {labels.titre}</DialogTitle>
          <DialogDescription>
            {membre?.matricule ? `${membre.matricule} — ` : ""}{membre?.nom} {membre?.prenoms} · Prochaine échéance :{" "}
            {format(echeanceFor(prochaine, joursGrace), "dd/MM/yyyy")} ({periodeLabel(prochaine)})
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {groupes.length === 0 && <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>}
          {groupes.map((g) => (
            <div key={g.periode} className="rounded-md border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
                <strong>{periodeLabel(g.periode)}</strong>
                <span className="flex items-center gap-2">
                  <Badge className={statutVariant[g.statut]}>{STATUT_LABELS[g.statut]}</Badge>
                  <span className="text-muted-foreground">
                    Prévu {formatXof(g.attendu)} · Versé {formatXof(g.paye)}
                    {g.reste > 0 ? ` · Reliquat ${formatXof(g.reste)}` : ""}
                    {g.surplus > 0 ? ` · Surplus +${formatXof(g.surplus)}` : ""}
                  </span>
                </span>
              </div>
              <div className="divide-y text-sm">
                {g.lignes.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>{format(new Date(l.date_paiement), "dd/MM/yyyy")}</span>
                    <span className="font-medium">{formatXof(Number(l.montant_paye))}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
