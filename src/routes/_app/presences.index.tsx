import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { culteTypeLabel } from "@/lib/constants";

import { useActiveTemple } from "@/hooks/use-active-temple";

export const Route = createFileRoute("/_app/presences/")({ component: PresencesIndex });

function PresencesIndex() {
  const { activeTempleId } = useActiveTemple();
  const { data: cultes = [], isLoading } = useQuery({
    queryKey: ["cultes-presences", activeTempleId],
    enabled: !!activeTempleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cultes")
        .select("*")
        .eq("temple_id", activeTempleId!)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Présences</h1>
        <p className="text-sm text-muted-foreground">Sélectionnez un culte pour pointer les présences</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading && <div className="text-muted-foreground">Chargement...</div>}
        {!isLoading && cultes.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground border-dashed col-span-full">
            Aucun culte. Créez d'abord un culte dans la page Cultes.
          </Card>
        )}
        {cultes.map((c) => (
          <Link key={c.id} to="/presences/$culteId" params={{ culteId: c.id }}>
            <Card className="p-4 border-0 shadow-elegant hover:shadow-gold transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-4">
                <div className="rounded-xl gradient-brand p-3 text-primary-foreground">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1">{culteTypeLabel(c.type_culte)}</Badge>
                  <div className="font-semibold">{format(new Date(c.date), "EEEE d MMMM yyyy", { locale: fr })}</div>
                  {c.theme_principal && <div className="text-xs text-muted-foreground truncate">{c.theme_principal}</div>}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
