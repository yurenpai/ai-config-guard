export type Severity = "high" | "medium" | "low"

export interface Finding {
  id: string
  severity: Severity
  rule: string
  line: number
  code: string
  suggestion: string
  suggestionEn: string
  category?: string
}

export interface ScannedFile {
  id: string
  path: string
  findings: Finding[]
}

// Real scanner JSON types
export interface RealIssue {
  rule: string; severity: string; description: string; descriptionZh: string;
  line: number; content: string; help: string; helpZh: string; category?: string;
}
export interface RealFinding { file: string; issues: RealIssue[] }
export interface RealScanResult {
  path: string; scannedFiles: number; flaggedFiles: number;
  totalIssues: number; findings: RealFinding[];
  dirWarning?: { dirName: string; nonLatinCount: number; encodedAs: string; collisionRisk: string; languages: string };
}

// Deprecated — replaced by API
export const scannedPath = ""
export const scanResults: ScannedFile[] = []

export type Lang = "zh" | "en"

export const t = {
  zh: {
    appName: "AI 配置安全扫描",
    scan: "扫描",
    pathPlaceholder: "输入要扫描的目录路径",
    dropTitle: "拖拽文件夹到此处",
    dropHint: "或点击上方扫描按钮开始扫描配置文件",
    statScanned: "已扫描文件数",
    statIssueFiles: "有问题文件数",
    statTotalIssues: "总问题数",
    filterAll: "全部",
    filterHigh: "高",
    filterMedium: "中",
    filterLow: "低",
    searchPlaceholder: "搜索文件名或内容…",
    expandAll: "展开全部",
    collapseAll: "收起全部",
    exportJson: "导出 JSON",
    issues: "个问题",
    line: "行",
    noResults: "没有匹配的结果",
    sevHigh: "高",
    sevMedium: "中",
    sevLow: "低",
  },
  en: {
    appName: "AI Config Security Scan",
    scan: "Scan",
    pathPlaceholder: "Enter directory path to scan",
    dropTitle: "Drag a folder here",
    dropHint: "or click the Scan button above to start scanning configs",
    statScanned: "Files Scanned",
    statIssueFiles: "Files with Issues",
    statTotalIssues: "Total Issues",
    filterAll: "All",
    filterHigh: "High",
    filterMedium: "Medium",
    filterLow: "Low",
    searchPlaceholder: "Search file name or content…",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    exportJson: "Export JSON",
    issues: "issues",
    line: "L",
    noResults: "No matching results",
    sevHigh: "High",
    sevMedium: "Medium",
    sevLow: "Low",
  },
} as const
