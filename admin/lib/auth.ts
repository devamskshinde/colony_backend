/**
 * Admin authentication store using Zustand.
 *
 * Manages JWT tokens, login/logout flows, session expiry checks,
 * and provides a reactive isAuthenticated state for the admin panel.
 */

import { create } from "zustand";
import { api, type AdminUser, type ApiError } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  /** The current admin user, or null if not authenticated. */
  user: AdminUser | null;

  /** Whether an auth operation is in progress. */
  isLoading: boolean;

  /** The last error message, if any. */
  error: string | null;

  /** Whether the auth state has been initialized. */
  isInitialized: boolean;

  // Actions
  login: (username: string, password: string, totp?: string) => Promise<boolean>;
  logout: () => void;
  getToken: () => string | null;
  isAuthenticated: () => boolean;
  checkSession: () => boolean;
  initialize: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";
const TOKEN_EXPIRY_KEY = "admin_token_expiry";

/** Session duration in milliseconds (8 hours). */
const SESSION_DURATION = 8 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;

  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;

  return Date.now() > parseInt(expiry, 10);
}

function setSession(token: string, user: AdminUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + SESSION_DURATION));
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function getStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  isInitialized: false,

  /**
   * Log in with username/password (and optional TOTP).
   * Returns true on success, false on failure.
   */
  login: async (username: string, password: string, totp?: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.login(username, password, totp);

      if (response.success && response.data) {
        const { token, admin } = response.data;
        setSession(token, admin);
        set({ user: admin, isLoading: false, isInitialized: true });
        return true;
      }

      set({
        error: response.message || "Login failed. Please check your credentials.",
        isLoading: false,
      });
      return false;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "An unexpected error occurred. Please try again.";

      set({ error: message, isLoading: false });
      return false;
    }
  },

  /**
   * Log out and clear all session data.
   */
  logout: () => {
    clearSession();
    set({ user: null, error: null, isInitialized: true });
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  /**
   * Get the current JWT token from localStorage.
   */
  getToken: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Check if the user is currently authenticated.
   */
  isAuthenticated: () => {
    const { user } = get();
    if (!user) return false;
    return !isTokenExpired();
  },

  /**
   * Check session validity. Returns true if valid, false if expired.
   * If expired, clears the session.
   */
  checkSession: () => {
    if (isTokenExpired()) {
      clearSession();
      set({ user: null });
      return false;
    }
    return true;
  },

  /**
   * Initialize auth state from localStorage on app load.
   * Fetches the current user from the API to validate the token.
   */
  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token || isTokenExpired()) {
      clearSession();
      set({ user: null, isInitialized: true });
      return;
    }

    // Restore user from localStorage first for instant UI
    const storedUser = getStoredUser();
    if (storedUser) {
      set({ user: storedUser });
    }

    // Then validate with the server
    try {
      const response = await api.getMe();
      if (response.success && response.data) {
        set({ user: response.data, isInitialized: true });
      } else {
        clearSession();
        set({ user: null, isInitialized: true });
      }
    } catch {
      // If the request fails (e.g., token expired server-side), clear session
      clearSession();
      set({ user: null, isInitialized: true });
    }
  },

  /**
   * Clear the current error message.
   */
  clearError: () => {
    set({ error: null });
  },
}));

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * Hook to get the current auth state.
 */
export function useAuth() {
  const { user, isLoading, error, isInitialized, isAuthenticated } =
    useAuthStore();

  return {
    user,
    isLoading,
    error,
    isInitialized,
    isAuthenticated: isAuthenticated(),
  };
}

/**
 * Hook to get auth actions.
 */
export function useAuthActions() {
  const { login, logout, clearError, checkSession, initialize } =
    useAuthStore();

  return { login, logout, clearError, checkSession, initialize };
}
