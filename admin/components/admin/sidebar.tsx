"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, UserX, UserMinus, Ban, Globe, Map, UsersRound,
  FileText, BookImage, Flag, Zap, Settings, Bell, Send, History,
  DollarSign, BarChart3, Server, Shield, KeyRound, UserCog,
  ChevronDown, ChevronLeft, ChevronRight, LogOut, Crown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  superAdminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  superAdminOnly?: boolean;
}

const navigation: NavSection[] = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Users",
    items: [
      { label: "All Users", href: "/users", icon: Users },
      { label: "Suspended", href: "/users?status=suspended", icon: UserX },
      { label: "Shadow Banned", href: "/users?status=shadow_banned", icon: UserMinus },
      { label: "Banned", href: "/users?status=banned", icon: Ban },
    ],
  },
  {
    title: "Feature Control",
    items: [{ label: "Feature Flags", href: "/feature-control", icon: Zap }],
  },
  {
    title: "Configuration",
    items: [
      { label: "Authentication", href: "/config/authentication", icon: KeyRound },
      { label: "Profile", href: "/config/profile", icon: UserCog },
      { label: "Discovery", href: "/config/discovery", icon: Globe },
      { label: "Waves", href: "/config/waves", icon: Send },
      { label: "Stories", href: "/config/stories", icon: BookImage },
      { label: "Chat", href: "/config/chat", icon: FileText },
      { label: "Calls", href: "/config/calls", icon: Bell },
      { label: "Dating", href: "/config/dating", icon: UsersRound },
      { label: "Community", href: "/config/community", icon: Users },
      { label: "Notifications", href: "/config/notifications", icon: Bell },
      { label: "Monetization", href: "/config/monetization", icon: DollarSign },
      { label: "Safety", href: "/config/safety", icon: Shield },
      { label: "UI", href: "/config/ui", icon: Settings },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Overview", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Infrastructure",
    superAdminOnly: true,
    items: [
      { label: "Credentials & Health", href: "/infrastructure", icon: Server, superAdminOnly: true },
    ],
  },
  {
    title: "Security",
    items: [{ label: "Logs", href: "/logs", icon: Shield }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(
    navigation.map((s) => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isSuperAdmin = user?.role === "super_admin";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col border-r border-white/8 bg-bgSecondary transition-all duration-300 shrink-0 z-40",
        collapsed ? "w-[68px]" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/8 shrink-0">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg purple-gradient shrink-0">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-textPrimary tracking-tight">Colony</span>
            <span className="text-[10px] text-textMuted uppercase tracking-wider">Admin Panel</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-1">
          {navigation.map((section) => {
            if (section.superAdminOnly && !isSuperAdmin) return null;
            const isExpanded = expandedSections.includes(section.title);

            return (
              <div key={section.title}>
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full px-2 py-1.5 mt-3 first:mt-0"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted">
                      {section.title}
                    </span>
                    <ChevronDown className={cn("h-3 w-3 text-textMuted transition-transform", !isExpanded && "-rotate-90")} />
                  </button>
                )}
                {(collapsed || isExpanded) && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      if (item.superAdminOnly && !isSuperAdmin) return null;
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors group",
                            section.title === "Feature Control"
                              ? isActive
                                ? "purple-gradient text-white shadow-lg shadow-colonyPurple/20"
                                : "bg-colonyPurple/10 text-colonyPurple border border-colonyPurple/20 hover:bg-colonyPurple/20"
                              : isActive
                                ? "bg-colonyPurple/15 text-colonyPurple"
                                : "text-textSecondary hover:bg-white/5 hover:text-textPrimary",
                            collapsed && "justify-center px-2"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-colonyPurple" : "text-textMuted group-hover:text-textSecondary")} />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge && (
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-400">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 mx-2 my-1 rounded-md text-textMuted hover:bg-white/5 hover:text-textSecondary transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <Separator />

      {/* User info */}
      <div className={cn("flex items-center gap-3 p-4", collapsed && "justify-center")}>
        <div className="relative shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-colonyPurple/20 text-colonyPurple text-xs font-bold">
            {(user?.username || "A").charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bgSecondary bg-emerald-400" />
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-textPrimary truncate">{user?.name || user?.username || "Admin"}</p>
              <p className="text-[11px] text-textMuted truncate capitalize">{user?.role?.replace("_", " ") || "Super Admin"}</p>
            </div>
            <button onClick={handleLogout} className="rounded-md p-1.5 text-textMuted hover:bg-red-500/10 hover:text-red-400 transition-colors" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
