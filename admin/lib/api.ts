/**
 * Admin API Client for Colony Backend.
 *
 * Handles authentication, request signing, error handling,
 * and automatic 401 redirects for the admin panel.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
  totp?: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  lastLogin: string;
}

export interface UserRecord {
  id: string;
  phone: string;
  name: string;
  username: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  colonyId: string;
  isVerified: boolean;
  isBanned: boolean;
  status: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  [key: string]: unknown;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxUploadSize: number;
  allowedFileTypes: string[];
  rateLimits: Record<string, number>;
  features: Record<string, boolean>;
}

export interface LogEntry {
  id: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsData {
  users: {
    total: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    growth: number[];
  };
  posts: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number[];
  };
  engagement: {
    dailyActiveUsers: number;
    avgSessionDuration: number;
    avgPostsPerUser: number;
    topColonies: Array<{ id: string; name: string; members: number; posts: number }>;
  };
  revenue: {
    total: number;
    thisMonth: number;
    growth: number[];
  };
}

export interface DashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalPosts: number;
    totalColonies: number;
    revenue: number;
    growth: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
  alerts: Array<{
    id: string;
    type: "info" | "warning" | "error" | "success";
    message: string;
    timestamp: string;
  }>;
}

// ---------------------------------------------------------------------------
// Request signing
// ---------------------------------------------------------------------------

function generateSignature(timestamp: string, method: string, path: string): string {
  // Simple HMAC-like signing: in production, use a proper crypto library.
  // This provides basic request integrity for the admin API.
  const secret = typeof window !== "undefined"
    ? localStorage.getItem("admin_api_secret") || "colony-admin-default"
    : "colony-admin-default";

  const payload = `${timestamp}:${method}:${path}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Combine with secret
  let secretHash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    secretHash = ((secretHash << 5) - secretHash + char) | 0;
  }

  return `${Math.abs(hash ^ secretHash).toString(16)}:${timestamp}`;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("colony_admin_token");
}

function handleAuthError(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("colony_admin_token");
  localStorage.removeItem("admin_user");
  window.location.href = "/login";
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  const method = (options.method || "GET").toUpperCase();
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp, method, endpoint);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      handleAuthError();
      throw new ApiError("Session expired. Please log in again.", 401);
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      throw new ApiError("You do not have permission to perform this action.", 403);
    }

    // Handle 429 Rate Limit
    if (response.status === 429) {
      throw new ApiError("Too many requests. Please try again later.", 429);
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        errorBody.message || errorBody.error || `Request failed with status ${response.status}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new ApiError("Unable to connect to the server. Please check your connection.", 0);
    }

    throw new ApiError(
      error instanceof Error ? error.message : "An unexpected error occurred.",
      0
    );
  }
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const api = {
  // Auth
  async login(username: string, password: string, totp?: string) {
    return request<LoginResponse>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, totp } as LoginRequest),
    });
  },

  async getMe() {
    return request<AdminUser>("/admin/auth/me");
  },

  // Users
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    colonyId?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<UserRecord[]>(`/admin/users${query ? `?${query}` : ""}`);
  },

  async getUser(userId: string) {
    return request<UserRecord>(`/admin/users/${userId}`);
  },

  async updateUser(userId: string, data: Partial<UserRecord> & { isBanned?: boolean; banReason?: string }) {
    return request<UserRecord>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Config
  async getConfig() {
    return request<AppConfig>("/admin/config");
  },

  async updateConfig(config: Partial<AppConfig>) {
    return request<AppConfig>("/admin/config", {
      method: "PATCH",
      body: JSON.stringify(config),
    });
  },

  // Logs
  async getLogs(params?: {
    page?: number;
    limit?: number;
    level?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<LogEntry[]>(`/admin/logs${query ? `?${query}` : ""}`);
  },

  // Analytics
  async getAnalytics(period?: "7d" | "30d" | "90d" | "1y") {
    return request<AnalyticsData>(`/admin/analytics${period ? `?period=${period}` : ""}`);
  },

  // Dashboard
  async getDashboard() {
    return request<DashboardData>("/admin/dashboard");
  },

  // ── User management ─────────────────────────────────────
  async getUserProfile(userId: string) {
    return request<import("./types").UserProfile>(`/admin/users/${userId}/profile`);
  },

  async getUserActivity(userId: string) {
    return request<import("./types").UserActivity>(`/admin/users/${userId}/activity`);
  },

  async getUserContent(userId: string) {
    return request<import("./types").UserContent>(`/admin/users/${userId}/content`);
  },

  async getUserSocial(userId: string) {
    return request<import("./types").UserSocial>(`/admin/users/${userId}/social`);
  },

  async getUserModeration(userId: string) {
    return request<import("./types").UserModeration>(`/admin/users/${userId}/moderation`);
  },

  async getUserFinancials(userId: string) {
    return request<import("./types").UserFinancials>(`/admin/users/${userId}/financials`);
  },

  async performUserAction(userId: string, action: import("./types").AdminAction) {
    return request<unknown>(`/admin/users/${userId}/action`, {
      method: "POST",
      body: JSON.stringify(action),
    });
  },

  // ── Feature control ─────────────────────────────────────
  async getConfigCategories() {
    return request<import("./types").ConfigCategory[]>("/admin/config/categories");
  },

  async getConfigByCategory(category: string) {
    return request<import("./types").ConfigItem[]>(`/admin/config/category/${category}`);
  },

  async pushConfig(payload: import("./types").ConfigUpdatePayload) {
    return request<import("./types").ConfigUpdateResponse>("/admin/config/push", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Infrastructure ──────────────────────────────────────
  async getInfrastructure() {
    return request<import("./types").InfrastructureData>("/admin/infrastructure");
  },

  async testConnection(service: string) {
    return request<{ success: boolean; message: string }>(`/admin/infrastructure/test/${service}`, {
      method: "POST",
    });
  },

  // ── Logs ────────────────────────────────────────────────
  async exportLogs(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    return request<{ downloadUrl: string }>(`/admin/logs/export${query ? `?${query}` : ""}`);
  },
};

export default api;
