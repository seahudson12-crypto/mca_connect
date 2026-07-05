import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle, Send, Users, Copy, FileSpreadsheet, UsersRound, Megaphone, Cloud, CheckCircle2, AlertTriangle,
  ChevronRight, SkipForward, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/whatsapp")({ component: WhatsAppPage });

/**
 * Normalise et valide un numéro au format international (E.164 sans le +).
 * Retourne null si invalide.
 * Règles:
 *  - Retire tout sauf chiffres
 *  - Si commence par 00 -> retire les 00
 *  - Si commence par 0 (national) -> préfixe 225 (Côte d'Ivoire) par défaut
 *  - Doit contenir entre 8 et 15 chiffres au final
 */
function normalizeAndValidate(num: string | null | undefined): string | null {
  if (!num) return null;
  let n = num.replace(/[^\d]/g, "");
  if (!n) return null;
  if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = "225" + n.slice(1);
  if (n.length < 8 || n.length > 15) return null;
  return n;
}

function WhatsAppPage() {
  const [filterCat, setFilterCat] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(
    "Bonjour, vous êtes attendus au prochain culte. Que Dieu vous bénisse ! — MCA Treichville"
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // File d'attente pour la diffusion séquentielle
  type BroadcastItem = { id: string; nom: string; prenoms: string; number: string; categorie: string };
  const [broadcastQueue, setBroadcastQueue] = useState<BroadcastItem[]>([]);
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState<Set<string>>(new Set());
  const [broadcastSkipped, setBroadcastSkipped] = useState<Set<string>>(new Set());

  const { data: membres = [] } = useQuery({
    queryKey: ["membres-wa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id,nom,prenoms,categorie,whatsapp,telephone")
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return membres.filter(
      (m) => (filterCat === "all" || m.categorie === filterCat) && (m.whatsapp || m.telephone)
    );
  }, [membres, filterCat]);

  const selectedList = useMemo(
    () => filtered.filter((m) => selected.has(m.id)),
    [filtered, selected]
  );

  const validation = useMemo(() => {
    const valid: { id: string; nom: string; prenoms: string; number: string; categorie: string }[] = [];
    const invalid: { id: string; nom: string; prenoms: string; raw: string | null }[] = [];
    for (const m of selectedList) {
      const raw = m.whatsapp || m.telephone || null;
      const n = normalizeAndValidate(raw);
      if (n) valid.push({ id: m.id, nom: m.nom, prenoms: m.prenoms, number: n, categorie: m.categorie });
      else invalid.push({ id: m.id, nom: m.nom, prenoms: m.prenoms, raw });
    }
    return { valid, invalid };
  }, [selectedList]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((m) => m.id)));
  };

  const sendOne = (num: string) => {
    const n = normalizeAndValidate(num);
    if (!n) return toast.error("Numéro invalide");
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSend = () => {
    if (validation.valid.length === 0) {
      return toast.error("Aucun destinataire valide sélectionné");
    }
    if (validation.valid.length === 1) {
      // Cas 1 : envoi direct
      sendOne(validation.valid[0].number);
      return;
    }
    // Cas 2 : ouvrir la modale d'options
    setDialogOpen(true);
  };

  // OPTION 1 — Liste de diffusion : envoi séquentiel automatisé à tous les destinataires
  const optionBroadcastList = () => {
    if (validation.valid.length === 0) return;
    setBroadcastQueue(validation.valid);
    setBroadcastIndex(0);
    setBroadcastSent(new Set());
    setBroadcastSkipped(new Set());
    setDialogOpen(false);
    setBroadcastOpen(true);
    // Copie aussi les numéros au presse-papier pour créer la liste de diffusion officielle si souhaité
    const numbers = validation.valid.map((v) => "+" + v.number).join("\n");
    navigator.clipboard.writeText(numbers).catch(() => {});
  };

  const currentBroadcast: BroadcastItem | null = broadcastQueue[broadcastIndex] ?? null;

  const openCurrentBroadcast = () => {
    if (!currentBroadcast) return;
    window.open(
      `https://wa.me/${currentBroadcast.number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setBroadcastSent((s) => new Set(s).add(currentBroadcast.id));
  };

  const nextBroadcast = () => {
    if (broadcastIndex + 1 >= broadcastQueue.length) {
      toast.success(
        `Diffusion terminée : ${broadcastSent.size + 1} envoyé(s), ${broadcastSkipped.size} passé(s)`
      );
      setBroadcastOpen(false);
      return;
    }
    setBroadcastIndex((i) => i + 1);
  };

  const sendAndNext = () => {
    openCurrentBroadcast();
    // Laisse le temps à l'onglet WhatsApp de s'ouvrir avant de passer au suivant
    setTimeout(() => nextBroadcast(), 400);
  };

  const skipCurrent = () => {
    if (!currentBroadcast) return;
    setBroadcastSkipped((s) => new Set(s).add(currentBroadcast.id));
    if (broadcastIndex + 1 >= broadcastQueue.length) {
      toast.info(`Diffusion terminée : ${broadcastSent.size} envoyé(s), ${broadcastSkipped.size + 1} passé(s)`);
      setBroadcastOpen(false);
      return;
    }
    setBroadcastIndex((i) => i + 1);
  };

  const cancelBroadcast = () => {
    setBroadcastOpen(false);
    if (broadcastSent.size > 0) {
      toast.info(`Diffusion interrompue : ${broadcastSent.size} envoyé(s) sur ${broadcastQueue.length}`);
    }
  };

  // OPTION 2 — Groupe WhatsApp : ouvrir l'assistant de création
  const optionGroup = async () => {
    const numbers = validation.valid.map((v) => "+" + v.number).join("\n");
    try {
      await navigator.clipboard.writeText(numbers);
    } catch {
      // silencieux
    }
    toast.success("Numéros copiés. Créez le groupe et collez les contacts.");
    window.open("https://web.whatsapp.com/", "_blank");
    setDialogOpen(false);
  };

  // OPTION 3 — Export Excel
  const optionExcel = () => {
    const rows = [
      ...validation.valid.map((v) => ({
        Nom: v.nom,
        Prénoms: v.prenoms,
        Catégorie: categoryLabel(v.categorie),
        Numéro: "+" + v.number,
        Statut: "Valide",
      })),
      ...validation.invalid.map((v) => ({
        Nom: v.nom,
        Prénoms: v.prenoms,
        Catégorie: "",
        Numéro: v.raw ?? "",
        Statut: "Invalide",
      })),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Destinataires");
    // Ajouter le message dans une seconde feuille
    const wsMsg = XLSX.utils.aoa_to_sheet([["Message"], [message]]);
    XLSX.utils.book_append_sheet(wb, wsMsg, "Message");
    XLSX.writeFile(wb, `mca-whatsapp-destinataires-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export Excel généré");
    setDialogOpen(false);
  };

  // OPTION 4 — WhatsApp Cloud API (préparation future)
  const optionCloudApi = () => {
    toast.info(
      "WhatsApp Cloud API : intégration à venir. Contactez l'administrateur pour l'activation."
    );
    setDialogOpen(false);
  };

  const templates = [
    { label: "Annonce de culte", text: "Bonjour ! Nous vous attendons au culte ce dimanche à 9h00 au Temple Puissance et Gloire. Soyez bénis !" },
    { label: "Rappel aux absents", text: "Bonjour, votre présence nous a manqué. Que Dieu vous fortifie et nous espérons vous revoir bientôt. — MCA Treichville" },
    { label: "Annonce de réunion", text: "Bien-aimé(e), nous vous informons d'une réunion spéciale. Restez attentif aux prochaines communications. Soyez béni(e)." },
  ];

  const totalSel = selectedList.length;
  const validCount = validation.valid.length;
  const invalidCount = validation.invalid.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Envoyez des messages aux membres via WhatsApp — support des envois multiples
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 border-0 shadow-elegant lg:col-span-1">
          <Label className="mb-2 block text-sm font-semibold">Modèles rapides</Label>
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.label}
                onClick={() => setMessage(t.text)}
                className="w-full text-left rounded-lg border p-3 text-sm hover:bg-muted transition-colors"
              >
                <div className="font-medium text-primary">{t.label}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.text}</div>
              </button>
            ))}
          </div>

          <Label className="mt-6 mb-2 block text-sm font-semibold">Message</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
        </Card>

        <Card className="p-5 border-0 shadow-elegant lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3 justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">Destinataires</span>
              <Badge variant="secondary">{totalSel} sélectionné(s)</Badge>
              {totalSel > 0 && (
                <>
                  <Badge className="bg-success/15 text-success hover:bg-success/20 border-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} valide(s)
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {invalidCount} invalide(s)
                    </Badge>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={toggleAll}>Tout</Button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto space-y-1 mb-4">
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">Aucun membre avec numéro</div>
            )}
            {filtered.map((m) => {
              const raw = m.whatsapp || m.telephone || "";
              const isValid = !!normalizeAndValidate(raw);
              return (
                <label key={m.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted cursor-pointer">
                  <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {m.nom} {m.prenoms}
                      {!isValid && (
                        <span className="text-[10px] uppercase text-destructive font-semibold">Numéro invalide</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{categoryLabel(m.categorie)} · {raw}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!isValid}
                    onClick={(e) => { e.preventDefault(); sendOne(raw); }}
                  >
                    <MessageCircle className="h-4 w-4 text-success" />
                  </Button>
                </label>
              );
            })}
          </div>

          <Button
            onClick={handleSend}
            disabled={validCount === 0}
            className="w-full gradient-brand text-primary-foreground border-0 shadow-elegant"
          >
            <Send className="mr-2 h-4 w-4" />
            {validCount <= 1
              ? `Envoyer${validCount === 1 ? " (1 destinataire)" : ""}`
              : `Envoyer aux ${validCount} destinataires valides`}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            WhatsApp ne permet pas l'ouverture simultanée de plusieurs conversations. Pour un envoi de masse,
            utilisez les options ci-dessous.
          </p>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Envoi à {validCount} destinataires</DialogTitle>
            <DialogDescription>
              WhatsApp Web/mobile ne permet pas l'envoi automatique groupé depuis un lien.
              Choisissez la méthode adaptée :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <button
              onClick={optionBroadcastList}
              className="w-full flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <Megaphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Diffusion séquentielle automatisée</div>
                <div className="text-xs text-muted-foreground">
                  Envoie le message aux {validCount} destinataires un par un dans un flux guidé.
                  Les numéros sont aussi copiés au presse-papier pour créer la liste officielle si besoin.
                </div>
              </div>
              <Copy className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </button>

            <button
              onClick={optionGroup}
              className="w-full flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <UsersRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Créer un groupe WhatsApp</div>
                <div className="text-xs text-muted-foreground">
                  Copie les numéros et ouvre WhatsApp Web pour créer le groupe.
                </div>
              </div>
            </button>

            <button
              onClick={optionExcel}
              className="w-full flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Exporter vers Excel</div>
                <div className="text-xs text-muted-foreground">
                  Télécharge la liste (valides + invalides) et le message dans un fichier .xlsx.
                </div>
              </div>
            </button>

            <button
              onClick={optionCloudApi}
              className="w-full flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted transition-colors opacity-70"
            >
              <Cloud className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  Envoyer via WhatsApp Cloud API
                  <Badge variant="outline" className="text-[10px]">bientôt</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Envoi automatique de masse (catégories, absents, nouvelles âmes, planification).
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diffusion séquentielle : envoi guidé à tous les destinataires */}
      <Dialog open={broadcastOpen} onOpenChange={(o) => (o ? setBroadcastOpen(true) : cancelBroadcast())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Diffusion en cours</DialogTitle>
            <DialogDescription>
              Envoi séquentiel du même message à {broadcastQueue.length} destinataire(s).
              Chaque clic ouvre WhatsApp pour un contact, puis passe au suivant.
            </DialogDescription>
          </DialogHeader>

          {currentBroadcast && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>
                    Destinataire {broadcastIndex + 1} / {broadcastQueue.length}
                  </span>
                  <span>
                    {broadcastSent.size} envoyé(s) · {broadcastSkipped.size} passé(s)
                  </span>
                </div>
                <Progress
                  value={((broadcastIndex) / Math.max(1, broadcastQueue.length)) * 100}
                  className="h-2"
                />
              </div>

              <div className="rounded-lg border p-4 bg-muted/40">
                <div className="text-sm font-semibold">
                  {currentBroadcast.nom} {currentBroadcast.prenoms}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {categoryLabel(currentBroadcast.categorie)} · +{currentBroadcast.number}
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-background text-xs text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
                {message}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={skipCurrent}
                  className="w-full"
                >
                  <SkipForward className="mr-2 h-4 w-4" /> Passer
                </Button>
                <Button
                  onClick={sendAndNext}
                  className="w-full gradient-brand text-primary-foreground border-0 shadow-elegant"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Astuce : autorisez les pop-ups pour ce site afin que chaque contact s'ouvre correctement.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={cancelBroadcast}>
              <X className="mr-2 h-4 w-4" /> Interrompre la diffusion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
