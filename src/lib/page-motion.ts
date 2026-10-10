import { motionDisabled, playMotion } from "@/lib/motion";

/** Observe only explicitly marked, already authorized DOM content. Never hide content while waiting. */
export function createPageEntrances() {
  const seen = new WeakSet<Element>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
      observer.unobserve(entry.target);
      playMotion(entry.target, "anim-enter");
    }
  }, { threshold: 0.08 });
  const scan = (root: Element) => {
    if (motionDisabled()) return;
    const selector = "[data-motion-enter], [data-motion-stagger] > *";
    const targets = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const target of targets) {
      if (!(target instanceof HTMLElement) || seen.has(target)) continue;
      seen.add(target);
      if (target.parentElement?.hasAttribute("data-motion-stagger")) {
        const index = [...target.parentElement.children].indexOf(target);
        target.style.setProperty("--anim-delay", `${Math.min(index, 6) * 40}ms`);
      }
      observer.observe(target);
    }
  };
  return { scan, disconnect: () => observer.disconnect() };
}