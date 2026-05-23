"use client";

import * as React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

interface DataPoint {
  [key: string]: string | number;
}

interface BarChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  color?: string;
  gradientId?: string;
  showGrid?: boolean;
  height?: number;
  barRadius?: number;
  formatX?: (value: string) => string;
  formatY?: (value: number) => string;
  className?: string;
}

function CustomTooltip({ active, payload, label, formatY }: TooltipProps<number, string> & { formatY?: (v: number) => string }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-bgTertiary px-3 py-2 shadow-xl">
      <p className="text-xs text-textMuted mb-1">{label}</p>
      <p className="text-sm font-semibold text-textPrimary">
        {formatY ? formatY(payload[0].value ?? 0) : payload[0].value?.toLocaleString()}
      </p>
    </div>
  );
}

export function BarChart({
  data,
  xKey,
  yKey,
  color = "#7C3AED",
  gradientId = "barGradient",
  showGrid = true,
  height = 300,
  barRadius = 4,
  formatX,
  formatY,
  className,
}: BarChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={color} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B6B80", fontSize: 11 }}
            tickFormatter={formatX}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B6B80", fontSize: 11 }}
            tickFormatter={formatY}
            dx={-8}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip formatY={formatY} />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar
            dataKey={yKey}
            fill={`url(#${gradientId})`}
            radius={[barRadius, barRadius, 0, 0]}
            maxBarSize={48}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
