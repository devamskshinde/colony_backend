"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserListItem } from "@/lib/types";

const STATUS_TABS = [
  { id: "all", label: "All Users" },
  { id: "online", label: "Online" },
  { id: "suspended", label: "Suspended" },
  { id: "shadow_banned", label: "Shadow Banned" },
  { id: "banned", label: "Banned" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500/20 text-green-400",
  offline: "bg-gray-500/20 text-gray-400",
  suspended: "bg-yellow-500/20 text-yellow-400",
  shadow_banned: "bg-purple-500/20 text-purple-400",
  banned: "bg-red-500/20 text-red-400",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-500/20 text-gray-400",
  premium: "bg-colonyPurple/20 text-colonyPurple",
  premium_plus: "bg-colonyAmber/20 text-colonyAmber",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: activeTab === "all" ? undefined : activeTab,
      });
      if (response.success && response.data) {
        setUsers(response.data as unknown as UserListItem[]);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-textMuted">Manage all Colony users</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
        <input
          type="text"
          placeholder="Search by name, phone, or username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full h-10 pl-10 pr-4 bg-bgTertiary border border-white/8 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-colonyPurple text-white"
                : "bg-bgTertiary text-textMuted hover:text-textPrimary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">User</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Phone</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Tier</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Score</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-textMuted uppercase">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-3 px-4"><div className="h-10 w-40 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-5 w-16 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-5 w-16 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-12 bg-bgTertiary rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-bgTertiary rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-textMuted">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => router.push(`/users/${user.id}`)}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-colonyPurple/20 flex items-center justify-center text-sm font-medium text-colonyPurple">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-textMuted">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-textSecondary">{user.phone}</td>
                    <td className="py-3 px-4">
                      <Badge className={TIER_COLORS[user.tier] || ""}>{user.tier}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={STATUS_COLORS[user.status] || ""}>{user.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">{user.colonyScore}</td>
                    <td className="py-3 px-4 text-sm text-textMuted">
                      {new Date(user.lastActive).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-textMuted">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 bg-bgTertiary rounded-lg disabled:opacity-30 hover:bg-white/5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 bg-bgTertiary rounded-lg disabled:opacity-30 hover:bg-white/5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
