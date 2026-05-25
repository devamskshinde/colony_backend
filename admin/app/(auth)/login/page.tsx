"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2, WifiOff, Wifi } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login: storeLogin } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(true);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      setCheckingBackend(true);
      const ok = await api.pingBackend();
      if (!cancelled) {
        setBackendOnline(ok);
        setCheckingBackend(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      const remaining = Math.ceil((lockoutUntil! - Date.now()) / 60000);
      toast.error(`Too many attempts. Try again in ${remaining} minutes.`);
      return;
    }

    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.login(username, password, requires2FA ? totp : undefined);

      if (response.success && response.data) {
        const { token, admin } = response.data;
        storeLogin(token, admin);
        toast.success(`Welcome back, ${admin.name || admin.username}`);
        router.push("/dashboard");
      }
    } catch (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 15 * 60 * 1000);
        setAttempts(0);
        toast.error("Too many failed attempts. Locked out for 15 minutes.");
        return;
      }

      if (error instanceof ApiError) {
        if (error.isNetworkError()) {
          // Backend is unreachable — show detailed help
          setBackendOnline(false);
          toast.error("Cannot reach the backend server. Check that Docker services and the API are running.");
        } else if (error.status === 403 && error.body && (error.body as Record<string, unknown>).requiresTwoFactor) {
          setRequires2FA(true);
          toast.info("Enter your 2FA code");
        } else {
          toast.error(error.message || "Login failed");
        }
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgPrimary mesh-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl purple-gradient mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-textPrimary">Colony Admin</h1>
          <p className="text-textMuted mt-1">God Mode Control Center</p>
        </div>

        {/* Backend status indicator */}
        {!checkingBackend && (
          <div className={`mb-6 rounded-xl border px-4 py-3 flex items-center justify-center gap-2 text-sm ${
            backendOnline
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}>
            {backendOnline ? (
              <><Wifi className="w-4 h-4" /> Backend connected</>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4" />
                  <span>Backend not reachable</span>
                </div>
                <p className="text-[11px] text-amber-400/60 mt-1 text-center">
                  Make sure Docker services are running on WSL and the API server is started on port 5000.
                </p>
                <pre className="text-[11px] text-amber-400/50 mt-1 bg-black/20 px-2 py-1 rounded">
cd colony_backend && docker compose up -d && node src/server.js
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Login Form */}
        <div className="bg-bgTertiary border border-white/8 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-textSecondary mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full h-11 px-4 bg-bgPrimary border border-white/10 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple focus:border-transparent transition-all"
                autoComplete="username"
                disabled={isLoading || isLockedOut}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-textSecondary mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 px-4 pr-11 bg-bgPrimary border border-white/10 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple focus:border-transparent transition-all"
                  autoComplete="current-password"
                  disabled={isLoading || isLockedOut}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 2FA (conditional) */}
            {requires2FA && (
              <div className="animate-fade-in">
                <label htmlFor="totp" className="block text-sm font-medium text-textSecondary mb-2">
                  Two-Factor Code
                </label>
                <input
                  id="totp"
                  type="text"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-11 px-4 bg-bgPrimary border border-white/10 rounded-lg text-textPrimary text-center text-xl tracking-[0.5em] placeholder:text-textMuted placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-colonyPurple focus:border-transparent transition-all"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Attempts warning */}
            {attempts > 0 && attempts < 5 && (
              <p className="text-sm text-yellow-500">
                {5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} remaining before lockout
              </p>
            )}

            {isLockedOut && (
              <p className="text-sm text-red-500">
                Account locked. Try again in {Math.ceil((lockoutUntil! - Date.now()) / 60000)} minutes.
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || isLockedOut}
              className="w-full h-11 purple-gradient hover:opacity-90 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-textMuted text-xs mt-6">
          Colony Admin Panel v1.0 • All access is logged and monitored
        </p>
      </div>
    </div>
  );
}