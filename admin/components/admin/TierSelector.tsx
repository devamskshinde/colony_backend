"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Crown, Users, Ban } from "lucide-react";

interface TierSelectorProps {
  value: "free" | "premium" | "disabled";
  onChange: (tier: "free" | "premium" | "disabled") => void;
  disabled?: boolean;
  className?: string;
}

const tiers = [
  {
    value: "free" as const,
    label: "Free",
    description: "Available to all users",
    icon: Users,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    value: "premium" as const,
    label: "Premium Only",
    description: "Premium subscribers only",
    icon: Crown,
    color: "text-colonyPurple",
    bg: "bg-colonyPurple/10",
    border: "border-colonyPurple/30",
  },
  {
    value: "disabled" as const,
    label: "Disabled",
    description: "Feature is off",
    icon: Ban,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
];

export function TierSelector({
  value,
  onChange,
  disabled = false,
  className,
}: TierSelectorProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {tiers.map((tier) => {
        const Icon = tier.icon;
        const isSelected = value === tier.value;

        return (
          <button
            key={tier.value}
            onClick={() => onChange(tier.value)}
            disabled={disabled}
            className={cn(
              "flex-1 flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all text-center",
              isSelected
                ? `${tier.bg} ${tier.border} ${tier.color}`
                : "border-white/5 bg-bgPrimary text-textMuted hover:border-white/10 hover:text-textSecondary",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{tier.label}</span>
          </button>
        );
      })}
    </div>
  );
}
