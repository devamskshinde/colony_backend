"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { TierSelector } from "./TierSelector";
import { Info } from "lucide-react";

interface ConfigToggleProps {
  feature: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  showTierSelector?: boolean;
  tier?: "free" | "premium" | "disabled";
  onTierChange?: (tier: "free" | "premium" | "disabled") => void;
  lastModified?: string;
  modifiedBy?: string;
  loading?: boolean;
  className?: string;
}

export function ConfigToggle({
  feature,
  description,
  enabled,
  onToggle,
  showTierSelector = false,
  tier,
  onTierChange,
  lastModified,
  modifiedBy,
  loading = false,
  className,
}: ConfigToggleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-white/5 bg-bgSecondary p-4 transition-all hover:border-white/10",
        loading && "opacity-60 pointer-events-none",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-textPrimary">
              {feature}
            </h4>
            {description && (
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-textMuted cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-md bg-bgTertiary border border-white/10 px-3 py-2 text-xs text-textSecondary shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  {description}
                </div>
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-textMuted mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={loading}
        />
      </div>

      {showTierSelector && tier && onTierChange && (
        <TierSelector value={tier} onChange={onTierChange} disabled={!enabled} />
      )}

      {(lastModified || modifiedBy) && (
        <div className="flex items-center gap-2 text-[11px] text-textMuted">
          {modifiedBy && <span>by {modifiedBy}</span>}
          {lastModified && modifiedBy && <span>-</span>}
          {lastModified && (
            <span>
              {new Date(lastModified).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
