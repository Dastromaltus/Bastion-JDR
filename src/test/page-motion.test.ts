import { afterEach, describe, expect, it, vi } from "vitest";
import { createPageEntrances } from "@/lib/page-motion";

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset["reducedMotion"];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  let intersect: IntersectionObserverCallback = () => {};
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  });
  return { observe, unobserve, disconnect, intersect: (target: Element) => intersect([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver) };
}

describe("site-wide page entrances", () => {
  it("covers page landmarks and titles without requiring page-by-page markers", () => {
    const fake = setup();
    document.body.innerHTML = '<main><header>Navigation</header><h1>Salons</h1><section>A</section><section>B</section></main><aside>Unrelated</aside>';
    const entrances = createPageEntrances();
    entrances.scan(document.body);
    expect(fake.observe).toHaveBeenCalledTimes(4);
    expect(document.querySelectorAll("section")[1]?.style.getPropertyValue("--anim-delay")).toBe("40ms");
    entrances.disconnect();
  });
  it("observes only marked rendered content once with a bounded cascade", () => {
    const fake = setup();
    document.body.innerHTML = '<div data-motion-stagger><article>A</article><article>B</article></div><div>Unmarked</div>';
    const entrances = createPageEntrances();
    entrances.scan(document.body);
    entrances.scan(document.body);
    expect(fake.observe).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll("article")[1]?.style.getPropertyValue("--anim-delay")).toBe("40ms");
    entrances.disconnect();
    expect(fake.disconnect).toHaveBeenCalledOnce();
  });
  it("animates when in view and never changes resting visibility", () => {
    const fake = setup();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    document.body.innerHTML = '<section data-motion-enter>Visible content</section>';
    const target = document.querySelector("section");
    if (!target) throw new Error("Missing fixture");
    const entrances = createPageEntrances();
    entrances.scan(document.body);
    expect(target.style.opacity).toBe("");
    fake.intersect(target);
    expect(target.classList.contains("anim-enter")).toBe(true);
    expect(fake.unobserve).toHaveBeenCalledWith(target);
    target.dispatchEvent(new Event("animationend"));
    expect(target.classList.contains("anim-enter")).toBe(false);
    entrances.disconnect();
  });
  it("skips observers and queued entrances when reduced motion is enabled", () => {
    const fake = setup();
    document.body.innerHTML = '<section data-motion-enter>Content</section>';
    document.documentElement.dataset["reducedMotion"] = "true";
    const entrances = createPageEntrances();
    entrances.scan(document.body);
    expect(fake.observe).not.toHaveBeenCalled();
    const target = document.querySelector("section");
    if (!target) throw new Error("Missing fixture");
    fake.intersect(target);
    expect(target.classList.contains("anim-enter")).toBe(false);
    entrances.disconnect();
  });
});