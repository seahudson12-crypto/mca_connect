import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { usePwa } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { IosInstallHint } from "@/components/IosInstallHint";

const SNOOZE_KEY = "mca-pwa-install-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function isSnoozed() {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(SNOOZE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < SNOOZE_MS;
}

export function InstallAppButton() {
  const { canInstall, installed, isStandalone, isIOS, promptInstall } = usePwa();
  const [snoozed, setSnoozed] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    setSnoozed(isSnoozed());
  }, []);

  if (installed || isStandalone) return null;
  if (snoozed) return null;
  if (!canInstall && !isIOS) return null;

  const later = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    setSnoozed(true);
  };

  const install = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome === "dismissed") later();
    } else {
      setShowIosHint(true);
    }
  };

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-80">
        <div className="rounded-xl border border-border bg-card/95 p-4 shadow-elegant backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Installer MCA Connect</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Installez MCA Connect sur votre téléphone pour y accéder rapidement comme une application.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={install}>
                  Installer
                </Button>
                <Button size="sm" variant="ghost" onClick={later}>
                  Plus tard
                </Button>
              </div>
              {isIOS && !canInstall && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Share className="h-3 w-3" /> Partager <Plus className="h-3 w-3" /> Sur l'écran d'accueil
                </p>
              )}
            </div>
            <button
              onClick={later}
              aria-label="Fermer"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <IosInstallHint open={showIosHint} onClose={() => setShowIosHint(false)} />
    </>
  );
}
