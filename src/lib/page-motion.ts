import { motionDisabled, playMotion } from "@/lib/motion";

/** Observe rendered page landmarks and explicit markers, never hidden game data. */
export function createPageEntrances() {
  const seen = new WeakSet<Element>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
      observer.unobserve(entry.target);
      playMotion(entry.target, entry.target.matches("h1,h2") ? "anim-title" : "anim-enter");
    }
  }, { threshold: 0.08 });
  const scan = (root: Element) => {
    if (motionDisabled()) return;
    const selector = "[data-motion-enter], [data-motion-stagger] > *, main > header, main > section, main h1, main section > h2";
    const targets = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const target of targets) {
      if (!(target instanceof HTMLElement) || seen.has(target)) continue;
      seen.add(target);
      if (target.parentElement?.hasAttribute("data-motion-stagger")) {
        const index = [...target.parentElement.children].indexOf(target);
        target.style.setProperty("--anim-delay", `${Math.min(index, 6) * 40}ms`);
      } else if (target.matches("main > section")) {
        const index = [...(target.parentElement?.children ?? [])].filter((child) => child.tagName === "SECTION").indexOf(target);
        target.style.setProperty("--anim-delay", `${Math.min(index, 4) * 40}ms`);
      }
      observer.observe(target);
    }
  };
  return { scan, disconnect: () => observer.disconnect() };
}