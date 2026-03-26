import { EventAction, EventStatus, Role } from "@/lib/types";

export const ROLES: Role[] = ["ADMIN", "WAITER"];
export const EVENT_ACTIONS: EventAction[] = ["CALL_WAITER", "REQUEST_BILL", "VIEW_MENU"];
export const EVENT_STATUSES: EventStatus[] = ["PENDING", "ACKNOWLEDGED", "RESOLVED"];

export const ACTION_LABELS: Record<EventAction, string> = {
  CALL_WAITER: "Llamar al mozo",
  REQUEST_BILL: "Pedir la cuenta",
  VIEW_MENU: "Cliente viendo menú"
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  PENDING: "Pendiente",
  ACKNOWLEDGED: "En camino",
  RESOLVED: "Resuelto"
};

export const EVENT_COOLDOWN_MS = 60_000;
