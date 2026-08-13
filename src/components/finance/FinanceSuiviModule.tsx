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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { toast } from "sonner";
import { Coins, Users, AlertTriangle, CheckCircle2, FileDown, Plus, Settings2, History } from "lucide-react";
import { format } from "date-fns";
import { formatXof } from "@/lib/audit";
import { categoryLabel } from "@/lib/constants";
import * as XLSX from "xlsx";
import {
  FREQUENCES, MODES_PAIEMENT, OP_LABELS, STATUT_LABELS, echeanceFor, finDePeriode, periodeCourante,
  periodeLabel, periodeSuivante, periodesFor, statutFor,
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

const statutVariant: Record<FinanceStatut, string> = {
  a_jour: "bg-success text-success-foreground",
  partiel: "bg-warning text-warning-foreground",
  retard: "bg-destructive text-destructive-foreground",
  non_paye: "bg-muted text-muted-foreground",
};

export function FinanceSuiviModule({ opType }: { opType: FinanceOpType }) {
  const labels = OP_LABELS[opType];
  const { user } = useAuth();
  const { activeTempleId, activeTemple } = useActiveTemple();
  const qc = useQueryClient();

  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState<"all" | FinanceStatut>("all");
  const [sortKey, setSortKey] = useState<"membre" | "matricule" | "reste" | "paye">("membre");
  const [payOpen, setPayOpen] = useState(false);
  const [baremeOpen, setBaremeOpen] = useState(false);
  const [histFor, setHistFor] = useState<Membre | null>(null);

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
  const montantAttendu = Number(bareme?.montant_attendu ?? 0);

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

  const echeance = useMemo(
    () => echeanceFor(periodeActive, bareme?.jours_grace ?? 0, bareme?.date_echeance ?? null),
    [periodeActive, bareme?.jours_grace, bareme?.date_echeance],
  );

  const rows = useMemo(() => {
    const byMembre = new Map<string, number>();
    paiements
      .filter((p) => p.periode === periodeActive)
      .forEach((p) => byMembre.set(p.membre_id, (byMembre.get(p.membre_id) ?? 0) + Number(p.montant_paye)));

    return membres.map((m) => {
      const paye = byMembre.get(m.id) ?? 0;
      const attendu = montantAttendu;
      const reste = Math.max(attendu - paye, 0);
      return { membre: m, attendu, paye, reste, statut: statutFor(attendu, paye, echeance) };
    });
  }, [membres, paiements, periodeActive, montantAttendu, echeance]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (catFilter !== "all" && r.membre.categorie !== catFilter) return false;
      if (statutFilter !== "all" && r.statut !== statutFilter) return false;
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
    const aJour = rows.filter((r) => r.statut === "a_jour").length;
    const partiels = rows.filter((r) => r.statut === "partiel").length;
    const retards = rows.filter((r) => r.statut === "retard").length;
    const attendu = rows.reduce((s, r) => s + r.attendu, 0);
    const encaisse = rows.reduce((s, r) => s + r.paye, 0);
    const restant = rows.reduce((s, r) => s + r.reste, 0);
    return {
      concernes, aJour, partiels, retards, attendu, encaisse, restant,
      taux: attendu > 0 ? Math.round((Math.min(encaisse, attendu) / attendu) * 100) : 0,
    };
  }, [rows]);

  const categories = useMemo(
    () => Array.from(new Set(membres.map((m) => m.categorie))),
    [membres],
  );

  const exportExcel = () => {
    const data = filtered.map((r) => ({
      Matricule: r.membre.matricule ?? "",
      Nom: r.membre.nom,
      Prénoms: r.membre.prenoms,
      Temple: activeTemple?.nom_temple ?? "",
      Catégorie: categoryLabel(r.membre.categorie),
      Période: periodeLabel(periodeActive),
      Attendu: r.attendu,
      [labels.verse]: r.paye,
      Reste: r.reste,
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
            {activeTemple?.nom_temple ?? "—"} · {periodeLabel(periodeActive)} · Prochaine échéance :{" "}
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
          <Button onClick={() => setPayOpen(true)} disabled={!activeTempleId}>
            <Plus className="mr-2 h-4 w-4" /> {labels.bouton}
          </Button>
        </div>
      </div>

      {!bareme && (
        <Card className="border-0 shadow-elegant p-4 text-sm text-muted-foreground">
          Aucun paramétrage défini pour ce temple. Cliquez sur « Paramétrage » pour définir le montant attendu,
          la fréquence et l'échéance.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membres concernés" value={stats.concernes} icon={Users} />
        <StatCard label="À jour" value={stats.aJour} icon={CheckCircle2} variant="success" hint={`${stats.partiels} paiement(s) partiel(s)`} />
        <StatCard label="En retard" value={stats.retards} icon={AlertTriangle} variant="warning" />
        <StatCard label="Taux de paiement" value={`${stats.taux}%`} icon={Coins} variant="gold" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Montant attendu" value={formatXof(stats.attendu)} icon={Coins} />
        <StatCard label={`Montant ${labels.verse.toLowerCase()}`} value={formatXof(stats.encaisse)} icon={Coins} />
        <StatCard label="Montant restant" value={formatXof(stats.restant)} icon={Coins} />
      </div>

      <Card className="p-4 border-0 shadow-elegant">
        <div className="grid gap-3 md:grid-cols-5">
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
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="membre">Trier par membre</SelectItem>
              <SelectItem value="matricule">Trier par matricule</SelectItem>
              <SelectItem value="reste">Trier par reste</SelectItem>
              <SelectItem value="paye">Trier par montant {labels.verse.toLowerCase()}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Matricule</th>
                <th className="px-4 py-2 text-left">Membre</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-right">Attendu</th>
                <th className="px-4 py-2 text-right">{labels.verse}</th>
                <th className="px-4 py-2 text-right">Reste</th>
                <th className="px-4 py-2 text-left">Échéance</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Chargement...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Aucun membre correspondant</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.membre.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{r.membre.matricule ?? "—"}</td>
                  <td className="px-4 py-2">{r.membre.nom} {r.membre.prenoms}</td>
                  <td className="px-4 py-2">{categoryLabel(r.membre.categorie)}</td>
                  <td className="px-4 py-2 text-right">{formatXof(r.attendu)}</td>
                  <td className="px-4 py-2 text-right">{formatXof(r.paye)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatXof(r.reste)}</td>
                  <td className="px-4 py-2">{format(echeance, "dd/MM/yyyy")}</td>
                  <td className="px-4 py-2">
                    <Badge className={statutVariant[r.statut]}>{STATUT_LABELS[r.statut]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setHistFor(r.membre)}>
                      <History className="mr-1.5 h-4 w-4" /> Historique
                    </Button>
                  </td>
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
        periodes={periodes}
        periodeDefaut={periodeActive}
        montantAttendu={montantAttendu}
        baremeId={bareme?.id ?? null}
        templeId={activeTempleId}
        templeNom={activeTemple?.nom_temple ?? ""}
        userId={user?.id ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: [...keyBase, "paiements", annee] })}
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

      <HistoriqueDialog
        membre={histFor}
        onClose={() => setHistFor(null)}
        opType={opType}
        paiements={paiements.filter((p) => p.membre_id === histFor?.id)}
        frequence={frequence}
        joursGrace={bareme?.jours_grace ?? 0}
        montantAttendu={montantAttendu}
        periodeActive={periodeActive}
      />
    </div>
  );
}

function PaiementDialog({
  open, onOpenChange, opType, membres, periodes, periodeDefaut, montantAttendu, baremeId,
  templeId, templeNom, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opType: FinanceOpType;
  membres: Membre[];
  periodes: string[];
  periodeDefaut: string;
  montantAttendu: number;
  baremeId: string | null;
  templeId: string | null;
  templeNom: string;
  userId: string | null;
  onSaved: () => void;
}) {
  const labels = OP_LABELS[opType];
  const [membreId, setMembreId] = useState("");
  const [periode, setPeriode] = useState(periodeDefaut);
  const [attendu, setAttendu] = useState(String(montantAttendu));
  const [paye, setPaye] = useState("");
  const [datePaiement, setDatePaiement] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState<string>("especes");
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");

  const membre = membres.find((m) => m.id === membreId);

  const save = useMutation({
    mutationFn: async () => {
      if (!templeId) throw new Error("Aucun temple actif");
      if (!membreId) throw new Error("Sélectionnez un membre");
      const montant = Number(paye);
      if (!Number.isFinite(montant) || montant <= 0) throw new Error("Montant payé invalide");
      const { error } = await supabase.from("finance_paiements").insert({
        temple_id: templeId,
        membre_id: membreId,
        bareme_id: baremeId,
        op_type: opType,
        periode,
        montant_attendu: Number(attendu) || 0,
        montant_paye: montant,
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
          <DialogDescription>Les paiements partiels sont acceptés : le reste est recalculé automatiquement.</DialogDescription>
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
              <Label>Date</Label>
              <Input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Montant attendu</Label>
              <Input type="number" value={attendu} onChange={(e) => setAttendu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Montant {labels.verse.toLowerCase()}</Label>
              <Input type="number" value={paye} onChange={(e) => setPaye(e.target.value)} />
            </div>
          </div>
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
          <DialogDescription>Montant attendu, fréquence et échéance pour ce temple uniquement.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Libellé</Label>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Montant attendu (FCFA)</Label>
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
              <Label>Période de grâce (jours)</Label>
              <Input type="number" value={grace} onChange={(e) => setGrace(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Actif</Label>
              <Switch checked={actif} onCheckedChange={setActif} />
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
    const map = new Map<string, { paye: number; attendu: number; date: string }>();
    paiements.forEach((p) => {
      const cur = map.get(p.periode) ?? { paye: 0, attendu: Number(p.montant_attendu) || montantAttendu, date: p.date_paiement };
      cur.paye += Number(p.montant_paye);
      if (p.date_paiement > cur.date) cur.date = p.date_paiement;
      map.set(p.periode, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([periode, v]) => ({
        periode,
        ...v,
        reste: Math.max(v.attendu - v.paye, 0),
        statut: statutFor(v.attendu, v.paye, echeanceFor(periode, joursGrace)),
      }));
  }, [paiements, joursGrace, montantAttendu]);

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
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Période</th>
                <th className="px-3 py-2 text-right">Attendu</th>
                <th className="px-3 py-2 text-right">{labels.verse}</th>
                <th className="px-3 py-2 text-right">Reste</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {groupes.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Aucun enregistrement</td></tr>
              )}
              {groupes.map((g) => (
                <tr key={g.periode} className="border-t">
                  <td className="px-3 py-2">{periodeLabel(g.periode)}</td>
                  <td className="px-3 py-2 text-right">{formatXof(g.attendu)}</td>
                  <td className="px-3 py-2 text-right">{formatXof(g.paye)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatXof(g.reste)}</td>
                  <td className="px-3 py-2">{format(new Date(g.date), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2"><Badge className={statutVariant[g.statut]}>{STATUT_LABELS[g.statut]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
