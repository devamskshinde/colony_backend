"use client";

import * as React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
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

interface LineChartProps {
  data: DataPoint[];
  xKey: string;
  yKey: string;
  color?: string;
  showGrid?: boolean;
  showDots?: boolean;
  height?: number;
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

export function LineChart({
  data,
  xKey,
  yKey,
  color = "#7C3AED",
  showGrid = true,
  showDots = true,
  height = 300,
  formatX,
  formatY,
  className,
}: LineChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
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
            cursor={{ stroke: "rgba(124,58,237,0.2)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            dot={showDots ? { fill: color, strokeWidth: 0, r: 3 } : false}
            activeDot={{
              fill: color,
              stroke: "#0A0A0F",
              strokeWidth: 2,
              r: 5,
            }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
