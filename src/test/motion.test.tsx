import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DiceResult, HealthFill } from "@/components/room/MotionBits";
import { FEEDBACK_EVENT, motionDisabled, motionFeedback } from "@/lib/motion";

afterEach(() => { cleanup(); delete document.documentElement.dataset["reducedMotion"]; vi.restoreAllMocks(); });
describe("accessible additive motion", () => {
  it("honors the document preference including outside portal panels", () => {
    document.documentElement.dataset["reducedMotion"] = "true";
    expect(motionDisabled()).toBe(true);
    const listener = vi.fn();
    window.addEventListener(FEEDBACK_EVENT, listener);
    motionFeedback("critical");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(FEEDBACK_EVENT, listener);
  });
  it("honors the operating system preference", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(motionDisabled()).toBe(true);
  });
  it("keeps health dimensions stable using only a scaled fill", () => {
    const { container, rerender } = render(<HealthFill hp={10} maxHp={20} className="bg-primary" />);
    expect(container.firstChild).toHaveStyle({ transform: "scaleX(0.5)" });
    rerender(<HealthFill hp={4} maxHp={20} className="bg-primary" />);
    expect(container.firstChild).toHaveStyle({ transform: "scaleX(0.2)" });
    expect((container.firstChild as HTMLElement).style.width).toBe("");
  });
  it("renders exactly the server dice and settles immediately with reduced motion", () => {
    document.documentElement.dataset["reducedMotion"] = "true";
    const { container } = render(<DiceResult result={{ rolls: [5, 2], bonus: 3, total: 10, success: true }} />);
    expect(container.textContent).toBe("5 + 2 +3 = 10 → RÉUSSITE");
    expect(container.querySelector("[aria-busy=false]")).toBeTruthy();
    expect(container.querySelector(".anim-die")).toBeNull();
  });
});