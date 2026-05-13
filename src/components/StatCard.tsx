import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  variant?: "default" | "gold" | "success" | "warning";
}

export function StatCard({ label, value, icon: Icon, hint, variant = "default" }: Props) {
  const styles = {
    default: "bg-card",
    gold: "gradient-gold text-gold-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
  }[variant];

  const iconBg = {
    default: "bg-primary/10 text-primary",
    gold: "bg-white/20 text-gold-foreground",
    success: "bg-white/20 text-success-foreground",
    warning: "bg-white/20 text-warning-foreground",
  }[variant];

  return (
    <Card className={`p-5 border-0 shadow-elegant ${styles}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-medium uppercase tracking-wider ${variant === "default" ? "text-muted-foreground" : "opacity-90"}`}>
            {label}
          </div>
          <div className="mt-1.5 text-3xl font-bold">{value}</div>
          {hint && <div className={`mt-1 text-xs ${variant === "default" ? "text-muted-foreground" : "opacity-80"}`}>{hint}</div>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
