"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { Check, Copy, Download, FolderOpen, Languages, Loader2, Moon, Search, ShieldCheck, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatCards } from "@/components/stat-cards"
import { FileCard } from "@/components/file-card"
import { type Lang, type Severity, type ScannedFile, type RealScanResult, t } from "@/lib/scan-data"

type Filter = "all" | Severity

function transform(raw: RealScanResult): ScannedFile[] {
  return (raw.findings || []).map((f, fi) => ({
    id: `f${fi}`, path: f.file,
    findings: (f.issues || []).map((iss, ii) => ({
      id: `f${fi}-${ii}`,
      severity: iss.severity.toLowerCase() as Severity,
      rule: iss.rule, line: iss.line, code: iss.content,
      suggestion: iss.helpZh || iss.help, suggestionEn: iss.help,
      category: (iss as any).category || 'doc',
    })),
  }))
}

export function ScannerDashboard() {
  const [lang, setLang] = useState<Lang>("zh")
  const [path, setPath] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [data, setData] = useState<ScannedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [rawResult, setRawResult] = useState<RealScanResult | null>(null)
  const [dark, setDark] = useState(true)
  const [error, setError] = useState("")
  const [scannedAt, setScannedAt] = useState("")
  const [copied, setCopied] = useState(false)
  const [showClean, setShowClean] = useState(false)
  const [catFilter, setCatFilter] = useState("all") // all | auto-load | source | doc

  useEffect(() => {
    const root = document.documentElement
    dark ? root.classList.add('dark') : root.classList.remove('dark')
    localStorage.setItem('ai-config-guard-theme', dark ? 'dark' : 'light')
  }, [dark])

  const tr = t[lang]

  const doScan = useCallback(async (p: string) => {
    const target = p.trim()
    if (!target) { setError(lang === 'zh' ? '请输入目录路径' : 'Enter a directory path'); return }
    setError(""); setLoading(true); setData([])
    try {
      const res = await fetch(`/api/scan?path=${encodeURIComponent(target)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: RealScanResult = await res.json()
      if (json.error) throw new Error(json.error)
      setRawResult(json); setPath(json.path || target); setScannedAt(new Date().toLocaleTimeString())
      const files = transform(json); setData(files)
      setOpenIds(new Set(files.map(f => f.id)))
      setError("")
    } catch (e: any) {
      setError(e.message || 'Scan failed'); setData([]); setRawResult(null)
    } finally { setLoading(false) }
  }, [lang])

  const counts = useMemo(() => {
    let high = 0, medium = 0, low = 0
    for (const file of data) for (const f of file.findings) {
      if (f.severity === "high") high++
      else if (f.severity === "medium") medium++
      else low++
    }
    return { all: high + medium + low, high, medium, low }
  }, [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.map(file => {
      const findings = file.findings.filter(f => {
        if (filter !== "all" && f.severity !== filter) return false
        if (catFilter !== "all" && (f as any).category !== catFilter) return false
        if (!q) return true
        return file.path.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.rule.toLowerCase().includes(q) || f.suggestion.toLowerCase().includes(q)
      })
      return { ...file, findings }
    }).filter(file => file.findings.length > 0)
  }, [query, filter, catFilter, data])

  // Folder upload (desktop only)
  const handleFolderUpload = useCallback(async (fileList: FileList) => {
    setLoading(true); setData([])
    try {
      const fd = new FormData()
      const files = Array.from(fileList)
      fd.append('dirname', files[0]?.webkitRelativePath?.split('/')[0] || 'project')
      files.forEach(f => fd.append('files', f))
      const res = await fetch('/api/scan', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: RealScanResult = await res.json()
      if (json.error) throw new Error(json.error)
      setRawResult(json); setPath(json.path || ''); setScannedAt(new Date().toLocaleTimeString())
      const files2 = transform(json); setData(files2)
      setOpenIds(new Set(files2.map(f => f.id))); setError("")
    } catch (e: any) { setError(e.message || 'Upload failed'); setData([]) }
    finally { setLoading(false) }
  }, [])

  const stats = useMemo(() => ({
    scanned: rawResult?.scannedFiles || data.length,
    issueFiles: rawResult?.flaggedFiles || data.filter(f => f.findings.length > 0).length,
    totalIssues: rawResult?.totalIssues || counts.all,
  }), [rawResult, data, counts.all])

  const toggle = (id: string) => setOpenIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll = () => setOpenIds(new Set(filtered.map(f => f.id)))
  const collapseAll = () => setOpenIds(new Set())
  const exportJson = () => download(JSON.stringify(rawResult || data, null, 2), 'report.json', 'application/json')
  const exportSarif = () => {
    const r = rawResult; if (!r) return
    const sev = { HIGH: 'error', MEDIUM: 'warning', LOW: 'note' }
    const rules = [...new Set((r.findings||[]).flatMap(f=>f.issues.map(i=>i.rule)))].map(id => {
      const iss = (r.findings||[]).flatMap(f=>f.issues).find(i=>i.rule===id)
      return { id, shortDescription:{text:iss?.description||id}, defaultConfiguration:{level:sev[iss?.severity||'LOW']||'warning'} }
    })
    const results = (r.findings||[]).flatMap(f=>f.issues.map(i=>({
      ruleId:i.rule, level:sev[i.severity]||'warning', message:{text:i.help},
      locations:[{physicalLocation:{artifactLocation:{uri:f.file.replace(/\\/g,'/')},region:{startLine:i.line}}}]
    })))
    download(JSON.stringify({$schema:'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',version:'2.1.0',runs:[{tool:{driver:{name:'ai-config-guard'}},results}]},null,2), 'ai-config-guard-results.sarif', 'application/sarif+json')
  }
  function download(content: string, filename: string, mime: string) {
    const b = new Blob([content], { type: mime }); const a = document.createElement("a")
    a.href = URL.createObjectURL(b); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
  }

  const FILTERS = [
    { k: "all" as Filter, l: tr.filterAll, n: counts.all, c: "bg-brand" },
    { k: "high" as Filter, l: tr.filterHigh, n: counts.high, c: "bg-sev-high" },
    { k: "medium" as Filter, l: tr.filterMedium, n: counts.medium, c: "bg-sev-medium" },
    { k: "low" as Filter, l: tr.filterLow, n: counts.low, c: "bg-sev-low" },
  ]

  const btn = "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:hover:scale-100 transition-all duration-150"

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/10"><ShieldCheck className="h-5 w-5 text-brand" /></div>
            <div>
              <span className="text-base font-semibold text-foreground">{tr.appName}</span>
              <p className="text-xs text-muted-foreground">{lang === 'zh' ? 'AI 编码助手项目文件安全扫描器' : 'AI Coding Assistant Config File Security Scanner'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDark(!dark)} className={btn} title={dark ? "浅色" : "深色"}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setLang(l => l === "zh" ? "en" : "zh")} className={btn}>
              <Languages className="h-4 w-4" />{lang === "zh" ? "EN" : "中文"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Scan bar */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={path} onChange={e => { setPath(e.target.value); setError("") }}
              onKeyDown={e => e.key === 'Enter' && doScan(path)}
              placeholder="C:\Users\...\project"
              className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(path); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="shrink-0 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title={lang === 'zh' ? '复制路径' : 'Copy path'}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <input type="file" id="folderUpload" className="hidden" webkitdirectory="" directory="" onChange={e => {
            if (e.target.files?.length) handleFolderUpload(e.target.files);
          }} />
          <button onClick={() => document.getElementById('folderUpload')?.click()} disabled={loading}
            className="shrink-0 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 transition-colors hidden sm:inline-flex"
            title={lang === 'zh' ? '选择文件夹上传扫描' : 'Choose folder to upload and scan'}>
            📂
          </button>
          <button onClick={() => doScan(path)} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none transition-all duration-150">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "..." : tr.scan}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-1.5">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {scannedAt && <p className="text-xs text-muted-foreground">{lang === 'zh' ? '上次扫描' : 'Last scan'}: {scannedAt}</p>}
        </div>

        {/* Directory name warning */}
        {rawResult?.dirWarning && (
          <div className="mt-4 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="min-w-0">
                <p className="font-semibold text-destructive text-sm">
                  {lang === 'zh' ? '目录名包含非拉丁字符 —— 会话数据有风险' : 'Directory name has non-Latin chars — session data at risk'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 break-all">
                  {lang === 'zh'
                    ? `"${rawResult.dirWarning.dirName}" 将被 Claude Code 路径编码为 "${rawResult.dirWarning.encodedAs}"（${rawResult.dirWarning.nonLatinCount} 个非拉丁字符 → 等长连字符）。相同字符数的非拉丁目录会映射到同一个会话目录 —— 可能导致会话碰撞、跨项目数据泄露、清理时无声丢失。`
                    : `"${rawResult.dirWarning.dirName}" is encoded as "${rawResult.dirWarning.encodedAs}" — any other directory with ${rawResult.dirWarning.nonLatinCount} non-Latin chars collides to the same session dir. Risk: cross-project data leak + silent data loss.`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  🌍 {rawResult.dirWarning.languages}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
              {FILTERS.map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-all",
                    filter === f.k
                      ? f.k === 'high' ? "bg-sev-high/20 text-sev-high ring-1 ring-sev-high/40"
                      : f.k === 'medium' ? "bg-sev-medium/20 text-sev-medium ring-1 ring-sev-medium/40"
                      : f.k === 'low' ? "bg-sev-low/20 text-sev-low ring-1 ring-sev-low/40"
                      : "bg-brand/20 text-brand ring-1 ring-brand/40"
                      : "text-muted-foreground hover:text-foreground")}>
                  <span className={cn("h-2 w-2 rounded-full", f.c)} />{f.l}
                  <span className="font-mono text-xs opacity-70">{f.n}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
              {[{k:'all',l:lang==='zh'?'全部':'All',c:''},{k:'auto-exec',l:lang==='zh'?'自动执行':'Exec',c:'text-destructive'},{k:'auto-load',l:lang==='zh'?'自动加载':'Auto',c:'text-sev-high'},{k:'source',l:lang==='zh'?'源码':'Src',c:'text-sev-medium'},{k:'doc',l:lang==='zh'?'可读':'Doc',c:'text-muted-foreground'}].map(cf => (
                <button key={cf.k} onClick={() => setCatFilter(cf.k)}
                  className={cn("rounded px-2 py-1 text-xs transition-all", catFilter===cf.k ? `bg-secondary font-medium ${cf.c}` : "text-muted-foreground hover:text-foreground")}>
                  {cf.k !== 'all' && <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", cf.k === 'auto-exec' ? 'bg-destructive' : cf.k === 'auto-load' ? 'bg-sev-high' : cf.k === 'source' ? 'bg-sev-medium' : 'bg-muted-foreground')} />}
                  {cf.l}
                </button>
              ))}
            </div>
            <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr.searchPlaceholder}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className={btn}>展开全部</button>
              <button onClick={collapseAll} className={btn}>收起全部</button>
              <button onClick={exportJson} className={btn}><Download className="h-4 w-4" />JSON</button>
              <button onClick={exportSarif} className={btn}><Download className="h-4 w-4" />SARIF</button>
            </div>
          </div>

        {/* Stats */}
          <div className="mt-6">
            <StatCards scanned={stats.scanned} issueFiles={stats.issueFiles} totalIssues={stats.totalIssues}
              labels={{ scanned: tr.statScanned, issueFiles: tr.statIssueFiles, totalIssues: tr.statTotalIssues }} />
          </div>

        {/* Results */}
        <div className="mt-4 flex flex-col gap-3 pb-12">
          {loading ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="inline h-5 w-5 animate-spin mr-2" />{lang === 'zh' ? '扫描中...' : 'Scanning...'}
            </div>
          ) : rawResult && data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-medium text-success">{lang === 'zh' ? '未发现安全问题' : 'No security issues found'}</p>
              <p className="text-xs text-muted-foreground mt-1">{lang === 'zh' ? `已扫描 ${rawResult.scannedFiles} 个文件` : `Scanned ${rawResult.scannedFiles} files`}</p>
            </div>
          ) : !rawResult && !error && !loading ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm text-muted-foreground mb-3">
                {lang === 'zh'
                  ? '输入项目路径或选择文件夹，扫描 AI 配置文件中的安全隐患'
                  : 'Enter a project path or choose a folder to scan for AI config security issues'}
              </p>
              <button onClick={() => doScan('C:\\Users\\34776\\Desktop\\scanner-demo')}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors">
                💡 {lang === 'zh' ? '加载示例项目' : 'Load demo project'}
              </button>
            </div>
          ) : filtered.length === 0 && data.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center text-sm text-muted-foreground">{tr.noResults}</div>
          ) : (
            filtered.map(file => <FileCard key={file.id} file={file} open={openIds.has(file.id)} onToggle={() => toggle(file.id)} lang={lang} />)
          )}
        </div>
      </main>
    </div>
  )
}
