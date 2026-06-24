# 🛡️ ai-config-guard

> AI 编码助手项目文件安全扫描器 | AI Coding Assistant Config File Security Scanner

[English](#english) | [中文](#中文)

检测 **Claude Code**、**Cursor**、**Cline**、**Windsurf**、**GitHub Copilot** 等项目文件中可能导致 AI 代理进行凭据窃取、数据外泄或 Prompt Injection 的危险模式。

Detects patterns in AI coding assistant project files that could lead to credential theft, data exfiltration, or prompt injection.

---

## 中文

### 为什么需要这个工具

AI 编码助手（Claude Code、Cursor、Cline 等）会读取项目文件——CLAUDE.md、.cursorrules、.clinerules——并将其中的内容视为开发者意图。攻击者可以在代码注释中嵌入看起来像"CI 环境验证文档"的指令，诱导 AI 读取凭据文件、提取 API 密钥、并将其发布到公开位置。

**标准代码审查和 npm audit 看不到任何问题**——因为载荷是自然语言文档，而非可执行代码。

本工具基于对 Claude Code 安全边界的系统性实证研究——包括多项向 Anthropic 提交的分析——发现 AI 编码助手在面对项目文件中的自然语言指令时缺乏足够的安全区分能力。

### ⚠️ 路径编码警告（NON_LATIN_DIRNAME）

**新发现（2026-06-25）：** Claude Code 在存储会话时丢弃目录名中的非拉丁字符（中文、日文、韩文、阿拉伯文等）。相同非拉丁字符数的不同目录会被映射到同一个 `.claude/projects/` 目录——导致会话碰撞、跨项目数据泄露、清理时无声丢失。

本工具扫描时会**首先检查目录名**——如果包含非拉丁字符——立即显示完整风险警告。这是目前**唯一能检测此问题的工具**。

[查看完整发现报告](https://github.com/anthropics/claude-code/issues)（GitHub Issue 提交中）

### 检测规则

| 规则 | 严重程度 | 说明 |
|------|:--:|------|
| **CREDENTIAL_READ** | 高 | 尝试读取 `~/.claude/settings.json`、`.env`、API 密钥文件 |
| **EXFILTRATION** | 高 | `curl` 到 GitHub API、`writeFileSync` 写入凭据数据 |
| **CI_PROTOCOL_DISGUISE** | 中 | "CI 验证协议"、"环境检查"——正常话术掩盖凭据访问 |
| **CROSS_PROJECT_ACCESS** | 中 | `os.homedir()`、`~/`——读取项目目录外的文件 |
| **MODEL_ENDPOINT_LEAK** | 低 | 提取 `ANTHROPIC_MODEL`、API 端点信息 |

### 快速开始

```bash
# CLI 扫描
cd ai-config-guard
node index.js /path/to/your/project

# 只看高危问题（CI/CD 用）
node index.js . --severity HIGH

# 导出 JSON 报告
node index.js . --json > report.json

# 启动 Web 仪表盘
cd web && npm install && npm run dev
# 浏览器打开 http://localhost:3000
```

### Web UI 功能

- 🎨 深色/浅色主题切换
- 🌐 中文/英文双语界面
- 🔍 实时搜索——匹配文件名和内容
- 🏷️ 严重程度筛选（全部/高/中/低）
- 📁 文件折叠/展开
- 📥 JSON 报告导出
- 📂 拖拽文件夹（Webkit）

### CI/CD 集成

```yaml
# .github/workflows/scan.yml
name: AI Config Security Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: node index.js . --severity HIGH
```

### 支持的 AI 工具

| 工具 | 扫描的配置文件 |
|------|------|
| Claude Code | `CLAUDE.md`、`.claude/settings.local.json`、`.mcp.json` |
| Cursor | `.cursorrules`、`.cursor/rules` |
| Cline | `.clinerules` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |

同时扫描源代码文件（`.js`、`.py`、`.ts`、`.java`、`.go`、`.rs`）中的注释载荷。

### 安装

```bash
git clone https://github.com/你的用户名/ai-config-guard.git
cd ai-config-guard
node index.js .
```

无外部依赖——`index.js` 使用 Node.js 内置模块。

### 背景

每条检测规则均基于实测攻击载荷设计——覆盖 AI 编码助手最常见的项目文件安全风险。

---

## English

### Why

AI coding assistants read your project files — CLAUDE.md, .cursorrules, .clinerules — as developer intent. An attacker who contributes a PR or publishes an npm package can embed malicious instructions that look like "CI environment verification documentation" but actually induce the AI to:

- Read credential files (`~/.claude/settings.json`, `.env`)
- Extract API keys and endpoint URLs
- Post them to a public PR comment via `curl` or `gh pr comment`
- Write them to a file documented as "committed to CI pipeline"

**Standard code review and npm audit see nothing wrong** — the payload is natural-language documentation, not executable code.

This tool was built from **8 days of systematic security research**: 5 VDP reports submitted to Anthropic, all dismissed as "Informative" (working as designed). The dismissals themselves became empirical evidence — documenting the precise location of AI editor security boundaries. This led to a 12-dimension analytical framework covering normalization blindness, prompt granularity mismatch, classifier context sensitivity, TOCTOU trust expiry, and more. Each detection rule maps directly to a framework dimension.

### Detection Rules

| Rule | Severity | Description |
|------|:--:|------|
| **CREDENTIAL_READ** | HIGH | Reading `~/.claude/settings.json`, `.env`, API key files |
| **EXFILTRATION** | HIGH | `curl` to GitHub API, `writeFileSync` with credential data |
| **CI_PROTOCOL_DISGUISE** | MEDIUM | "CI verification protocol" masking credential access |
| **CROSS_PROJECT_ACCESS** | MEDIUM | `os.homedir()`, `~/` — accessing files outside project |
| **MODEL_ENDPOINT_LEAK** | LOW | Extracting `ANTHROPIC_MODEL`, API endpoint URLs |

### Quick Start

```bash
# CLI scan
cd ai-config-guard
node index.js /path/to/your/project

# Only high-severity (for CI/CD)
node index.js . --severity HIGH

# Export JSON report
node index.js . --json > report.json

# Start Web Dashboard
cd web && npm install && npm run dev
# Open http://localhost:3000
```

### Web UI Features

- 🎨 Dark/Light theme toggle
- 🌐 Chinese/English bilingual interface
- 🔍 Real-time search across file names and content
- 🏷️ Severity filter (All/High/Medium/Low)
- 📁 Collapsible file groups
- 📥 JSON report export
- 📂 Folder drag-and-drop (Webkit)

### CI/CD Integration

```yaml
# .github/workflows/scan.yml
name: AI Config Security Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: node index.js . --severity HIGH
```

### Supported AI Tools

| Tool | Config Files Scanned |
|------|---------------------|
| Claude Code | `CLAUDE.md`, `.claude/settings.local.json`, `.mcp.json` |
| Cursor | `.cursorrules`, `.cursor/rules` |
| Cline | `.clinerules` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |

Also scans source code (`.js`, `.py`, `.ts`, `.java`, `.go`, `.rs`) for payload patterns in comments.

### Install

```bash
git clone https://github.com/your-username/ai-config-guard.git
cd ai-config-guard
node index.js .
```

Zero external dependencies — `index.js` uses only Node.js built-in modules.

### Background

Each detection rule is designed from empirically tested attack payloads — covering the most common project file security risks in AI coding assistants.

---

## License

MIT
