"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, Bell, ChevronDown, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/feature-control": "Feature Control",
  "/infrastructure": "Infrastructure",
  "/logs": "Logs",
  "/analytics": "Analytics",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/users/")) return "User Details";
  if (pathname.startsWith("/config/")) {
    const cat = pathname.split("/config/")[1];
    return cat ? `Config — ${cat.charAt(0).toUpperCase() + cat.slice(1)}` : "Configuration";
  }
  return "Colony Admin";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-white/8 bg-bgSecondary/80 backdrop-blur-xl sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-textPrimary">{getPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
          <input
            type="text"
            placeholder="Search users, configs..."
            className="h-9 w-64 rounded-lg border border-white/10 bg-bgPrimary pl-9 pr-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple focus:border-transparent transition-all"
          />
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-textMuted hover:bg-white/5 hover:text-textPrimary transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-bgTertiary shadow-2xl z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="text-sm font-semibold text-textPrimary">Notifications</span>
                <button className="text-xs text-colonyPurple hover:underline">Mark all read</button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                <div className="px-3 py-6 text-center text-sm text-textMuted">No new notifications</div>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-colonyPurple/20 text-colonyPurple text-xs font-bold">
              {(user?.username || "A").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-textPrimary leading-tight">{user?.name || user?.username || "Admin"}</p>
              <p className="text-[10px] text-textMuted leading-tight capitalize">{user?.role?.replace("_", " ") || "Super Admin"}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-textMuted hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-bgTertiary shadow-2xl z-50 py-1 animate-fade-in">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
