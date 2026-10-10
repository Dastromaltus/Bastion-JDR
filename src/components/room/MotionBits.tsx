import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { motionDisabled, motionFeedback, playMotion } from "@/lib/motion";

export function AnimatedCount({ value }: { value: number }) {
  return <span className="inline-block overflow-hidden align-bottom"><span key={value} className="anim-count inline-block">{value}</span></span>;
}

/** Scale a full-width fill, preserving the exact health-bar appearance at rest. */
export function HealthFill({ hp, maxHp, className }: { hp: number; maxHp: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(hp);
  useEffect(() => {
    if (hp < previous.current && ref.current) playMotion(ref.current, "anim-damage");
    previous.current = hp;
  }, [hp]);
  return <div ref={ref} className={`anim-health h-full w-full ${className}`} style={{ transform: `scaleX(${Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0))})` }} />;
}

export function DiceResult({ result }: { result: { rolls: number[]; bonus: number; total: number; success: boolean } }) {
  const [settled, setSettled] = useState(motionDisabled);
  useEffect(() => {
    if (motionDisabled()) { setSettled(true); return; }
    setSettled(false);
    const timer = window.setTimeout(() => {
      setSettled(true);
      if (result.rolls.length > 0 && result.rolls.every((n) => n >= 5)) motionFeedback("critical");
    }, 560);
    return () => clearTimeout(timer);
  }, [result]);
  return <p className="mt-2 font-pixel" aria-live="polite" aria-busy={!settled}>
    {result.rolls.map((n, i) => <span key={i}>
      {i > 0 ? " + " : ""}<span className={`inline-block ${!settled ? "anim-die" : n >= 5 ? "anim-success" : "anim-failure"}`}>{n}</span>
    </span>)} +{result.bonus} = <b>{result.total}</b> → {result.success ? "RÉUSSITE" : "ÉCHEC"}
  </p>;
}

export function RollingDice({ rolling }: { rolling: boolean }) {
  return <Dices className={rolling ? "anim-die" : undefined} />;
}