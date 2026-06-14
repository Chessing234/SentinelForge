import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 bg-slate-800" />
        <Skeleton className="h-4 w-96 max-w-full bg-slate-800" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-lg bg-slate-800 lg:col-span-2" />
        <Skeleton className="h-80 rounded-lg bg-slate-800" />
      </div>
    </div>
  );
}
