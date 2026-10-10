import { useEffect, useState } from "react";
import { motionDisabled } from "@/lib/motion";

/** Keep authorized outgoing inventory cells just long enough for a short exit. */
export function useMotionItems<T extends { id: string }>(items: T[]) {
  const [shown, setShown] = useState<{ item: T; leaving: boolean }[]>(() => items.map((item) => ({ item, leaving: false })));
  const signature = JSON.stringify(items);
  useEffect(() => {
    setShown((old) => [
      ...items.map((item) => ({ item, leaving: false })),
      ...(motionDisabled() ? [] : old.filter(({ item }) => !items.some((i) => i.id === item.id)).map(({ item }) => ({ item, leaving: true }))),
    ]);
    const timer = window.setTimeout(() => setShown((old) => old.filter((entry) => !entry.leaving)), 150);
    return () => clearTimeout(timer);
  }, [signature]);
  return shown;
}