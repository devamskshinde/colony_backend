"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface NumberControlProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showSlider?: boolean;
  unit?: string;
  loading?: boolean;
  className?: string;
}

export function NumberControl({
  label,
  description,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  showSlider = false,
  unit,
  loading = false,
  className,
}: NumberControlProps) {
  const handleDecrement = () => {
    const next = value - step;
    onChange(Math.max(min, next));
  };

  const handleIncrement = () => {
    const next = value + step;
    onChange(max !== undefined ? Math.min(max, next) : next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    if (!isNaN(raw)) {
      let clamped = raw;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onChange(clamped);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-bgSecondary p-4 space-y-3",
        loading && "opacity-60 pointer-events-none",
        className
      )}
    >
      <div>
        <h4 className="text-sm font-semibold text-textPrimary">{label}</h4>
        {description && (
          <p className="text-xs text-textMuted mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={value <= min || loading}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-bgTertiary text-textSecondary hover:bg-white/5 hover:text-textPrimary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            disabled={loading}
            className="h-9 w-full rounded-md border border-white/10 bg-[#1A1A2E] px-3 text-center text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-colonyPurple focus:ring-offset-1 focus:ring-offset-bgPrimary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-textMuted">
              {unit}
            </span>
          )}
        </div>

        <button
          onClick={handleIncrement}
          disabled={(max !== undefined && value >= max) || loading}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-bgTertiary text-textSecondary hover:bg-white/5 hover:text-textPrimary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {showSlider && max !== undefined && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          disabled={loading}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-colonyPurple [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-colonyPurple [&::-webkit-slider-thumb]:shadow-md"
        />
      )}

      {max !== undefined && (
        <div className="flex justify-between text-[10px] text-textMuted">
          <span>Min: {min}</span>
          <span>Max: {max}</span>
        </div>
      )}
    </div>
  );
}
