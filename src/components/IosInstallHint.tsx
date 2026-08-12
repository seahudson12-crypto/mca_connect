import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IosInstallHint({
  open,
  onClose,
  title = "Installer sur iPhone/iPad",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. Appuyez sur le bouton <strong>Partager</strong> dans Safari.</li>
          <li>2. Choisissez <strong>« Ajouter à l'écran d'accueil »</strong>.</li>
          <li>3. Confirmez avec <strong>Ajouter</strong>.</li>
        </ol>
        <Button className="mt-4 w-full" onClick={onClose}>
          Compris
        </Button>
      </div>
    </div>
  );
}
