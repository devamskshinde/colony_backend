"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Zap, RotateCcw, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfigToggle } from "@/components/admin/ConfigToggle";
import { TierSelector } from "@/components/admin/TierSelector";
import { NumberControl } from "@/components/admin/NumberControl";
import { TextControl } from "@/components/admin/TextControl";
import { JsonEditor } from "@/components/admin/JsonEditor";
import type { ConfigItem } from "@/lib/types";

export default function ConfigCategoryPage() {
  const params = useParams();
  const category = params.category as string;
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Record<string, { value: boolean | number | string | object; tier_values?: Record<string, boolean | number | string> }>>({});
  const [pushing, setPushing] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getConfig();
      if (response.success && response.data) {
        const allConfigs = response.data as unknown as ConfigItem[];
        setConfigs(allConfigs.filter(c => c.category === category));
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleChange = (key: string, value: boolean | number | string | object, tier_values?: Record<string, boolean | number | string>) => {
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, value, ...(tier_values ? { tier_values } : {}) } : c));
    setChanges(prev => ({ ...prev, [key]: { value, ...(tier_values ? { tier_values } : {}) } }));
  };

  const handlePush = async () => {
    if (Object.keys(changes).length === 0) { toast.info("No changes to push"); return; }
    setPushing(true);
    try {
      const res = await api.updateConfig(changes as Record<string, unknown>);
      if (res.success) {
        toast.success("Config pushed to all connected servers");
        setChanges({});
        fetchConfigs();
      }
    } catch {
      toast.error("Failed to push config");
    } finally {
      setPushing(false);
    }
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
          <Link href="/feature-control" className="flex items-center gap-2 text-textMuted hover:text-textPrimary text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Feature Control
          </Link>
          <h1 className="text-2xl font-bold capitalize">{category} Configuration</h1>
          <p className="text-textMuted">{configs.length} settings in this category</p>
        </div>
        <div className="flex gap-2">
          {Object.keys(changes).length > 0 && (
            <Button variant="outline" onClick={() => { setChanges({}); fetchConfigs(); }}>
              <RotateCcw className="w-4 h-4 mr-2" /> Revert
            </Button>
          )}
          <Button onClick={handlePush} disabled={Object.keys(changes).length === 0 || pushing} className="purple-gradient">
            {pushing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Push Changes{Object.keys(changes).length > 0 ? ` (${Object.keys(changes).length})` : ""}
          </Button>
        </div>
      </div>

      {/* Config Items */}
      <div className="space-y-4">
        {configs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-textMuted">No configuration items in this category</CardContent>
          </Card>
        ) : (
          configs.map((config) => (
            <Card key={config.key} className={changes[config.key] ? "border-colonyPurple/50" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{config.label || config.key}</h3>
                      {changes[config.key] && <span className="inline-block w-2 h-2 bg-colonyPurple rounded-full animate-pulse" />}
                      <span className="inline-block px-2 py-0.5 bg-bgTertiary text-textMuted text-xs rounded">{config.value_type}</span>
                    </div>
                    {config.description && <p className="text-xs text-textMuted mt-1">{config.description}</p>}
                    {config.last_modified_at && <p className="text-xs text-textMuted mt-2">Last changed: {new Date(config.last_modified_at).toLocaleString()} {config.last_modified_by ? `by ${config.last_modified_by}` : ""}</p>}
                  </div>
                  {config.value_type === "boolean" ? (
                    <ConfigToggle
                      feature={config.label || config.key}
                      description={config.description || ""}
                      enabled={typeof config.value === "boolean" ? config.value : String(config.value) === "true"}
                      onToggle={(v: boolean) => handleChange(config.key, v)}
                    />
                  ) : config.value_type === "tier" ? (
                    <TierSelector
                      value={String(config.value)}
                      onChange={(v: string) => handleChange(config.key, v)}
                    />
                  ) : config.value_type === "number" ? (
                    <NumberControl
                      label={config.label || config.key}
                      description={config.description || ""}
                      value={typeof config.value === "number" ? config.value : Number(config.value) || 0}
                      onChange={(v: number) => handleChange(config.key, v)}
                      min={config.min_value}
                      max={config.max_value}
                    />
                  ) : config.value_type === "json" ? (
                    <JsonEditor
                      label={config.label || config.key}
                      description={config.description || ""}
                      value={config.value}
                      onChange={(v: string) => handleChange(config.key, v)}
                    />
                  ) : (
                    <TextControl
                      label={config.label || config.key}
                      description={config.description || ""}
                      value={String(config.value ?? "")}
                      onChange={(v: string) => handleChange(config.key, v)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
