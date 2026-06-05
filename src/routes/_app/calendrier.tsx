import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarDays, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, MapPin, Globe2, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";

export const Route = createFileRoute("/_app/calendrier")({ component: CalendrierPage });

type EvtType = "culte" | "formation" | "reunion" | "priere" | "sortie" | "autre";

interface Evenement {
  id: string;
  temple_id: string | null;
  titre: string;
  description: string | null;
  type_evenement: EvtType;
  date_debut: string;
  date_fin: string | null;
  lieu: string | null;
  couleur: string;
  all_day: boolean;
}

const TYPE_LABEL: Record<EvtType, string> = {
  culte: "Culte",
  formation: "Formation",
  reunion: "Réunion",
  priere: "Prière",
  sortie: "Sortie",
  autre: "Autre",
};

const TYPE_COLOR: Record<EvtType, string> = {
  culte: "#1e40af",
  formation: "#0d9488",
  reunion: "#7c3aed",
  priere: "#dc2626",
  sortie: "#ea580c",
  autre: "#64748b",
};

function CalendrierPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { activeTempleId, activeTemple } = useActiveTemple();
  const qc = useQueryClient();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evenement | null>(null);
  const [scope, setScope] = useState<"all" | "temple" | "global">("all");

  // Plage : on charge le mois affiché ± 1 mois pour la liste à venir
  const rangeStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const rangeEnd = useMemo(() => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [cursor]);

  const { data: evenements = [] } = useQuery({
    queryKey: ["evenements", activeTempleId, rangeStart.toISOString(), rangeEnd.toISOString()],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evenements" as never)
        .select("*")
        .or(`temple_id.is.null,temple_id.eq.${activeTempleId}`)
        .gte("date_debut", rangeStart.toISOString())
        .lte("date_debut", rangeEnd.toISOString())
        .order("date_debut");
      if (error) throw error;
      return (data ?? []) as unknown as Evenement[];
    },
  });

  const filtered = useMemo(() => {
    if (scope === "all") return evenements;
    if (scope === "global") return evenements.filter((e) => e.temple_id === null);
    return evenements.filter((e) => e.temple_id !== null);
  }, [evenements, scope]);

  const saveEvt = useMutation({
    mutationFn: async (v: Partial<Evenement> & { is_global?: boolean }) => {
      const payload = { ...v };
      delete (payload as Record<string, unknown>).is_global;
      if (v.is_global) {
        payload.temple_id = null;
      } else if (!editing) {
        payload.temple_id = activeTempleId;
      }
      if (editing) {
        const { error } = await supabase
          .from("evenements" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("evenements" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evenements"] });
      toast.success(editing ? "Événement mis à jour" : "Événement créé");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evenements" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evenements"] });
      toast.success("Événement supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Construction calendrier (grille mois)
  const cells = useMemo(() => {
    const first = new Date(cursor);
    const startWeekday = (first.getDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() - (startWeekday - i));
      arr.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
    }
    while (arr.length % 7 !== 0) {
      const last = arr[arr.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      arr.push({ date: d, inMonth: false });
    }
    return arr;
  }, [cursor]);

  const evtsByDay = useMemo(() => {
    const m = new Map<string, Evenement[]>();
    for (const e of filtered) {
      const k = new Date(e.date_debut).toDateString();
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    }
    return m;
  }, [filtered]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return filtered
      .filter((e) => new Date(e.date_debut) >= now)
      .slice(0, 20);
  }, [filtered]);

  const monthLabel = cursor.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" /> Calendrier MCA
          </h1>
          <p className="text-sm text-muted-foreground">
            Cultes, formations, réunions et événements globaux MCA — pour {activeTemple?.nom_temple ?? "votre temple"}.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvel événement
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center text-lg font-semibold capitalize">
              {monthLabel}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            >
              Aujourd'hui
            </Button>
          </div>
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="global">
                <Globe2 className="mr-1 h-3 w-3" /> Global MCA
              </TabsTrigger>
              <TabsTrigger value="temple">
                <Building2 className="mr-1 h-3 w-3" /> Temple
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Vue calendrier</TabsTrigger>
          <TabsTrigger value="list">Vue liste</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold uppercase">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="p-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c, i) => {
                const evs = evtsByDay.get(c.date.toDateString()) ?? [];
                const isToday = c.date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={`min-h-[88px] border-b border-r border-border p-1.5 text-xs ${
                      c.inMonth ? "" : "bg-muted/20 text-muted-foreground"
                    } ${isToday ? "bg-primary/5" : ""}`}
                  >
                    <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-primary" : ""}`}>
                      {c.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {evs.slice(0, 3).map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setEditing(e);
                            setDialogOpen(true);
                          }}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                          style={{ backgroundColor: e.couleur || TYPE_COLOR[e.type_evenement] }}
                          title={e.titre}
                        >
                          {e.titre}
                        </button>
                      ))}
                      {evs.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{evs.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Prochains événements ({upcoming.length})</h3>
            {upcoming.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucun événement à venir.
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => {
                  const d = new Date(e.date_debut);
                  return (
                    <div
                      key={e.id}
                      className="flex items-start justify-between gap-3 rounded border border-border p-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: e.couleur || TYPE_COLOR[e.type_evenement] }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{e.titre}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                            {!e.all_day && ` à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{TYPE_LABEL[e.type_evenement]}</Badge>
                            {e.temple_id === null ? (
                              <Badge className="bg-gold text-foreground">
                                <Globe2 className="mr-1 h-3 w-3" /> Global MCA
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Temple</Badge>
                            )}
                            {e.lieu && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {e.lieu}
                              </span>
                            )}
                          </div>
                          {e.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                          )}
                        </div>
                      </div>
                      {isAdmin && (e.temple_id !== null || isSuperAdmin) && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(e);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Supprimer "${e.titre}" ?`)) deleteEvt.mutate(e.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? "Vous pouvez créer un événement Global MCA ou local au temple."
                : "L'événement sera rattaché à votre temple."}
            </DialogDescription>
          </DialogHeader>
          <EvtForm
            initial={editing}
            canGlobal={isSuperAdmin}
            onSubmit={(v) => saveEvt.mutate(v)}
            submitting={saveEvt.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EvtForm({
  initial,
  canGlobal,
  onSubmit,
  submitting,
}: {
  initial: Evenement | null;
  canGlobal: boolean;
  onSubmit: (v: Partial<Evenement> & { is_global?: boolean }) => void;
  submitting: boolean;
}) {
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<EvtType>(initial?.type_evenement ?? "autre");
  const [debut, setDebut] = useState(toLocalInput(initial?.date_debut ?? new Date().toISOString()));
  const [fin, setFin] = useState(toLocalInput(initial?.date_fin ?? null));
  const [lieu, setLieu] = useState(initial?.lieu ?? "");
  const [couleur, setCouleur] = useState(initial?.couleur ?? TYPE_COLOR[type]);
  const [allDay, setAllDay] = useState(initial?.all_day ?? false);
  const [isGlobal, setIsGlobal] = useState(initial?.temple_id === null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titre.trim() || !debut) return;
        onSubmit({
          titre: titre.trim(),
          description: description.trim() || null,
          type_evenement: type,
          date_debut: new Date(debut).toISOString(),
          date_fin: fin ? new Date(fin).toISOString() : null,
          lieu: lieu.trim() || null,
          couleur,
          all_day: allDay,
          is_global: isGlobal,
        });
      }}
    >
      <div>
        <Label>Titre *</Label>
        <Input value={titre} onChange={(e) => setTitre(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v as EvtType);
              setCouleur(TYPE_COLOR[v as EvtType]);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABEL) as EvtType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Couleur</Label>
          <Input
            type="color"
            value={couleur}
            onChange={(e) => setCouleur(e.target.value)}
            className="h-10"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Début *</Label>
          <Input
            type="datetime-local"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Fin (optionnel)</Label>
          <Input
            type="datetime-local"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={allDay} onCheckedChange={setAllDay} id="allday" />
        <Label htmlFor="allday" className="cursor-pointer">Journée entière</Label>
      </div>
      <div>
        <Label>Lieu</Label>
        <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {canGlobal && (
        <div className="flex items-center gap-3 rounded border border-border bg-muted/40 p-3">
          <Switch checked={isGlobal} onCheckedChange={setIsGlobal} id="global" />
          <Label htmlFor="global" className="cursor-pointer">
            <Globe2 className="mr-1 inline h-3 w-3" /> Événement Global MCA (visible par tous les temples)
          </Label>
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
