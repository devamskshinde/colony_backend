"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Copy } from "lucide-react";

interface JsonEditorProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onValidate?: (isValid: boolean, parsed: unknown) => void;
  loading?: boolean;
  className?: string;
}

export function JsonEditor({
  label,
  description,
  value,
  onChange,
  onValidate,
  loading = false,
  className,
}: JsonEditorProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState<boolean | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(value);
      setError(null);
      setIsValid(true);
      onValidate?.(true, parsed);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON";
      setError(message);
      setIsValid(false);
      onValidate?.(false, null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
      setError(null);
      setIsValid(true);
    } catch {
      // Ignore if invalid
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-bgSecondary p-4 space-y-3",
        loading && "opacity-60 pointer-events-none",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-textPrimary">{label}</h4>
          {description && (
            <p className="text-xs text-textMuted mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded-md p-1.5 text-textMuted hover:bg-white/5 hover:text-textSecondary transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleFormat}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-textMuted hover:bg-white/5 hover:text-textSecondary transition-colors"
          >
            Format
          </button>
          <button
            onClick={handleValidate}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              isValid === true
                ? "text-emerald-400 bg-emerald-500/10"
                : isValid === false
                  ? "text-red-400 bg-red-500/10"
                  : "text-textMuted hover:bg-white/5 hover:text-textSecondary"
            )}
          >
            Validate
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsValid(null);
            setError(null);
          }}
          spellCheck={false}
          disabled={loading}
          className={cn(
            "flex min-h-[160px] w-full rounded-md border bg-[#1A1A2E] px-3 py-2 font-mono text-xs text-textPrimary placeholder:text-textMuted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bgPrimary resize-y",
            error
              ? "border-red-500/50 focus-visible:ring-red-500"
              : isValid
                ? "border-emerald-500/30 focus-visible:ring-emerald-500"
                : "border-white/10 focus-visible:ring-colonyPurple"
          )}
          placeholder='{"key": "value"}'
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400 break-all">{error}</p>
        </div>
      )}

      {isValid && !error && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <Check className="h-4 w-4 text-emerald-400" />
          <p className="text-xs text-emerald-400">Valid JSON</p>
        </div>
      )}
    </div>
  );
}
