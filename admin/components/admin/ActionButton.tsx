"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ActionButtonProps {
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "destructive" | "warning" | "outline" | "ghost";
  onClick?: () => void | Promise<void>;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  default: "bg-colonyPurple text-white hover:bg-colonyPurple/90",
  destructive: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20",
  outline: "border border-white/10 bg-transparent text-textPrimary hover:bg-white/5",
  ghost: "text-textSecondary hover:bg-white/5 hover:text-textPrimary",
};

const sizeStyles = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
};

export function ActionButton({
  label,
  icon: Icon,
  variant = "default",
  onClick,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  loading = false,
  disabled = false,
  size = "md",
  className,
}: ActionButtonProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const needsConfirmation = !!confirmTitle;

  const handleClick = async () => {
    if (needsConfirmation) {
      setShowConfirm(true);
      return;
    }
    await executeAction();
  };

  const executeAction = async () => {
    if (!onClick) return;
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  const isBusy = loading || isLoading;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || isBusy}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colonyPurple focus-visible:ring-offset-2 focus-visible:ring-offset-bgPrimary disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : Icon ? (
          <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : null}
        <span>{label}</span>
      </button>

      {needsConfirmation && (
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmTitle}</DialogTitle>
              {confirmDescription && (
                <DialogDescription>{confirmDescription}</DialogDescription>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                variant={variant === "destructive" ? "destructive" : "default"}
                onClick={executeAction}
                loading={isBusy}
              >
                {confirmLabel || "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
