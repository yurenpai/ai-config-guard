"use client"

import { ChevronDown, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"
import { SeverityBadge } from "@/components/severity-badge"
import type { Lang, ScannedFile, Severity } from "@/lib/scan-data"
import { t } from "@/lib/scan-data"

const sevLabel = (lang: Lang, s: Severity) =>
  s === "high" ? t[lang].sevHigh : s === "medium" ? t[lang].sevMedium : t[lang].sevLow

export function FileCard({
  file,
  open,
  onToggle,
  lang,
}: {
  file: ScannedFile
  open: boolean
  onToggle: () => void
  lang: Lang
}) {
  const tr = t[lang]
  const highCount = file.findings.filter((f: any) => f.severity === "high").length
  const cat: string = (file.findings[0] as any)?.category || 'doc'
  // auto-exec > auto-load > source > doc
  const bestCat = file.findings.some((f: any) => f.category === 'auto-exec') ? 'auto-exec'
    : file.findings.some((f: any) => f.category === 'auto-load') ? 'auto-load'
    : file.findings.some((f: any) => f.category === 'source') ? 'source' : 'doc'
  const catLabel = bestCat === 'auto-exec' ? (lang === 'zh' ? '自动执行' : 'Exec')
    : bestCat === 'auto-load' ? (lang === 'zh' ? '自动加载' : 'Auto')
    : bestCat === 'source' ? (lang === 'zh' ? '源码' : 'Src')
    : (lang === 'zh' ? '可读文件' : 'Doc')
  const catColor = bestCat === 'auto-exec' ? 'border-destructive text-destructive bg-destructive/10'
    : bestCat === 'auto-load' ? 'border-sev-high/50 text-sev-high bg-sev-high/10'
    : bestCat === 'source' ? 'border-sev-medium/50 text-sev-medium bg-sev-medium/10'
    : 'border-border text-muted-foreground bg-secondary'

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-accent/50 active:bg-accent/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
        <FileCode className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="truncate font-mono text-sm text-foreground">{file.path}</span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${catColor}`}>{catLabel}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {highCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sev-high/15 px-1.5 text-xs font-semibold text-sev-high">
              {highCount}
            </span>
          )}
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {file.findings.length} {tr.issues}
          </span>
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {file.findings.map((f) => (
            <li key={f.id} className="px-4 py-3.5 transition-colors duration-100 hover:bg-accent/30">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={f.severity} label={sevLabel(lang, f.severity)} />
                <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
                  {f.rule}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {tr.line}
                  {f.line}
                </span>
              </div>
              <pre className="mt-2.5 overflow-x-auto rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
                <code>{f.code}</code>
              </pre>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {lang === "zh" ? f.suggestion : f.suggestionEn}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
