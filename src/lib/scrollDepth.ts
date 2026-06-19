import { track } from "./track";

/**
 * Dispara `scroll_depth` en los hitos 25/50/75/100%, una sola vez por carga.
 * Ignora páginas sin scroll real (scrollHeight <= viewport). Segmentable por
 * `campaign` (prop global) → útil para medir consumo de contenido en pascoa/PC.
 */
export function initScrollDepth(): void {
  if (typeof window === "undefined") return;

  const milestones = [25, 50, 75, 100];
  const fired = new Set<number>();
  let ticking = false;

  const check = () => {
    ticking = false;
    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return; // sin scroll real → nada que medir
    const percent = (window.scrollY / scrollable) * 100;
    for (const m of milestones) {
      if (percent >= m && !fired.has(m)) {
        fired.add(m);
        track("scroll_depth", { percent: m });
      }
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(check);
      }
    },
    { passive: true },
  );
}
