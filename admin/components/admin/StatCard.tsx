"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  previousValue?: number;
  icon: LucideIcon;
  iconColor?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  sparkline?: number[];
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  previousValue,
  icon: Icon,
  iconColor = "text-colonyPurple",
  prefix = "",
  suffix = "",
  decimals = 0,
  sparkline,
  loading = false,
  className,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = React.useState(0);

  const change =
    previousValue !== undefined && previousValue !== 0
      ? ((value - previousValue) / previousValue) * 100
      : undefined;

  const isPositive = change !== undefined && change >= 0;

  // Animated counter
  React.useEffect(() => {
    if (loading) return;

    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, value);
      setDisplayValue(current);

      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, loading]);

  // Mini sparkline
  const renderSparkline = () => {
    if (!sparkline || sparkline.length < 2) return null;

    const max = Math.max(...sparkline);
    const min = Math.min(...sparkline);
    const range = max - min || 1;
    const width = 80;
    const height = 28;
    const padding = 2;

    const points = sparkline
      .map((v, i) => {
        const x = padding + (i / (sparkline.length - 1)) * (width - padding * 2);
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg
        width={width}
        height={height}
        className="shrink-0 opacity-60"
        viewBox={`0 0 ${width} ${height}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isPositive ? "text-emerald-400" : change !== undefined ? "text-red-400" : "text-colonyPurple"}
        />
      </svg>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-bgSecondary p-5 transition-all hover:border-colonyPurple/20",
        loading && "animate-pulse",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg bg-colonyPurple/10",
                iconColor
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-medium text-textMuted uppercase tracking-wider">
              {label}
            </span>
          </div>

          <div>
            {loading ? (
              <div className="h-8 w-24 rounded bg-white/5" />
            ) : (
              <p className="text-2xl font-bold text-textPrimary tracking-tight">
                {prefix}
                {decimals > 0
                  ? displayValue.toFixed(decimals)
                  : Math.round(displayValue).toLocaleString()}
                {suffix}
              </p>
            )}

            {change !== undefined && !loading && (
              <div className="flex items-center gap-1 mt-1">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
                <span className="text-xs text-textMuted">vs yesterday</span>
              </div>
            )}
          </div>
        </div>

        {renderSparkline()}
      </div>
    </div>
  );
}
