"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Shield, Ban, Crown, Coins, UserX, Eye, Download, Trash2, AlertTriangle, CheckCircle, XCircle, MessageSquare, UserMinus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { UserProfile } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500/20 text-green-400",
  offline: "bg-gray-500/20 text-gray-400",
  suspended: "bg-yellow-500/20 text-yellow-400",
  shadow_banned: "bg-purple-500/20 text-purple-400",
  banned: "bg-red-500/20 text-red-400",
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.getUser(userId);
      if (response.success && response.data) {
        setUser(response.data as unknown as UserProfile);
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-bgTertiary rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-bgTertiary rounded-xl animate-pulse" />
          <div className="h-96 bg-bgTertiary rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-textMuted">User not found</p>
        <Button variant="outline" onClick={() => router.push("/users")}>Back to Users</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/users")} className="p-2 bg-bgTertiary rounded-lg hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-textMuted">@{user.username}</p>
        </div>
        <Badge className={STATUS_COLORS[user.status] || ""}>{user.status}</Badge>
        {user.verified && <Badge className="bg-blue-500/20 text-blue-400"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="moderation">Moderation</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-colonyPurple/20 flex items-center justify-center text-2xl font-bold text-colonyPurple">
                      {user.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold">{user.name}</h2>
                      <p className="text-textSecondary">{user.phone}</p>
                      {user.email && <p className="text-textSecondary text-sm">{user.email}</p>}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-bgPrimary rounded-lg">
                      <p className="text-xs text-textMuted">Colony Score</p>
                      <p className="text-lg font-bold">{user.colonyScore}</p>
                    </div>
                    <div className="p-3 bg-bgPrimary rounded-lg">
                      <p className="text-xs text-textMuted">Coins</p>
                      <p className="text-lg font-bold">{user.coins}</p>
                    </div>
                    <div className="p-3 bg-bgPrimary rounded-lg">
                      <p className="text-xs text-textMuted">Tier</p>
                      <p className="text-lg font-bold capitalize">{user.tier}</p>
                    </div>
                    <div className="p-3 bg-bgPrimary rounded-lg">
                      <p className="text-xs text-textMuted">Joined</p>
                      <p className="text-lg font-bold">{new Date(user.joinedAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-textMuted mb-1">Last Active</p>
                      <p className="text-sm">{new Date(user.lastActive).toLocaleString()}</p>
                    </div>
                    {user.location && (
                      <div>
                        <p className="text-xs text-textMuted mb-1">Location</p>
                        <p className="text-sm">{user.location.city}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-textMuted text-center py-8">Activity logs will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-textMuted text-center py-8">User content (posts, stories, comments) will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-textMuted text-center py-8">Social connections, waves, groups will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="moderation" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-textMuted text-center py-8">Reports, warnings, ban history will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financials" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-textMuted text-center py-8">Subscription and transaction history will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">User Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Communication */}
              <p className="text-xs text-textMuted mt-2 mb-1">Communication</p>
              <ActionButton icon={MessageSquare} label="Send Warning" variant="warning" />
              <ActionButton icon={MessageSquare} label="Send Message" />

              <Separator className="my-2" />

              {/* Premium */}
              <p className="text-xs text-textMuted mt-2 mb-1">Premium & Coins</p>
              <ActionButton icon={Crown} label="Grant Premium" />
              <ActionButton icon={Crown} label="Revoke Premium" variant="destructive" />
              <ActionButton icon={Coins} label="Grant Coins" />
              <ActionButton icon={Coins} label="Deduct Coins" variant="destructive" />

              <Separator className="my-2" />

              {/* Verification */}
              <p className="text-xs text-textMuted mt-2 mb-1">Verification</p>
              <ActionButton icon={CheckCircle} label="Verify Badge" />
              <ActionButton icon={XCircle} label="Remove Badge" variant="destructive" />

              <Separator className="my-2" />

              {/* Moderation */}
              <p className="text-xs text-textMuted mt-2 mb-1">Moderation</p>
              <ActionButton icon={Eye} label="Shadow Ban" variant="warning" />
              <ActionButton icon={UserX} label="Suspend" variant="warning" />
              <ActionButton icon={Ban} label="Permanent Ban" variant="destructive" />
              <ActionButton icon={UserMinus} label="Lift Restrictions" />

              <Separator className="my-2" />

              {/* Data */}
              <p className="text-xs text-textMuted mt-2 mb-1">Data</p>
              <ActionButton icon={Eye} label="View As User" />
              <ActionButton icon={Download} label="Download Data" />
              <ActionButton icon={Trash2} label="Delete Account" variant="destructive" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, variant = "default" }: { icon: React.ElementType; label: string; variant?: "default" | "destructive" | "warning" }) {
  const [open, setOpen] = useState(false);

  const colorClass = variant === "destructive"
    ? "text-red-400 hover:bg-red-500/10"
    : variant === "warning"
    ? "text-yellow-400 hover:bg-yellow-500/10"
    : "text-textSecondary hover:bg-white/5";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${colorClass}`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={`Are you sure you want to ${label.toLowerCase()}? This action will be logged.`}
        variant={variant === "destructive" ? "destructive" : "default"}
        onConfirm={() => {
          toast.success(`${label} action executed`);
          setOpen(false);
        }}
      />
    </>
  );
}
