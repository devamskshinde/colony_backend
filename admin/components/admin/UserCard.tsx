"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Ban, Eye, UserX, MessageSquare } from "lucide-react";

interface UserCardProps {
  user: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    tier: "free" | "premium";
    isOnline: boolean;
    lastSeen?: string;
    location?: string;
    status?: "active" | "suspended" | "shadow_banned" | "banned";
  };
  onSuspend?: (userId: string) => void;
  onBan?: (userId: string) => void;
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
  className?: string;
}

export function UserCard({
  user,
  onSuspend,
  onBan,
  onViewProfile,
  onSendMessage,
  className,
}: UserCardProps) {
  const [showActions, setShowActions] = React.useState(false);
  const actionsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statusColors = {
    active: "bg-emerald-400",
    suspended: "bg-amber-400",
    shadow_banned: "bg-purple-400",
    banned: "bg-red-400",
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-lg border border-white/5 bg-bgSecondary p-3 transition-all hover:border-white/10",
        user.status === "banned" && "opacity-60",
        className
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-colonyPurple/20 text-colonyPurple text-sm font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        {user.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bgSecondary bg-emerald-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textPrimary truncate">
            {user.name}
          </span>
          <Badge
            variant={user.tier === "premium" ? "default" : "secondary"}
            className="text-[10px] px-1.5 py-0"
          >
            {user.tier === "premium" ? "Premium" : "Free"}
          </Badge>
          {user.status && user.status !== "active" && (
            <Badge
              variant={
                user.status === "banned"
                  ? "destructive"
                  : user.status === "suspended"
                    ? "warning"
                    : "secondary"
              }
              className="text-[10px] px-1.5 py-0"
            >
              {user.status.replace("_", " ")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-textMuted truncate">{user.phone}</p>
        {!user.isOnline && user.lastSeen && (
          <p className="text-[10px] text-textMuted">
            Last seen {user.lastSeen}
          </p>
        )}
        {user.location && (
          <p className="text-[10px] text-textMuted">{user.location}</p>
        )}
      </div>

      {/* Actions */}
      <div ref={actionsRef} className="relative shrink-0">
        <button
          onClick={() => setShowActions(!showActions)}
          className="rounded-md p-1.5 text-textMuted hover:bg-white/5 hover:text-textSecondary transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {showActions && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-white/10 bg-bgTertiary shadow-xl z-50 py-1">
            {onViewProfile && (
              <button
                onClick={() => {
                  onViewProfile(user.id);
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-textSecondary hover:bg-white/5 hover:text-textPrimary"
              >
                <Eye className="h-3.5 w-3.5" />
                View Profile
              </button>
            )}
            {onSendMessage && (
              <button
                onClick={() => {
                  onSendMessage(user.id);
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-textSecondary hover:bg-white/5 hover:text-textPrimary"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send Message
              </button>
            )}
            {onSuspend && user.status === "active" && (
              <button
                onClick={() => {
                  onSuspend(user.id);
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-white/5"
              >
                <UserX className="h-3.5 w-3.5" />
                Suspend
              </button>
            )}
            {onBan && user.status !== "banned" && (
              <button
                onClick={() => {
                  onBan(user.id);
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
              >
                <Ban className="h-3.5 w-3.5" />
                Ban User
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
