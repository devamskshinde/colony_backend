"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, Download, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LogEntry } from "@/lib/types";

const LEVEL_COLORS: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-400",
  warn: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
  debug: "bg-gray-500/20 text-gray-400",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const fetchLogs = useCallback(async () => {
    try {
      const response = await api.getLogs({ search: search || undefined, level: levelFilter === "all" ? undefined : levelFilter });
      if (response.success && response.data) {
        setLogs(response.data as unknown as LogEntry[]);
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [search, levelFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-textMuted">System logs and audit trail</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLogs} className="p-2 bg-bgTertiary rounded-lg hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-bgTertiary rounded-lg hover:bg-white/5 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-bgTertiary border border-white/8 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple"
          />
        </div>
        <div className="flex gap-1">
          {["all", "info", "warn", "error"].map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-2 text-sm rounded-lg capitalize ${
                levelFilter === level ? "bg-colonyPurple text-white" : "bg-bgTertiary text-textMuted hover:text-textPrimary"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Time</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Level</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">User</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Action</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">IP</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-3 px-4"><div className="h-4 w-32 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-5 w-16 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-32 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-48 bg-bgTertiary rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-textMuted">No logs found</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-sm text-textMuted whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={LEVEL_COLORS[log.level] || ""}>{log.level}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">{log.user || "system"}</td>
                    <td className="py-3 px-4 text-sm">{log.action}</td>
                    <td className="py-3 px-4 text-sm text-textMuted font-mono text-xs">{log.ip || "—"}</td>
                    <td className="py-3 px-4 text-sm text-textMuted max-w-xs truncate">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
