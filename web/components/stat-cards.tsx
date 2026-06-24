import { Files, FileWarning, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardsProps {
  scanned: number
  issueFiles: number
  totalIssues: number
  labels: { scanned: string; issueFiles: string; totalIssues: string }
}

export function StatCards({ scanned, issueFiles, totalIssues, labels }: StatCardsProps) {
  const cards = [
    {
      label: labels.scanned,
      value: scanned,
      icon: Files,
      accent: "text-brand",
      iconBg: "bg-brand/10",
      danger: false,
    },
    {
      label: labels.issueFiles,
      value: issueFiles,
      icon: FileWarning,
      accent: "text-sev-high",
      iconBg: "bg-sev-high/10",
      danger: true,
    },
    {
      label: labels.totalIssues,
      value: totalIssues,
      icon: TriangleAlert,
      accent: "text-sev-high",
      iconBg: "bg-sev-high/10",
      danger: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-5"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <span
              className={cn(
                "font-mono text-3xl font-semibold tabular-nums",
                c.danger ? "text-sev-high" : "text-foreground",
              )}
            >
              {c.value}
            </span>
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", c.iconBg)}>
            <c.icon className={cn("h-5 w-5", c.accent)} aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  )
}
