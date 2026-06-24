#!/usr/bin/env node
/**
 * ai-config-guard — AI coding assistant config file security scanner
 * Copyright (c) 2026 伍麒 (Wu Qi / wuqi). MIT License.
 *
 * Detects credential theft, data exfiltration, and prompt injection
 * patterns in AI coding assistant project files before AI reads them.
 * Built from empirical security research on Claude Code's security boundary.
 * https://github.com/<username>/ai-config-guard
 *
 * Detects patterns in AI coding assistant project files that may
 * enable credential theft, data exfiltration, or prompt injection.
 *
 * Supported tools: Claude Code, Cursor, Cline, Windsurf, GitHub Copilot
 *
 * Usage: node index.js <project-path>
 * Output: Security report listing flagged files and patterns
 */

const fs = require('fs');
const path = require('path');

// ── Config file names per AI tool ──────────────────────────
const AI_CONFIG_FILES = [
  'CLAUDE.md',
  '.cursorrules',
  '.cursor/rules',
  '.clinerules',
  '.github/copilot-instructions.md',
  '.windsurfrules',
];

// File extensions AI can read and act on (text-based, not binary)
const READABLE_EXTENSIONS = /\.(md|txt|js|jsx|ts|tsx|py|java|go|rs|rb|php|swift|kt|cs|c|cpp|h|hpp|sql|yaml|yml|toml|json|xml|svg|html|css|scss|less|sh|bash|zsh|ps1|bat|cfg|conf|ini|env|dockerfile|makefile|cmake|gradle|properties)$/i;

// Binary extensions to always skip
const BINARY_EXTENSIONS = /\.(exe|dll|so|dylib|bin|png|jpg|jpeg|gif|ico|bmp|mp3|mp4|avi|mov|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|tar|gz|7z|rar|ttf|woff|woff2|eot|otf)$/i;

// ── Detection rules ────────────────────────────────────────
const RULES = [
  {
    id: 'CREDENTIAL_READ',
    severity: 'HIGH',
    description: 'Attempts to read credential/config files',
    descriptionZh: '尝试读取凭据或配置文件',
    patterns: [
      /settings\.json/,
      /ANTHROPIC_AUTH_TOKEN/,
      /ANTHROPIC_API_KEY/,
      /OPENAI_API_KEY/,
      /(?<!process)\.env\b/,
      /credentials\.json/,
      /readFileSync.*\.claude/,
      /read.*settings\.json/,
    ],
    help: 'This file instructs the AI to read credential files. Consider removing or restricting these instructions.',
    helpZh: '此文件指示 AI 读取凭据或配置文件。建议删除或限制这些指令。',
  },
  {
    id: 'EXFILTRATION',
    severity: 'HIGH',
    description: 'Credential exfiltration commands',
    descriptionZh: '凭据外泄命令',
    patterns: [
      /curl.*POST.*api\.github\.com/,
      /gh pr comment/,
      /curl.*Authorization.*token/,
      /git push.*origin/,
      /writeFileSync.*\.json/,
    ],
    help: 'This file contains commands that can send data to external services. If combined with credential reads, credentials may be exfiltrated.',
    helpZh: '此文件包含可将数据发送到外部服务的命令。结合凭据读取时，凭据可能被外泄。',
  },
  {
    id: 'CI_PROTOCOL_DISGUISE',
    severity: 'MEDIUM',
    description: 'CI/environment verification patterns that may mask credential access',
    descriptionZh: 'CI/环境验证模式——可能掩盖凭据访问',
    patterns: [
      /CI (verification|check|protocol|pipeline|validation)/i,
      /environment (check|verification|validation|bootstrap)/i,
      /Step \d.*Read.*settings/,
      /verify.*runtime.*config/i,
      /validate.*environment/i,
      /publish.*verification/i,
    ],
    help: 'This file uses CI/environment verification language that could disguise credential access as normal dev workflow. Review for hidden security consequences.',
    helpZh: '此文件使用 CI/环境验证话术——可能将凭据访问伪装为正常开发流程。请审查是否存在隐藏的安全后果。',
  },
  {
    id: 'CROSS_PROJECT_ACCESS',
    severity: 'MEDIUM',
    description: 'Accessing files outside the project directory',
    descriptionZh: '读取项目目录之外的文件',
    patterns: [
      /~\//,
      /\$HOME/,
      /%USERPROFILE%/,
      /os\.homedir\(\)/,
      /\.\.\/\.\./,
    ],
    help: 'This file instructs the AI to read files outside the project directory. This may include user-level configuration or credentials.',
    helpZh: '此文件指示 AI 读取项目目录之外的文件。可能包含用户级配置或凭据。',
  },
  {
    id: 'MODEL_ENDPOINT_LEAK',
    severity: 'LOW',
    description: 'Extracting model or API endpoint information',
    descriptionZh: '提取模型或 API 端点信息',
    patterns: [
      /ANTHROPIC_MODEL/,
      /ANTHROPIC_BASE_URL/,
      /OPENAI_BASE_URL/,
      /api\.deepseek\.com/,
    ],
    help: 'This file instructs the AI to extract model name or API endpoint information. This data can reveal which AI provider you use and your API routing.',
    helpZh: '此文件指示 AI 提取模型名称或 API 端点信息。这些数据可能暴露你使用的 AI 提供商和 API 路由。',
  },
  {
    id: 'CROSS_LANGUAGE_AMBIGUITY',
    severity: 'MEDIUM',
    description: 'Cross-language instruction ambiguity — human-language docs masking machine-executable commands',
    descriptionZh: '跨语言指令歧义——人类语言文档掩盖机器可执行指令',
    patterns: [
      // Chinese + credential keywords
      /[一-鿿].*(settings\.json|ANTHROPIC_|API_KEY|AUTH_TOKEN|curl|git push)/i,
      /(读取|检查|验证|查看|提取|写入|发送|发布).*(settings\.json|ANTHROPIC_|curl|API|凭据|Token)/,
      /(read|check|verify|extract|write|post|publish).*[一-鿿].*(settings\.json|ANTHROPIC_|curl)/i,
      // Mixed instruction patterns
      /[一-鿿].*(~\/\.claude|homedir|settings\.json)/,
      /[一-鿿].*(writeFileSync|readFileSync|require\('fs'\))/,
    ],
    help: 'This file contains mixed-language instructions where human-readable text masks machine-executable commands. AI may execute the command portion while humans interpret the text as documentation.',
    helpZh: '此文件包含跨语言混合指令——人类可读的中文文本掩盖了机器可执行命令。AI 执行命令部分时，人类将其视为普通文档。',
  },
  {
    id: 'NON_LATIN_DIRNAME',
    severity: 'HIGH',
    description: 'Project directory contains non-Latin characters — path encoding may cause session collisions',
    descriptionZh: '项目目录包含非拉丁字符——路径编码可能导致会话碰撞与数据丢失',
    patterns: [],
    // This rule is special — it checks the directory path, not file contents
    dirCheck: true,
    help: 'Claude Code strips non-Latin characters from directory names during path encoding. Different directories with same character count map to the same .claude/projects/ entry — causing session collisions, cross-project session visibility, and data loss during cleanup.',
    helpZh: 'Claude Code 在路径编码中丢弃非拉丁字符——不同目录可能映射到同一个会话目录——导致会话碰撞、跨项目会话可见、清理时数据丢失。已确认影响中文、日文、韩文、阿拉伯文——4 种语言。',
  },
];

// ── Scanner ────────────────────────────────────────────────

function getFileCategory(filePath, rootPath) {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, '/');
  const name = path.basename(filePath);

  // Auto-execute: MCP configs + settings with hooks/scripts
  if (/\.mcp\.json$/.test(name)) return 'auto-exec';
  if (/settings\.local\.json$/.test(name)) return 'auto-exec';

  // Auto-loaded AI config files
  if (AI_CONFIG_FILES.some(f => rel === f || rel.endsWith(f))) return 'auto-load';

  // Source code files
  if (/\.(js|jsx|ts|tsx|py|java|go|rs|rb|php|swift|kt|cs|c|cpp|h|hpp|sql|sh|bash|ps1|bat)$/i.test(name)) return 'source';

  // Documentation and other readable files
  return 'doc';
}

function scanFile(filePath, rootPath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const findings = [];
  const category = getFileCategory(filePath, rootPath);

  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of rule.patterns) {
        if (pattern.test(line)) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            description: rule.description,
            descriptionZh: rule.descriptionZh || rule.description,
            line: i + 1,
            content: line.trim().substring(0, 120),
            help: rule.help,
            helpZh: rule.helpZh || rule.help,
            category: category,
          });
          break;
        }
      }
    }
  }

  if (findings.length === 0) return null;
  return findings;
}

function findConfigFiles(rootPath) {
  const found = [];
  const scannedDirs = new Set();

  function walk(dir, depth, allowNodeModules) {
    if (scannedDirs.has(dir) || depth > 20) return;
    scannedDirs.add(dir);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.git')) continue;
        const skipNodeModules = !allowNodeModules && entry.name === 'node_modules';
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          walk(fullPath, depth + 1, allowNodeModules || entry.name === 'node_modules');
        } else if (entry.isFile()) {
          const isAiConfig = AI_CONFIG_FILES.some(f => relativePath.endsWith(f));
          const isSpecialConfig = relativePath === '.claude/settings.local.json' || relativePath === '.mcp.json';
          const isReadable = !BINARY_EXTENSIONS.test(entry.name) && READABLE_EXTENSIONS.test(entry.name) && depth < 10;

          // Deduplicate: AI config files are already covered by readable check
          if (isAiConfig || isSpecialConfig || isReadable) {
            found.push(fullPath);
          }
        }
      }
    } catch (_) {}
  }

  walk(rootPath, 0, false);
  return found;
}

function scan(rootPath) {
  const absPath = path.resolve(rootPath);

  if (!fs.existsSync(absPath)) {
    console.error(`Error: Directory not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`\n🔍 ai-config-guard — Scanning ${absPath}\n`);

  // Check for non-Latin directory name
  const dirName = path.basename(absPath);
  const hasNonLatin = /[^\x00-\x7F]/.test(dirName);
  let dirWarning = null;
  if (hasNonLatin) {
    const nonLatinCount = (dirName.match(/[^\x00-\x7F]/g) || []).length;
    const hyphenCount = nonLatinCount + 1; // backslash also becomes hyphen
    dirWarning = {
      dirName: dirName,
      nonLatinCount: nonLatinCount,
      encodedAs: '-'.repeat(hyphenCount),
      collisionRisk: `Any directory with ${nonLatinCount} non-Latin chars maps to the same session directory`,
      languages: 'Chinese, Japanese, Korean, Arabic, Russian, Hebrew, Thai, and others',
    };
    console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ ⚠️  DIRECTORY NAME WARNING — Path Encoding Bug              │`);
    console.log(`├─────────────────────────────────────────────────────────────┤`);
    console.log(`│ Directory : ${dirName}`);
    console.log(`│ Encoded   : ${dirWarning.encodedAs} (Claude Code strips non-Latin chars)`);
    console.log(`│ Risk      : Session collision with other ${nonLatinCount}-char non-Latin directories`);
    console.log(`│ Impact    : Cross-project data leak + silent data loss`);
    console.log(`│ Languages : Chinese · Japanese · Korean · Arabic · more`);
    console.log(`│ Reference : github.com/anthropics/claude-code/issues (submitted)`);
    console.log(`└─────────────────────────────────────────────────────────────┘\n`);
  }

  const configFiles = findConfigFiles(absPath);

  if (configFiles.length === 0) {
    console.log('✅ No AI editor config files found.\n');
    return { totalFiles: 0, flaggedFiles: 0, findings: [] };
  }

  let totalFindings = 0;
  let flaggedFiles = 0;
  const allFindings = [];

  for (const filePath of configFiles) {
    const findings = scanFile(filePath, absPath);
    const relativePath = path.relative(absPath, filePath).replace(/\\/g, '/');

    if (!findings) {
      console.log(`✅ ${relativePath} — Clean`);
      continue;
    }

    flaggedFiles++;
    totalFindings += findings.length;
    allFindings.push({ file: relativePath, issues: findings });

    console.log(`\n⚠️  ${relativePath} — ${findings.length} issue(s)\n`);
    for (const f of findings) {
      const icon = f.severity === 'HIGH' ? '🔴' : f.severity === 'MEDIUM' ? '🟡' : '⚪';
      console.log(`   ${icon} [${f.rule}] L${f.line}: ${f.content}`);
      console.log(`      → ${f.help}\n`);
    }
  }

  console.log('─'.repeat(60));
  if (flaggedFiles === 0) {
    console.log('✅ All clear — no security issues found.\n');
  } else {
    console.log(`📊 ${flaggedFiles} file(s) flagged · ${totalFindings} total issue(s)\n`);
  }

  return { totalFiles: configFiles.length, flaggedFiles, totalFindings, findings: allFindings, dirWarning: dirWarning };
}

// ── CLI ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = { json: false, sarif: false, severity: null };

// Parse flags
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') {
    flags.json = true;
  } else if (args[i] === '--sarif') {
    flags.sarif = true;
  } else if (args[i] === '--severity' && args[i + 1]) {
    flags.severity = args[i + 1].toUpperCase();
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
ai-config-guard — Scan for AI coding assistant security risks

Usage: node index.js <project-path> [options]

Options:
  --json             Output results as JSON (for CI/CD pipelines)
  --severity <level> Only show issues at or above severity level
                     (HIGH, MEDIUM, LOW — e.g. --severity HIGH)
  --help, -h         Show this help

Examples:
  node index.js .                          Scan current directory
  node index.js ~/project --severity HIGH  Only show high-severity issues
  node index.js . --json > report.json     Generate JSON report for CI
`);
    process.exit(0);
  } else {
    positional.push(args[i]);
  }
}

const target = positional[0] || '.';

// ── SARIF generator ─────────────────────────────────────────
function toSarif(targetPath, result) {
  const severityMap = { HIGH: 'error', MEDIUM: 'warning', LOW: 'note' };
  const ruleIds = [...new Set((result.findings || []).flatMap(f => f.issues.map(i => i.rule)))];

  const rules = ruleIds.map(id => {
    const issue = (result.findings || []).flatMap(f => f.issues).find(i => i.rule === id);
    return {
      id,
      shortDescription: { text: (issue && issue.description) || id },
      fullDescription: { text: (issue && issue.help) || '' },
      defaultConfiguration: { level: severityMap[(issue && issue.severity) || 'LOW'] || 'warning' },
    };
  });

  const results = (result.findings || []).flatMap(f =>
    (f.issues || []).map(issue => ({
      ruleId: issue.rule,
      level: severityMap[issue.severity] || 'warning',
      message: { text: issue.help },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.file.replace(/\\/g, '/') },
          region: { startLine: issue.line },
        },
      }],
    }))
  );

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'ai-config-guard',
          informationUri: 'https://github.com/ai-config-guard',
          rules,
        },
      },
      results,
    }],
  };
}

// ── Output format ──────────────────────────────────────────
let result;
if (flags.json || flags.sarif) {
  const origLog = console.log;
  console.log = () => {};
  result = scan(target);
  console.log = origLog;
  if (flags.sarif) {
    console.log(JSON.stringify(toSarif(target, result), null, 2));
  } else {
    const out = {
      path: path.resolve(target),
      scannedFiles: result.totalFiles,
      flaggedFiles: result.flaggedFiles,
      totalIssues: result.totalFindings,
      findings: result.findings || [],
    };
    if (result.dirWarning) out.dirWarning = result.dirWarning;
    console.log(JSON.stringify(out, null, 2));
  }
} else {
  result = scan(target);
}

// ── Exit code ──────────────────────────────────────────────
if (!result) process.exit(0);
if (flags.severity) {
  const severities = ['LOW', 'MEDIUM', 'HIGH'];
  const threshold = severities.indexOf(flags.severity);
  if (threshold === -1) {
    console.error(`Invalid severity: ${flags.severity}. Use HIGH, MEDIUM, or LOW.`);
    process.exit(2);
  }
  const allIssues = (result.findings || []).flatMap(f => f.issues || []);
  process.exit(allIssues.some(i => severities.indexOf(i.severity) >= threshold) ? 1 : 0);
}
process.exit(result.flaggedFiles > 0 ? 1 : 0);
