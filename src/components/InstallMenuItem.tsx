import { useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { usePwa } from "@/hooks/use-pwa";
import { IosInstallHint } from "@/components/IosInstallHint";

export function InstallMenuItem({ className, onDone }: { className?: string; onDone?: () => void }) {
  const { canInstall, installed, isStandalone, promptInstall } = usePwa();
  const [showHint, setShowHint] = useState(false);

  if (installed || isStandalone) {
    return (
      <div className={`${className ?? ""} opacity-70`}>
        <CheckCircle2 className="h-4 w-4" />
        Application installée
      </div>
    );
  }

  const handle = async () => {
    if (canInstall) {
      await promptInstall();
      onDone?.();
    } else {
      setShowHint(true);
    }
  };

  return (
    <>
      <button type="button" onClick={handle} className={`${className ?? ""} w-full text-left`}>
        <Download className="h-4 w-4" />
        Installer MCA Connect
      </button>
      <IosInstallHint
        open={showHint}
        onClose={() => {
          setShowHint(false);
          onDone?.();
        }}
        title="Installer MCA Connect"
      />
    </>
  );
}
