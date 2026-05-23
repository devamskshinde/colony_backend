"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Users, Clock, TrendingUp, BarChart3 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { AnalyticsData } from "@/lib/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await api.getAnalytics(period);
      if (response.success && response.data) {
        setData(response.data as unknown as AnalyticsData);
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-bgTertiary rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-bgTertiary rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-textMuted">Failed to load analytics</p>
        <button onClick={fetchAnalytics} className="px-4 py-2 bg-colonyPurple text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-textMuted">Platform usage and engagement metrics</p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-lg ${period === p ? "bg-colonyPurple text-white" : "bg-bgTertiary text-textMuted hover:text-textPrimary"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="DAU" value={data.dau} />
        <StatCard icon={Users} label="MAU" value={data.mau} />
        <StatCard icon={Clock} label="Avg Session" value={data.avgSessionDuration} suffix="min" />
        <StatCard icon={TrendingUp} label="Day 1 Retention" value={data.retention.day1} suffix="%" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>User Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#6B6B80" fontSize={12} />
                <YAxis stroke="#6B6B80" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="users" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Feature Usage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.featureUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="feature" stroke="#6B6B80" fontSize={12} />
                <YAxis stroke="#6B6B80" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="#6B6B80" fontSize={12} />
                <YAxis stroke="#6B6B80" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                <Bar dataKey="users" fill="url(#gradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Retention</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Day 1", value: data.retention.day1 },
                { label: "Day 7", value: data.retention.day7 },
                { label: "Day 30", value: data.retention.day30 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="text-textMuted">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-bgPrimary rounded-full overflow-hidden">
                    <div
                      className="h-full purple-gradient rounded-full transition-all"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
