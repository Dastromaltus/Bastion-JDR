export const MOTION_EVENT = "bastion-motion-change";
export const FEEDBACK_EVENT = "bastion-motion-feedback";

export function motionDisabled() {
  return typeof document === "undefined" || document.documentElement.dataset["reducedMotion"] === "true" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!document.querySelector(".room-reduced-motion");
}

export function motionFeedback(kind: "critical" | "alarm") {
  if (!motionDisabled()) window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail: kind }));
}

export function playMotion(node: HTMLElement, name: string) {
  if (motionDisabled()) return;
  node.classList.remove(name);
  requestAnimationFrame(() => {
    if (!node.isConnected || motionDisabled()) return;
    node.classList.add(name);
    node.addEventListener("animationend", () => node.classList.remove(name), { once: true });
  });
}