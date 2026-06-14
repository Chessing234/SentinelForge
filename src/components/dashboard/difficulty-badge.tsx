import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types";

const styles: Record<
  Difficulty,
  { className: string; dot: string; label: string }
> = {
  beginner: {
    className:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
    dot: "bg-emerald-400",
    label: "Beginner",
  },
  intermediate: {
    className:
      "border-blue-500/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/20",
    dot: "bg-blue-400",
    label: "Intermediate",
  },
  advanced: {
    className:
      "border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20",
    dot: "bg-amber-400",
    label: "Advanced",
  },
  expert: {
    className: "border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/20",
    dot: "bg-red-400",
    label: "Expert",
  },
};

type DifficultyBadgeProps = {
  difficulty: Difficulty;
  className?: string;
};

export function DifficultyBadge({
  difficulty,
  className,
}: DifficultyBadgeProps): ReactElement {
  const s = styles[difficulty];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border font-medium capitalize",
        s.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </Badge>
  );
}
