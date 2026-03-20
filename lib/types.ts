export type Role = "ADMIN" | "WAITER";

export type EventAction = "CALL_WAITER" | "REQUEST_BILL";
export type EventStatus = "PENDING" | "ACKNOWLEDGED" | "RESOLVED";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  table_name: string;
  active: boolean;
  sector: string | null;
  ordering_url: string;
  menu_url_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  restaurant_name: string;
  global_menu_url: string | null;
  direct_order_url: string | null;
  logo_url: string | null;
  mobile_banner_url: string | null;
  mobile_banner_text: string | null;
  custom_message: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  brand_tertiary_color: string;
  created_at: string;
  updated_at: string;
}

export interface EventRecord {
  id: string;
  table_id: string;
  action: EventAction;
  status: EventStatus;
  customer_email: string;
  marketing_opt_in: boolean;
  session_id: string;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  restaurant_tables?: Pick<RestaurantTable, "id" | "table_name" | "sector"> | null;
}

export interface AdminMetricsSummary {
  total_events: number;
  pending_events: number;
  waiter_calls: number;
  bill_requests: number;
  avg_minutes_to_acknowledge: number | null;
  avg_minutes_to_resolve: number | null;
  marketing_opt_in_rate: number;
}

export interface AdminMetricsDailyPoint {
  date: string;
  label: string;
  total_events: number;
  waiter_calls: number;
  bill_requests: number;
}

export interface AdminMetricsTopTable {
  table_id: string;
  table_name: string;
  total_events: number;
  waiter_calls: number;
  bill_requests: number;
}

export interface AdminMetricsSector {
  sector: string;
  total_events: number;
}

export interface AdminMetricsStatus {
  status: EventStatus;
  total: number;
}

export interface AdminMetrics {
  summary: AdminMetricsSummary;
  daily: AdminMetricsDailyPoint[];
  top_tables: AdminMetricsTopTable[];
  sectors: AdminMetricsSector[];
  statuses: AdminMetricsStatus[];
}
