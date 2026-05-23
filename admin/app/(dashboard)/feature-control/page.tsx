"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Zap, Eye, RotateCcw, Loader2, Save, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ConfigItem } from "@/lib/types";

const CATEGORIES = [
  { id: "authentication", name: "Authentication", icon: "🔐", description: "OTP, login, registration controls" },
  { id: "profile", name: "Profile System", icon: "👤", description: "Profile settings and limits" },
  { id: "discovery", name: "Discovery & Radar", icon: "📡", description: "Proximity, filters, algorithm weights" },
  { id: "waves", name: "Wave System", icon: "👋", description: "Wave limits, super wave, anonymous" },
  { id: "stories", name: "Stories", icon: "📖", description: "Duration, features, visibility" },
  { id: "chat", name: "Chat", icon: "💬", description: "Messaging controls and limits" },
  { id: "calls", name: "Voice & Video", icon: "📞", description: "Call quality, duration limits" },
  { id: "dating", name: "Dating Features", icon: "💕", description: "Matching, swipes, dating mode" },
  { id: "community", name: "Community", icon: "🏘️", description: "Posts, reels, polls, events" },
  { id: "notifications", name: "Notifications", icon: "🔔", description: "Push, in-app, email settings" },
  { id: "monetization", name: "Monetization", icon: "💰", description: "Pricing, coins, ads" },
  { id: "safety", name: "Safety", icon: "🛡️", description: "Blocking, reporting, ghost mode" },
  { id: "ui", name: "UI Controls", icon: "🎨", description: "Tabs, theme, animations" },
  { id: "system", name: "System", icon: "⚙️", description: "Maintenance, force update" },
];

interface PendingChange {
  value: boolean | number | string | object;
  tier_values?: Record<string, boolean | number | string>;
}

export default function FeatureControlPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("authentication");
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [pushing, setPushing] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await api.getConfig();
      if (response.success && response.data) {
        setConfigs(response.data as unknown as ConfigItem[]);
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const filteredConfigs = configs.filter((c) => c.category === activeCategory);
  const hasChanges = Object.keys(pendingChanges).length > 0;

  const updateConfig = (key: string, change: PendingChange) => {
    setPendingChanges((prev) => ({ ...prev, [key]: change }));
  };

  const pushChanges = async () => {
    if (!hasChanges) return;
    setPushing(true);
    try {
      const response = await api.updateConfig(pendingChanges);
      if (response.success) {
        toast.success("Config pushed to all connected servers");
        setPendingChanges({});
        fetchConfigs();
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setPushing(false);
    }
  };

  const revertChanges = () => {
    setPendingChanges({});
    toast.info("Changes reverted");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-colonyPurple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feature Control</h1>
          <p className="text-textMuted">The God Panel — control every feature in Colony</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={revertChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Revert
            </Button>
          )}
          <Button variant="outline" onClick={() => toast.info("Preview coming soon")}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={pushChanges}
            disabled={!hasChanges || pushing}
            className="purple-gradient"
          >
            {pushing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Push Changes{hasChanges ? ` (${Object.keys(pendingChanges).length})` : ""}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Category Sidebar */}
        <div className="w-64 flex-shrink-0">
          <Card className="sticky top-6">
            <CardContent className="p-2">
              {CATEGORIES.map((cat) => {
                const count = configs.filter((c) => c.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      activeCategory === cat.id
                        ? "bg-colonyPurple/10 text-colonyPurple"
                        : "text-textSecondary hover:bg-white/5"
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      <p className="text-xs text-textMuted truncate">{count} settings</p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Config Items */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{CATEGORIES.find((c) => c.id === activeCategory)?.icon}</span>
            <div>
              <h2 className="text-lg font-semibold">{CATEGORIES.find((c) => c.id === activeCategory)?.name}</h2>
              <p className="text-sm text-textMuted">{CATEGORIES.find((c) => c.id === activeCategory)?.description}</p>
            </div>
          </div>

          {filteredConfigs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-textMuted">
                No configuration items in this category
              </CardContent>
            </Card>
          ) : (
            filteredConfigs.map((config) => (
              <ConfigItemCard
                key={config.key}
                config={config}
                pendingChange={pendingChanges[config.key]}
                onChange={(change) => updateConfig(config.key, change)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigItemCard({
  config,
  pendingChange,
  onChange,
}: {
  config: ConfigItem;
  pendingChange?: PendingChange;
  onChange: (change: PendingChange) => void;
}) {
  const currentValue = pendingChange?.value ?? config.value;
  const isModified = !!pendingChange;

  return (
    <Card className={isModified ? "border-colonyPurple/50" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{config.label || config.key}</h3>
              {isModified && <Badge className="bg-colonyPurple/20 text-colonyPurple text-xs">Modified</Badge>}
              <Badge variant="outline" className="text-xs">{config.value_type}</Badge>
            </div>
            {config.description && (
              <p className="text-xs text-textMuted mt-1">{config.description}</p>
            )}
            {config.last_modified_at && (
              <p className="text-xs text-textMuted mt-2">
                Last changed: {new Date(config.last_modified_at).toLocaleString()}
                {config.last_modified_by && ` by ${config.last_modified_by}`}
              </p>
            )}
          </div>

          {/* Control based on type */}
          {config.value_type === "boolean" && (
            <Switch
              checked={currentValue as boolean}
              onCheckedChange={(checked) => onChange({ value: checked })}
            />
          )}

          {config.value_type === "tier" && (
            <TierControl
              value={currentValue as string}
              tierValues={config.tier_values}
              onChange={onChange}
            />
          )}

          {config.value_type === "number" && (
            <NumberControl
              value={currentValue as number}
              min={config.min_value}
              max={config.max_value}
              onChange={(val) => onChange({ value: val })}
            />
          )}

          {config.value_type === "text" && (
            <TextControl
              value={currentValue as string}
              onChange={(val) => onChange({ value: val })}
            />
          )}

          {config.value_type === "json" && (
            <JsonControl
              value={currentValue}
              onChange={(val) => onChange({ value: val })}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TierControl({
  value,
  tierValues,
  onChange,
}: {
  value: string;
  tierValues?: Record<string, boolean | number | string>;
  onChange: (change: PendingChange) => void;
}) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const isFree = parsed?.free === true && parsed?.premium === true;
  const isPremiumOnly = parsed?.free === false && parsed?.premium === true;
  const isDisabled = parsed?.free === false && parsed?.premium === false;

  const setTier = (free: boolean, premium: boolean) => {
    onChange({ value: JSON.stringify({ free, premium }) });
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setTier(true, true)}
        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
          isFree ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-bgTertiary text-textMuted hover:text-textPrimary"
        }`}
      >
        Free
      </button>
      <button
        onClick={() => setTier(false, true)}
        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
          isPremiumOnly ? "bg-colonyPurple/20 text-colonyPurple border border-colonyPurple/30" : "bg-bgTertiary text-textMuted hover:text-textPrimary"
        }`}
      >
        Premium Only
      </button>
      <button
        onClick={() => setTier(false, false)}
        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
          isDisabled ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-bgTertiary text-textMuted hover:text-textPrimary"
        }`}
      >
        Disabled
      </button>
    </div>
  );
}

function NumberControl({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min ?? 0}
        max={max ?? 1000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-colonyPurple"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-20 h-8 px-2 bg-bgPrimary border border-white/10 rounded text-sm text-center text-textPrimary focus:outline-none focus:ring-1 focus:ring-colonyPurple"
      />
    </div>
  );
}

function TextControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 h-8 px-3 bg-bgPrimary border border-white/10 rounded text-sm text-textPrimary focus:outline-none focus:ring-1 focus:ring-colonyPurple"
    />
  );
}

function JsonControl({
  value,
  onChange,
}: {
  value: boolean | number | string | object;
  onChange: (val: object) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    try {
      const parsed = JSON.parse(text);
      setError(null);
      onChange(parsed);
      toast.success("Valid JSON");
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="w-64">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        className="w-full h-24 p-2 bg-bgPrimary border border-white/10 rounded text-xs font-mono text-textPrimary resize-none focus:outline-none focus:ring-1 focus:ring-colonyPurple"
      />
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={validate}
          className="px-2 py-1 text-xs bg-bgTertiary rounded hover:bg-white/5"
        >
          Validate
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
