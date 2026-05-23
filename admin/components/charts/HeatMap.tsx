"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface HeatMapProps {
  data: number[][];
  rowLabels?: string[];
  columnLabels?: string[];
  maxValue?: number;
  cellSize?: number;
  gap?: number;
  colorScale?: [string, string, string];
  showValues?: boolean;
  className?: string;
}

const defaultColorScale: [string, string, string] = [
  "#1A1A2E",
  "#7C3AED40",
  "#7C3AED",
];

function interpolateColor(
  value: number,
  min: number,
  max: number,
  scale: [string, string, string]
): string {
  if (max === min) return scale[0];

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

  let color1: string;
  let color2: string;
  let t: number;

  if (normalized < 0.5) {
    color1 = scale[0];
    color2 = scale[1];
    t = normalized * 2;
  } else {
    color1 = scale[1];
    color2 = scale[2];
    t = (normalized - 0.5) * 2;
  }

  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return rgbToHex(r, g, b);
}

export function HeatMap({
  data,
  rowLabels,
  columnLabels,
  maxValue,
  cellSize = 32,
  gap = 2,
  colorScale = defaultColorScale,
  showValues = false,
  className,
}: HeatMapProps) {
  const allValues = data.flat();
  const computedMax = maxValue ?? Math.max(...allValues, 1);
  const computedMin = Math.min(...allValues, 0);

  return (
    <div className={cn("overflow-x-auto", className)}>
      {/* Column labels */}
      {columnLabels && (
        <div
          className="flex gap-[2px] mb-1"
          style={{ paddingLeft: rowLabels ? `${cellSize + 8}px` : 0 }}
        >
          {columnLabels.map((label, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-[10px] text-textMuted"
              style={{ width: cellSize, minWidth: cellSize }}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex flex-col gap-[2px]">
        {data.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-[2px]">
            {/* Row label */}
            {rowLabels && (
              <div
                className="text-[10px] text-textMuted text-right pr-2 shrink-0"
                style={{ width: cellSize }}
              >
                {rowLabels[rowIndex]}
              </div>
            )}

            {/* Cells */}
            {row.map((value, colIndex) => {
              const bgColor = interpolateColor(
                value,
                computedMin,
                computedMax,
                colorScale
              );
              const textColor =
                value > computedMax * 0.6 ? "#FFFFFF" : "#B0B0C4";

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="flex items-center justify-center rounded-sm transition-colors cursor-default group relative"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    minWidth: cellSize,
                    backgroundColor: bgColor,
                  }}
                  title={`${value} (${rowLabels?.[rowIndex] ?? rowIndex}, ${columnLabels?.[colIndex] ?? colIndex})`}
                >
                  {showValues && (
                    <span
                      className="text-[9px] font-medium"
                      style={{ color: textColor }}
                    >
                      {value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-textMuted">Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: interpolateColor(
                  t * computedMax,
                  0,
                  computedMax,
                  colorScale
                ),
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-textMuted">More</span>
      </div>
    </div>
  );
}
