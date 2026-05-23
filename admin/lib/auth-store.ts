"use client";

import { create } from "zustand";
import type { AdminUser } from "./types";

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token: string, user: AdminUser) => {
    localStorage.setItem("colony_admin_token", token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("colony_admin_token");
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  checkAuth: () => {
    const token = localStorage.getItem("colony_admin_token");
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return false;
    }
    set({ token, isAuthenticated: true, isLoading: false });
    return true;
  },
}));
