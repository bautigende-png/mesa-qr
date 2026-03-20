import { clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export function formatElapsed(date: string) {
  return formatDistanceToNowStrict(new Date(date), {
    addSuffix: false,
    locale: es
  });
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function safeUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return null;
  }
}
