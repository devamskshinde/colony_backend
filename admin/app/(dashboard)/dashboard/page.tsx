"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Users, Wifi, UserPlus, MessageSquare, UsersRound, IndianRupee, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardData {
  stats: {
    totalUsers: number;
    onlineNow: number;
    newToday: number;
    messagesPerHour: number;
    activeGroups: number;
    revenueToday: number;
    changes: {
      totalUsers: number;
      onlineNow: number;
      newToday: number;
      messagesPerHour: number;
      activeGroups: number;
      revenueToday: number;
    };
  };
  userGrowth: { date: string; users: number }[];
  hourlyActive: { hour: string; users: number }[];
  alerts: { id: string; type: string; title: string; description: string; timestamp: string; severity: string }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [growthPeriod, setGrowthPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.getDashboard();
      if (response.success && response.data) {
        setData(response.data as unknown as DashboardData);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-bgTertiary rounded animate-pulse" />
            <div className="h-4 w-64 bg-bgTertiary rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-bgTertiary rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-textMuted">Failed to load dashboard data</p>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-colonyPurple text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-textMuted">Real-time overview of Colony</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-bgTertiary border border-white/8 rounded-lg text-textSecondary hover:text-textPrimary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={data.stats.totalUsers}
          previousValue={data.stats.totalUsers - data.stats.changes.totalUsers}
        />
        <StatCard
          icon={Wifi}
          label="Online Now"
          value={data.stats.onlineNow}
          previousValue={data.stats.onlineNow - data.stats.changes.onlineNow}
        />
        <StatCard
          icon={UserPlus}
          label="New Today"
          value={data.stats.newToday}
          previousValue={data.stats.newToday - data.stats.changes.newToday}
        />
        <StatCard
          icon={MessageSquare}
          label="Messages/Hour"
          value={data.stats.messagesPerHour}
          previousValue={data.stats.messagesPerHour - data.stats.changes.messagesPerHour}
        />
        <StatCard
          icon={UsersRound}
          label="Active Groups"
          value={data.stats.activeGroups}
          previousValue={data.stats.activeGroups - data.stats.changes.activeGroups}
        />
        <StatCard
          icon={IndianRupee}
          label="Revenue Today"
          value={data.stats.revenueToday}
          previousValue={data.stats.revenueToday - data.stats.changes.revenueToday}
          prefix="₹"
        />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Growth</CardTitle>
              <div className="flex gap-1">
                {(["7d", "30d", "90d"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setGrowthPeriod(period)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      growthPeriod === period
                        ? "bg-colonyPurple text-white"
                        : "bg-bgTertiary text-textMuted hover:text-textPrimary"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#6B6B80" fontSize={12} />
                <YAxis stroke="#6B6B80" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#B0B0C4" }}
                />
                <Line type="monotone" dataKey="users" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alert Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
              {data.alerts.length === 0 ? (
                <p className="text-textMuted text-sm text-center py-8">No alerts</p>
              ) : (
                data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === "critical"
                        ? "border-red-500 bg-red-500/10"
                        : alert.severity === "high"
                        ? "border-orange-500 bg-orange-500/10"
                        : alert.severity === "medium"
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-blue-500 bg-blue-500/10"
                    }`}
                  >
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-textMuted mt-1">{alert.description}</p>
                    <p className="text-xs text-textMuted mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Active Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Active Users by Hour (Today)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.hourlyActive}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" stroke="#6B6B80" fontSize={12} />
              <YAxis stroke="#6B6B80" fontSize={12} />
              <Tooltip
                contentStyle={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                labelStyle={{ color: "#B0B0C4" }}
              />
              <Bar dataKey="users" fill="url(#purpleGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
