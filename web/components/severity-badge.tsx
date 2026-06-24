import { cn } from "@/lib/utils"
import type { Severity } from "@/lib/scan-data"

const styles: Record<Severity, string> = {
  high: "bg-sev-high/15 text-sev-high border-sev-high/30",
  medium: "bg-sev-medium/15 text-sev-medium border-sev-medium/30",
  low: "bg-sev-low/15 text-sev-low border-sev-low/30",
}

export function SeverityBadge({
  severity,
  label,
  className,
}: {
  severity: Severity
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        styles[severity],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-sev-high": severity === "high",
          "bg-sev-medium": severity === "medium",
          "bg-sev-low": severity === "low",
        })}
      />
      {label}
    </span>
  )
}
