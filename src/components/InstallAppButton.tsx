import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { usePwa } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "mca-pwa-install-dismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallAppButton() {
  const { canInstall, installed, isStandalone, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (installed || isStandalone) return null;

  const ios = isIOS();
  if (!canInstall && !ios) return null;
  if (dismissed && !canInstall) return null;

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (ios) {
      setShowIosHint(true);
    }
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg">
        <Button
          onClick={handleClick}
          variant="ghost"
          className="h-auto gap-2 p-0 text-primary-foreground hover:bg-transparent hover:text-primary-foreground/90"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Installer MCA CONNECT</span>
        </Button>
        <button
          onClick={handleDismiss}
          aria-label="Ignorer"
          className="rounded-full p-1 hover:bg-primary-foreground/10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {showIosHint && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIosHint(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">Installer sur iPhone/iPad</h3>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Touchez le bouton <strong>Partager</strong> dans Safari.</li>
              <li>2. Choisissez <strong>« Sur l'écran d'accueil »</strong>.</li>
              <li>3. Confirmez avec <strong>Ajouter</strong>.</li>
            </ol>
            <Button className="mt-4 w-full" onClick={() => setShowIosHint(false)}>
              Compris
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
