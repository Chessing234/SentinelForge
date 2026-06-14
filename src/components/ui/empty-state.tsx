"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="mb-3 h-10 w-10 text-slate-500" aria-hidden />
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>
      {action ? (
        <div className="mt-6">
          {action.href ? (
            <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
