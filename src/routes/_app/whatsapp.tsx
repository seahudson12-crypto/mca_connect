import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { CATEGORIES, categoryLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/whatsapp")({ component: WhatsAppPage });

function normalize(num: string) {
  return num.replace(/[^\d]/g, "").replace(/^0/, "225");
}

function WhatsAppPage() {
  const [filterCat, setFilterCat] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("Bonjour, vous êtes attendus au prochain culte. Que Dieu vous bénisse ! — MCA Treichville");

  const { data: membres = [] } = useQuery({
    queryKey: ["membres-wa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membres").select("id,nom,prenoms,categorie,whatsapp,telephone").eq("actif", true).order("nom");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return membres.filter((m) => (filterCat === "all" || m.categorie === filterCat) && (m.whatsapp || m.telephone));
  }, [membres, filterCat]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((m) => m.id)));
  };

  const sendOne = (num: string) => {
    const url = `https://wa.me/${normalize(num)}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const sendAll = () => {
    const targets = filtered.filter((m) => selected.has(m.id));
    if (targets.length === 0) return alert("Sélectionnez au moins un destinataire");
    targets.forEach((m, i) => {
      const num = m.whatsapp || m.telephone;
      if (!num) return;
      setTimeout(() => {
        window.open(`https://wa.me/${normalize(num)}?text=${encodeURIComponent(message)}`, "_blank");
      }, i * 600);
    });
  };

  const templates = [
    { label: "Annonce de culte", text: "Bonjour ! Nous vous attendons au culte ce dimanche à 9h00 au Temple Puissance et Gloire. Soyez bénis !" },
    { label: "Rappel aux absents", text: "Bonjour, votre présence nous a manqué. Que Dieu vous fortifie et nous espérons vous revoir bientôt. — MCA Treichville" },
    { label: "Annonce de réunion", text: "Bien-aimé(e), nous vous informons d'une réunion spéciale. Restez attentif aux prochaines communications. Soyez béni(e)." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Envoyez des messages aux membres via WhatsApp</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 border-0 shadow-elegant lg:col-span-1">
          <Label className="mb-2 block text-sm font-semibold">Modèles rapides</Label>
          <div className="space-y-2">
            {templates.map((t) => (
              <button key={t.label} onClick={() => setMessage(t.text)} className="w-full text-left rounded-lg border p-3 text-sm hover:bg-muted transition-colors">
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
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold">Destinataires</span>
              <Badge variant="secondary">{selected.size} sélectionné(s)</Badge>
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
            {filtered.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">Aucun membre avec numéro</div>}
            {filtered.map((m) => (
              <label key={m.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted cursor-pointer">
                <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.nom} {m.prenoms}</div>
                  <div className="text-xs text-muted-foreground">{categoryLabel(m.categorie)} · {m.whatsapp || m.telephone}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); sendOne(m.whatsapp || m.telephone || ""); }}>
                  <MessageCircle className="h-4 w-4 text-success" />
                </Button>
              </label>
            ))}
          </div>

          <Button onClick={sendAll} className="w-full gradient-brand text-primary-foreground border-0 shadow-elegant">
            <Send className="mr-2 h-4 w-4" /> Envoyer aux {selected.size} destinataires
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Chaque message ouvrira un onglet WhatsApp. Autorisez les pop-ups.
          </p>
        </Card>
      </div>
    </div>
  );
}
