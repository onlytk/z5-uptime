import { useEffect, useState, useSyncExternalStore } from "react";
import { parseHistory, type History } from "./history";

const REFRESH_MS = 120_000;
const TIMEOUT_MS = 15_000;

/** history.json, refetched every two minutes. `failed` is only true while the last attempt failed. */
export function useHistory() {
  const [history, setHistory] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]);
        const res = await fetch(`history.json?${Math.floor(Date.now() / 60_000)}`, { cache: "no-store", signal });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setHistory(parseHistory(await res.json()));
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
      if (!controller.signal.aborted) timer = setTimeout(load, REFRESH_MS);
    };
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return { history, failed };
}

export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);
  return scrolled;
}
