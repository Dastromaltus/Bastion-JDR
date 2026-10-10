import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FEEDBACK_EVENT, MOTION_EVENT, motionDisabled, playMotion } from "@/lib/motion";

/** Decorate rendered, authorized content only; never inspect hidden game data. */
export function MotionEffects() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const apply = (reduced: boolean) => {
      document.documentElement.dataset["reducedMotion"] = String(reduced);
      if (reduced) document.getAnimations().forEach((a) => a.cancel());
    };
    const changed = (event: Event) => { revision++; apply((event as CustomEvent<boolean>).detail); };
    window.addEventListener(MOTION_EVENT, changed);
    const load = async (userId?: string) => {
      const before = ++revision;
      if (!userId) { apply(false); return; }
      const { data } = await supabase.from("user_settings").select("settings").eq("user_id", userId).maybeSingle();
      if (alive && before === revision) apply(!!(data?.settings as { reducedMotion?: boolean } | null)?.reducedMotion);
    };
    // Suppress initial motion while the saved accessibility preference is loading.
    apply(true);
    supabase.auth.getUser().then(({ data }) => { if (alive) void load(data.user?.id); });
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load(session?.user.id);
    });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (media.matches) document.getAnimations().forEach((a) => a.cancel()); };
    media.addEventListener("change", stop);
    const feedback = (event: Event) => {
      if (motionDisabled()) return;
      const kind = (event as CustomEvent<string>).detail;
      if (kind === "critical") {
        const main = document.querySelector<HTMLElement>("main");
        if (main) playMotion(main, "anim-shake");
      } else playMotion(document.body, "anim-alarm");
    };
    window.addEventListener(FEEDBACK_EVENT, feedback);
    const decorate = (root: Element) => {
      if (motionDisabled()) return;
      const lists = root.matches("ul,ol,.anim-list") ? [root] : [...root.querySelectorAll("ul,ol,.anim-list")];
      for (const list of lists) [...list.children].forEach((item, i) => {
        if (!(item instanceof HTMLElement) || item.dataset["motionSeen"]) return;
        item.dataset["motionSeen"] = "true";
        item.style.setProperty("--anim-delay", `${Math.min(i, 6) * 40}ms`);
        playMotion(item, item.closest('[data-motion-players]') ? "anim-join" : "anim-enter");
      });
    };
    decorate(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) for (const added of m.addedNodes) if (added instanceof Element) {
        if (added.matches("li") && added.parentElement) decorate(added.parentElement);
        else decorate(added);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      alive = false; observer.disconnect(); auth.subscription.unsubscribe();
      window.removeEventListener(MOTION_EVENT, changed); window.removeEventListener(FEEDBACK_EVENT, feedback);
      media.removeEventListener("change", stop);
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main");
      if (main) playMotion(main, "anim-page");
    });
    return () => cancelAnimationFrame(frame);
  }, [path]);
  return null;
}