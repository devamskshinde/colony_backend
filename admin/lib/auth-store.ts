"use client";

import { create } from "zustand";
import { api, ApiError } from "./api";
import type { AdminUser } from "./types";

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Whether the backend server is reachable. */
  isBackendUp: boolean | null; // null = not checked yet
  /** The most recent error message (cleared on success). */
  lastError: string | null;

  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  /** Validate token + check backend connectivity. */
  checkAuth: () => Promise<boolean>;
  /** Ping backend to update connectivity status. */
  checkBackend: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isBackendUp: null,
  lastError: null,

  login: (token: string, user: AdminUser) => {
    localStorage.setItem("colony_admin_token", token);
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
      lastError: null,
    });
  },

  logout: () => {
    localStorage.removeItem("colony_admin_token");
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,
    });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  clearError: () => set({ lastError: null }),

  /** Check if backend is reachable. Returns true/false, never throws. */
  checkBackend: async () => {
    const alive = await api.pingBackend();
    set({ isBackendUp: alive });
    return alive;
  },

  /**
   * Validate the stored token against the backend.
   * - If token exists AND backend confirms it → authenticated
   * - If token exists BUT backend is down → keep token, mark as "auth but no backend"
   * - If token exists BUT backend rejects it → clear token, redirect to login
   * - If no token → not authenticated
   */
  checkAuth: async () => {
    const token = localStorage.getItem("colony_admin_token");

    if (!token) {
      set({ isAuthenticated: false, isLoading: false, token: null, user: null });
      return false;
    }

    // We have a token. Try to validate it against the server.
    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        set({
          user: res.data,
          token,
          isAuthenticated: true,
          isLoading: false,
          isBackendUp: true,
          lastError: null,
        });
        return true;
      }
      // Server responded but token is invalid
      localStorage.removeItem("colony_admin_token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isBackendUp: true,
        lastError: "Session expired. Please log in again.",
      });
      return false;
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError()) {
        // Backend is unreachable — keep the token but mark as not connected
        set({
          token,
          isAuthenticated: true,  // we have a token, just can't reach server
          isLoading: false,
          isBackendUp: false,
          lastError: `Backend unreachable. Make sure 'node src/server.js' is running on port 5000.`,
        });
        return true; // still "authenticated" in the sense of having a valid session
      }
      // Other errors (server errors etc.) — try keeping the token
      set({
        token,
        isAuthenticated: true,
        isLoading: false,
        isBackendUp: false,
        lastError: err instanceof Error ? err.message : "Auth check failed",
      });
      return true;
    }
  },
}));

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

export function useAuth() {
  const { user, isLoading, isAuthenticated, isBackendUp, lastError } = useAuthStore();
  return { user, isLoading, isAuthenticated, isBackendUp, lastError };
}

export function useAuthActions() {
  const { login, logout, checkAuth, checkBackend, clearError } = useAuthStore();
  return { login, logout, checkAuth, checkBackend, clearError };
}