import { useEffect, useRef, useState } from "react";
import { BUILD_ID } from "./buildId";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const TRIED_KEY = "reset_update_tried";

async function liveBuildId(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const { id } = await r.json();
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/**
 * Phones keep old copies of web apps (home-screen apps especially).
 * This checks for a newer deploy on open, on return to the app and every 5 min.
 * When the user is on a calm screen it reloads silently; otherwise it returns
 * true so the app can show a one-tap "Update" banner.
 */
export function useAutoUpdate(isSafeToReload: () => boolean): boolean {
  const [updateReady, setUpdateReady] = useState(false);
  const safeRef = useRef(isSafeToReload);
  safeRef.current = isSafeToReload;

  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let stopped = false;
    async function check() {
      const live = await liveBuildId();
      if (stopped || !live || live === BUILD_ID) return;
      // Reload at most once per new version: if the phone still serves the
      // old copy after that, show the banner instead of looping.
      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(TRIED_KEY) === live;
      } catch {}
      if (safeRef.current() && !alreadyTried) {
        try {
          sessionStorage.setItem(TRIED_KEY, live);
        } catch {}
        window.location.reload();
      } else {
        setUpdateReady(true);
      }
    }
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return updateReady;
}
