"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";
import { WifiOff, RefreshCw } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, isBackendUp, lastError, checkAuth, checkBackend } = useAuthStore();

  useEffect(() => {
    checkAuth();
    checkBackend();
  }, [checkAuth, checkBackend]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Initial loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bgPrimary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-colonyPurple border-t-transparent rounded-full animate-spin" />
          <p className="text-textMuted">Connecting to Colony backend...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bgPrimary flex">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[280px]">
        <Header />
        {/* Backend connectivity warning banner */}
        {isBackendUp === false && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-400">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">Backend unreachable</span>
                <span className="text-xs text-amber-400/70 ml-2">
                  Make sure Docker services are running and the API server is started on port 5000.
                </span>
                {lastError && (
                  <span className="text-xs text-amber-400/50 ml-2">{lastError}</span>
                )}
              </div>
              <button
                onClick={() => { checkBackend(); checkAuth(); }}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-md transition-colors flex-shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* If backend is down, show a centered message instead of broken child pages */}
          {isBackendUp === false ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
              <WifiOff className="w-12 h-12 text-amber-400/50" />
              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold text-textPrimary">Cannot connect to backend</h2>
                <p className="text-sm text-textMuted max-w-md">
                  The admin panel is running but the backend API server on port 5000 is not responding.
                  Run the following on your WSL machine:
                </p>
                <pre className="mt-3 text-xs bg-bgTertiary border border-white/8 rounded-lg p-3 inline-block text-left text-textSecondary">
{`cd colony_backend
docker compose up -d
node src/server.js`}
                </pre>
                <p className="text-xs text-textMuted mt-2">
                  Login credentials: <code className="text-colonyPurple">admin</code> / <code className="text-colonyPurple">admin123</code>
                </p>
              </div>
              <button
                onClick={() => { checkBackend(); checkAuth(); }}
                className="flex items-center gap-2 px-4 py-2 bg-colonyPurple hover:bg-colonyPurple/80 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Check Again
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}