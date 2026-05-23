// ─── Auth Types ──────────────────────────────────────────
export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "moderator" | "support" | "analyst";
  permissions: Record<string, boolean>;
  lastLogin?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  admin: AdminUser;
  requiresTwoFactor?: boolean;
}

// ─── Dashboard Types ─────────────────────────────────────
export interface DashboardStats {
  totalUsers: number;
  onlineNow: number;
  newToday: number;
  messagesPerHour: number;
  activeGroups: number;
  revenueToday: number;
  changes: {
    totalUsers: number;
    onlineNow: number;
    newToday: number;
    messagesPerHour: number;
    activeGroups: number;
    revenueToday: number;
  };
}

export interface UserGrowthPoint {
  date: string;
  users: number;
}

export interface HourlyActivePoint {
  hour: string;
  users: number;
}

export interface AlertItem {
  id: string;
  type: "report" | "suspicious" | "error" | "warning";
  title: string;
  description: string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
}

// ─── User Types ──────────────────────────────────────────
export interface UserListItem {
  id: string;
  name: string;
  phone: string;
  username: string;
  avatar?: string;
  tier: "free" | "premium" | "premium_plus";
  status: "online" | "offline" | "suspended" | "shadow_banned" | "banned";
  colonyScore: number;
  lastActive: string;
  joinedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  username: string;
  avatar?: string;
  bio?: string;
  status: string;
  tier: string;
  colonyScore: number;
  coins: number;
  joinedAt: string;
  lastActive: string;
  verified: boolean;
  location?: { lat: number; lng: number; city: string };
}

// ─── Config Types ────────────────────────────────────────
export interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  itemCount: number;
}

export interface ConfigItem {
  key: string;
  label: string;
  description: string;
  value_type: "boolean" | "number" | "tier" | "text" | "json";
  value: boolean | number | string | object;
  category: string;
  tier_values?: Record<string, boolean | number | string>;
  min_value?: number;
  max_value?: number;
  last_modified_at?: string;
  last_modified_by?: string;
  version: number;
}

export interface ConfigUpdatePayload {
  changes: Record<string, { value: boolean | number | string | object; tier_values?: Record<string, boolean | number | string> }>;
  reason?: string;
}

// ─── Log Types ───────────────────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  user?: string;
  action: string;
  ip?: string;
  details: string;
  source?: string;
}

// ─── Analytics Types ─────────────────────────────────────
export interface AnalyticsData {
  dau: number;
  mau: number;
  avgSessionDuration: number;
  retention: { day1: number; day7: number; day30: number };
  userGrowth: { date: string; users: number }[];
  featureUsage: { feature: string; count: number; percentage: number }[];
  geoDistribution: { region: string; users: number }[];
  peakHours: { hour: string; users: number }[];
}

// ─── Infrastructure Types ────────────────────────────────
export interface InfrastructureData {
  database: { host: string; port: number; database: string; username: string; status: string };
  redis: { host: string; port: number; status: string };
  sms: { provider: string; status: string };
  push: { projectId: string; status: string };
  smtp: { host: string; port: number; status: string };
  payment: { razorpayKeyMasked: string; status: string };
}
