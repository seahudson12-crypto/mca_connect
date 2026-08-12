// Enregistrement du service worker (protégé) + état d'installation PWA.
// Ne s'enregistre jamais en dev, dans une iframe, en aperçu Lovable, ou avec ?sw=off.

import { useEffect, useState, useCallback } from "react";
import {
  getDeferredPrompt,
  isAppInstalled,
  isIOS,
  isStandaloneDisplay,
  subscribeInstallPrompt,
  triggerInstall,
} from "@/lib/pwa-install";

function isPreviewHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

function shouldRegister() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const host = window.location.hostname;
  if (isPreviewHost(host)) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
}

async function unregisterMatching() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith("/sw.js");
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

export function usePwa() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsStandalone(isStandaloneDisplay());
    setIos(isIOS());
    setCanInstall(!!getDeferredPrompt());
    setInstalled(isAppInstalled());

    const unsub = subscribeInstallPrompt((e) => {
      setCanInstall(!!e);
      setInstalled(isAppInstalled());
    });

    if (!shouldRegister()) {
      void unregisterMatching();
      return unsub;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("SW registration failed", err));

    return unsub;
  }, []);

  const promptInstall = useCallback(async () => triggerInstall(), []);

  return { canInstall, installed, isStandalone, isIOS: ios, promptInstall };
}
