"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LiveCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  textClassName?: string;
}

export function LiveCounter({
  value,
  duration = 1500,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  textClassName,
}: LiveCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const prevValueRef = React.useRef(0);

  React.useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    const diff = endValue - startValue;

    if (diff === 0) {
      setDisplayValue(endValue);
      return;
    }

    const steps = 50;
    const stepDuration = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;
      setDisplayValue(current);

      if (step >= steps) {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        clearInterval(timer);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, duration]);

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString();

  return (
    <span className={cn("tabular-nums", className)}>
      <span className={textClassName}>
        {prefix}{formatted}{suffix}
      </span>
    </span>
  );
}
