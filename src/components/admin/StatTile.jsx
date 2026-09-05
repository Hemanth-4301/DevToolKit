import { cn } from "../../lib/utils";

export default function StatTile({ label, value, icon: Icon, accent }) {
  return (
    <div className="admin-stat-tile relative overflow-hidden rounded-2xl border border-card-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-card-foreground truncate">{value}</p>
        </div>
        {Icon && (
          <div
            className={cn(
              "shrink-0 flex items-center justify-center h-10 w-10 rounded-xl",
              accent ? "admin-stat-icon-accent" : "bg-accent",
            )}
          >
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
