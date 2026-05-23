"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TextControlProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "email" | "password";
  maxLength?: number;
  loading?: boolean;
  className?: string;
}

export function TextControl({
  label,
  description,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  loading = false,
  className,
}: TextControlProps) {
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

      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={loading}
          className="h-10 w-full rounded-md border border-white/10 bg-[#1A1A2E] px-3 text-sm text-textPrimary placeholder:text-textMuted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colonyPurple focus-visible:ring-offset-1 focus-visible:ring-offset-bgPrimary"
        />
        {maxLength !== undefined && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-textMuted">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
