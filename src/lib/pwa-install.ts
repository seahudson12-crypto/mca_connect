// Capture de l'événement `beforeinstallprompt` au plus tôt (au chargement du module),
// avant même que React ne soit monté : Chrome ne déclenche cet événement qu'une seule fois.
// Sans cette capture précoce, l'invitation d'installation n'apparaissait jamais.

export type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = (e: BIPEvent | null) => void;

let deferredPrompt: BIPEvent | null = null;
let appInstalled = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(deferredPrompt));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    appInstalled = true;
    deferredPrompt = null;
    emit();
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function isAppInstalled() {
  return appInstalled;
}

export function subscribeInstallPrompt(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerInstall() {
  if (!deferredPrompt) return "unavailable" as const;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return choice.outcome;
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1)
  );
}
