"use client";

import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-[0.24em] text-amber-700">
            {eyebrow}
          </div>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function StatusPill({
  tone,
  children
}: {
  tone: "amber" | "emerald" | "slate" | "rose";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700"
  };

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="panel border-dashed px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function LoadingButton({
  loading,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
}) {
  return (
    <button className={cn("button-primary gap-2", className)} disabled={loading || props.disabled} {...props}>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
