import { subDays } from "date-fns";

import type { AdminMetrics, EventRecord, EventStatus } from "@/lib/types";

function roundTo(value: number | null, decimals = 2) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(decimals));
}

export function computeAdminMetrics(events: EventRecord[]): AdminMetrics {
  const now = new Date();
  const dailyMap = new Map<string, AdminMetrics["daily"][number]>();
  const tableMap = new Map<string, AdminMetrics["top_tables"][number]>();
  const sectorMap = new Map<string, number>();
  const statuses: EventStatus[] = ["PENDING", "ACKNOWLEDGED", "RESOLVED"];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = subDays(now, offset);
    const key = date.toISOString().slice(0, 10);

    dailyMap.set(key, {
      date: key,
      label: date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      total_events: 0,
      waiter_calls: 0,
      bill_requests: 0,
      menu_views: 0
    });
  }

  let totalAckMinutes = 0;
  let ackCount = 0;
  let totalResolveMinutes = 0;
  let resolveCount = 0;
  let marketingOptIns = 0;

  events.forEach((event) => {
    const dateKey = event.created_at.slice(0, 10);
    const day = dailyMap.get(dateKey);
    if (day) {
      day.total_events += 1;
      if (event.action === "CALL_WAITER") {
        day.waiter_calls += 1;
      } else if (event.action === "REQUEST_BILL") {
        day.bill_requests += 1;
      } else {
        day.menu_views += 1;
      }
    }

    const tableId = event.table_id;
    const tableName = event.restaurant_tables?.table_name ?? "Mesa";
    const currentTable = tableMap.get(tableId) ?? {
      table_id: tableId,
      table_name: tableName,
      total_events: 0,
      waiter_calls: 0,
      bill_requests: 0,
      menu_views: 0
    };
    currentTable.total_events += 1;
    if (event.action === "CALL_WAITER") {
      currentTable.waiter_calls += 1;
    } else if (event.action === "REQUEST_BILL") {
      currentTable.bill_requests += 1;
    } else {
      currentTable.menu_views += 1;
    }
    tableMap.set(tableId, currentTable);

    const sector = event.restaurant_tables?.sector ?? "Sin sector";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + 1);

    if (event.marketing_opt_in) {
      marketingOptIns += 1;
    }

    if (event.acknowledged_at) {
      totalAckMinutes +=
        (new Date(event.acknowledged_at).getTime() - new Date(event.created_at).getTime()) /
        60000;
      ackCount += 1;
    }

    if (event.resolved_at) {
      totalResolveMinutes +=
        (new Date(event.resolved_at).getTime() - new Date(event.created_at).getTime()) / 60000;
      resolveCount += 1;
    }
  });

  return {
    summary: {
      total_events: events.length,
      pending_events: events.filter((event) => event.status === "PENDING").length,
      waiter_calls: events.filter((event) => event.action === "CALL_WAITER").length,
      bill_requests: events.filter((event) => event.action === "REQUEST_BILL").length,
      menu_views: events.filter((event) => event.action === "VIEW_MENU").length,
      avg_minutes_to_acknowledge: ackCount ? roundTo(totalAckMinutes / ackCount) : null,
      avg_minutes_to_resolve: resolveCount ? roundTo(totalResolveMinutes / resolveCount) : null,
      marketing_opt_in_rate: events.length ? roundTo((marketingOptIns / events.length) * 100, 1) ?? 0 : 0
    },
    daily: Array.from(dailyMap.values()),
    top_tables: Array.from(tableMap.values())
      .sort((a, b) => b.total_events - a.total_events || a.table_name.localeCompare(b.table_name))
      .slice(0, 5),
    sectors: Array.from(sectorMap.entries())
      .map(([sector, total_events]) => ({ sector, total_events }))
      .sort((a, b) => b.total_events - a.total_events || a.sector.localeCompare(b.sector)),
    statuses: statuses.map((status) => ({
      status,
      total: events.filter((event) => event.status === status).length
    }))
  };
}
