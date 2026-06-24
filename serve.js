/**
 * ai-config-guard Web UI v3
 * Start: node serve.js [project-path] [port]
 *
 * v3: Drag-drop folder · path input · live search · polished UX
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let targetPath = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let cachedData = null;
const PORT = process.argv[3] || 3000;

// ── Translation ────────────────────────────────────────────
const T = {
  zh: {
    title: 'AI 配置安全扫描',
    subtitle: '检测 AI 编码助手项目中的凭据窃取、数据外泄与 Prompt Injection 模式',
    scanTarget: '扫描目录',
    changeDir: '切换',
    dropHint: '拖拽文件夹到此处',
    or: '或输入路径',
    scan: '扫描',
    loading: '扫描中...',
    filesScanned: '已扫描',
    filesFlagged: '有问题',
    totalIssues: '总问题',
    allClear: '✅ 全部通过 — 未发现 AI 配置安全问题',
    noResults: '没有匹配的结果',
    severity: '严重程度',
    search: '搜索文件名或内容...',
    all: '全部',
    high: '高',
    medium: '中',
    low: '低',
    rescan: '🔄 重新扫描',
    exportJson: '📥 导出 JSON',
    ruleLabel: '规则',
    line: '行',
    credRead: '凭据读取',
    exfil: '数据外泄',
    ciDisguise: 'CI 伪装',
    crossProject: '跨项目访问',
    modelLeak: '端点泄露',
    fixHint: '建议：',
    expandAll: '展开全部',
    collapseAll: '收起全部',
    issuesFound: '{n} 个问题',
    footer: '基于 12 维 AI 编辑器安全框架 · 5 份 Anthropic VDP 实证',
  },
  en: {
    title: 'AI Config Security Scan',
    subtitle: 'Detects credential theft, data exfiltration & prompt injection in AI coding assistant projects',
    scanTarget: 'Scan target',
    changeDir: 'Change',
    dropHint: 'Drag & drop a folder here',
    or: 'or enter path',
    scan: 'Scan',
    loading: 'Scanning...',
    filesScanned: 'Scanned',
    filesFlagged: 'Flagged',
    totalIssues: 'Issues',
    allClear: '✅ All Clear — no AI config security issues found',
    noResults: 'No matching results',
    severity: 'Severity',
    search: 'Search file names or content...',
    all: 'All',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    rescan: '🔄 Re-scan',
    exportJson: '📥 Export JSON',
    ruleLabel: 'Rule',
    line: 'Line',
    credRead: 'Credential Read',
    exfil: 'Exfiltration',
    ciDisguise: 'CI Disguise',
    crossProject: 'Cross-Project',
    modelLeak: 'Endpoint Leak',
    fixHint: 'Fix: ',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    issuesFound: '{n} issues',
    footer: '12-dimension AI editor security framework · 5 Anthropic VDP submissions',
  },
};

const RULE_LABELS = {
  CREDENTIAL_READ: ['credRead'],
  EXFILTRATION: ['exfil'],
  CI_PROTOCOL_DISGUISE: ['ciDisguise'],
  CROSS_PROJECT_ACCESS: ['crossProject'],
  MODEL_ENDPOINT_LEAK: ['modelLeak'],
};

// ── Scanner ─────────────────────────────────────────────────
function runScan(dir) {
  try {
    const r = execSync(`node "${__dirname}/index.js" "${dir}" --json`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(r);
  } catch (e) {
    try { return JSON.parse(e.stdout); } catch (_) {
      return { error: e.message, path: dir, scannedFiles: 0, flaggedFiles: 0, totalIssues: 0, findings: [] };
    }
  }
}

// ── HTML ────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ai-config-guard</title>
<style>
:root {
  --bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;
  --muted:#8b949e;--blue:#58a6ff;--green:#3fb950;--red:#f85149;
  --orange:#d2991d;--accent:#1f6feb;--radius:8px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:.8rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem}
header h1{color:var(--blue);font-size:1.25rem}
.lang-switch{display:flex;gap:2px;background:var(--bg);border-radius:6px;padding:2px}
.lang-switch button{padding:.3rem .7rem;border:none;background:transparent;color:var(--muted);cursor:pointer;border-radius:4px;font-size:.78rem}
.lang-switch button.active{background:var(--accent);color:#fff}
.container{max-width:1200px;margin:0 auto;padding:1rem 1.5rem}
.top-bar{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem}
.path-box{flex:1;min-width:280px;display:flex;gap:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.path-box input{flex:1;background:transparent;border:none;color:var(--text);padding:.55rem .75rem;font-family:ui-monospace,SFMono-Regular,monospace;font-size:.85rem;outline:none}
.path-box button{background:var(--accent);color:#fff;border:none;padding:.55rem 1rem;cursor:pointer;font-size:.85rem;white-space:nowrap}
.path-box button:hover{opacity:.9}

.drop-zone{border:2px dashed var(--border);border-radius:var(--radius);padding:2rem;text-align:center;color:var(--muted);margin-bottom:1rem;transition:.2s;cursor:pointer}
.drop-zone.drag-over{border-color:var(--blue);background:rgba(88,166,255,.05);color:var(--blue)}
.drop-zone .drop-icon{font-size:2rem;margin-bottom:.5rem}
.drop-zone .drop-hint{font-size:.9rem}
.drop-zone input[type=file]{display:none}

.summary{display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem 1.2rem;text-align:center;min-width:110px;flex:1}
.stat .num{font-size:2rem;font-weight:700}
.stat .label{color:var(--muted);font-size:.8rem;margin-top:.2rem}
.stat.danger .num{color:var(--red)}
.stat.warn .num{color:var(--orange)}
.stat.ok .num{color:var(--green)}

.toolbar{display:flex;gap:.6rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center}
.sev-group{display:flex;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:2px}
.sev-group button{padding:.35rem .65rem;border:none;background:transparent;color:var(--muted);cursor:pointer;border-radius:4px;font-size:.78rem;white-space:nowrap;transition:.15s}
.sev-group button.active{color:#fff}
.sev-group button[data-s=HIGH].active{background:var(--red)}
.sev-group button[data-s=MEDIUM].active{background:var(--orange)}
.sev-group button[data-s=LOW].active{background:var(--muted)}
.sev-group button[data-s=ALL].active{background:var(--accent)}
.search-box{flex:1;min-width:200px;position:relative}
.search-box input{width:100%;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:.5rem .75rem;border-radius:var(--radius);font-size:.85rem;outline:none}
.search-box input:focus{border-color:var(--blue)}
.search-box .clear{position:absolute;right:.5rem;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;display:none}
.search-box .clear.visible{display:block}
.actions{display:flex;gap:.4rem}
.actions button{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:.45rem .8rem;border-radius:var(--radius);cursor:pointer;font-size:.82rem;white-space:nowrap;transition:.15s}
.actions button:hover{background:#1f242d}
.actions button.primary{background:var(--green);border-color:var(--green);color:#fff}
.actions button.primary:hover{opacity:.9}

.file-group{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:.5rem;transition:.15s}
.file-header{padding:.65rem .9rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;gap:.75rem;background:var(--surface);transition:.15s}
.file-header:hover{background:#1c2128}
.file-left{display:flex;align-items:center;gap:.6rem;min-width:0;flex:1}
.file-icon{font-size:1rem}
.file-path{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.85rem;color:var(--blue);word-break:break-all}
.file-meta{display:flex;gap:.5rem;align-items:center;flex-shrink:0}
.file-count{font-size:.75rem;font-weight:600;padding:.2rem .55rem;border-radius:10px}
.file-count.has-high{background:var(--red);color:#fff}
.file-count.no-high{background:var(--border);color:var(--muted)}
.file-chevron{color:var(--muted);font-size:.7rem;transition:transform .2s}
.file-group.collapsed .file-chevron{transform:rotate(-90deg)}
.file-group.collapsed .file-issues{display:none}

.file-issues{padding:0}
.issue-row{display:flex;gap:.6rem;align-items:flex-start;padding:.55rem .9rem;border-top:1px solid var(--border);font-size:.84rem;line-height:1.5;transition:.15s}
.issue-row:hover{background:#1a1f28}
.issue-row .sev-badge{font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;text-transform:uppercase;white-space:nowrap;min-width:44px;text-align:center;flex-shrink:0}
.sev-badge.HIGH{background:rgba(248,81,73,.2);color:var(--red);border:1px solid rgba(248,81,73,.3)}
.sev-badge.MEDIUM{background:rgba(210,153,29,.2);color:var(--orange);border:1px solid rgba(210,153,29,.3)}
.sev-badge.LOW{background:rgba(139,148,158,.15);color:var(--muted);border:1px solid rgba(139,148,158,.3)}
.issue-row .rule-badge{font-size:.72rem;color:var(--blue);white-space:nowrap;min-width:70px;flex-shrink:0}
.issue-row .line-badge{color:var(--muted);font-size:.75rem;min-width:35px;flex-shrink:0}
.issue-row .body{flex:1;min-width:0}
.issue-row .code-snippet{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.8rem;padding:.15rem .5rem;background:rgba(110,118,129,.1);border-radius:4px;word-break:break-all;margin-bottom:.2rem;display:inline-block;max-width:100%}
.issue-row .help-note{color:var(--muted);font-size:.78rem}

.empty-state{text-align:center;padding:3rem;color:var(--muted)}
.empty-state .icon{font-size:3rem;margin-bottom:.5rem}
.empty-state.ok{color:var(--green)}
.empty-state .title{font-size:1.1rem;margin-bottom:.3rem}

footer{text-align:center;color:var(--muted);font-size:.78rem;padding:1rem;border-top:1px solid var(--border);margin-top:1.5rem}
footer a{color:var(--blue)}

.hidden{display:none!important}
@media(max-width:768px){.container{padding:.75rem}.top-bar{flex-direction:column}.toolbar{flex-direction:column;align-items:stretch}.search-box{min-width:100%}.actions{justify-content:flex-end}}
</style>
</head>
<body>
<header>
  <h1>🛡️ ai-config-guard</h1>
  <div class="lang-switch">
    <button data-lang="en" class="active">EN</button>
    <button data-lang="zh">中文</button>
  </div>
</header>

<div class="container">
  <!-- Path bar -->
  <div class="top-bar">
    <div class="path-box">
      <input type="text" id="pathInput" placeholder="C:\\Users\\...\\project">
      <button id="scanBtn" data-t="scan">Scan</button>
    </div>
  </div>

  <!-- Drop zone -->
  <div class="drop-zone" id="dropZone">
    <div class="drop-icon">📁</div>
    <div class="drop-hint" data-t="dropHint">Drag & drop a folder here</div>
    <div style="margin-top:.5rem;font-size:.8rem"><span data-t="or">or enter path</span></div>
    <input type="file" id="fileInput" webkitdirectory directory multiple>
  </div>

  <!-- Summary -->
  <div class="summary hidden" id="summary"></div>

  <!-- Toolbar -->
  <div class="toolbar hidden" id="toolbar">
    <div class="sev-group" id="sevGroup"></div>
    <div class="search-box">
      <input type="text" id="searchInput" data-t-placeholder="search" placeholder="Search file names or content...">
      <button class="clear" id="clearSearch">×</button>
    </div>
    <div class="actions">
      <button id="expandAllBtn" data-t="expandAll">Expand all</button>
      <button id="collapseAllBtn" data-t="collapseAll">Collapse all</button>
      <button class="primary" id="exportBtn" data-t="exportJson">📥 Export JSON</button>
    </div>
  </div>

  <!-- Results -->
  <div id="results"></div>
</div>

<footer data-t="footer"></footer>

<script>
let lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
let data = DATA_PLACEHOLDER;
let severity = 'ALL';
let query = '';
let collapsed = new Set();
const T = TRANSLATIONS_PLACEHOLDER;
const RL = RULE_LABELS_PLACEHOLDER;

function _(k){return(T[lang]&&T[lang][k])||(T.en&&T.en[k])||k}
function rl(r){const l=RL[r];return l?(lang==='zh'?T.zh[l[0]]:T.en[l[0]]):r}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function setLang(l){
  lang=l;
  document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  document.querySelectorAll('[data-t]').forEach(e=>e.textContent=_(e.dataset.t));
  document.querySelectorAll('[data-t-placeholder]').forEach(e=>e.placeholder=_(e.dataset.tPlaceholder));
  render();
}

document.querySelectorAll('.lang-switch button').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));

// Path input
const pathInput=document.getElementById('pathInput');
_pathInput.value = "CURRENT_PATH_PLACEHOLDER";

document.getElementById('scanBtn').addEventListener('click',()=>{
  const p=pathInput.value.trim();if(!p)return;
  document.getElementById('scanBtn').textContent='⏳';
  fetch('/scan?path='+encodeURIComponent(p)).then(r=>r.json()).then(d=>{
    data=d;document.getElementById('scanBtn').textContent=_('scan');render();
  });
});

// Drop zone
const dropZone=document.getElementById('dropZone');
const fileInput=document.getElementById('fileInput');
dropZone.addEventListener('click',()=>fileInput.click());
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over')});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault();dropZone.classList.remove('drag-over');
  const items=e.dataTransfer.items;
  if(!items)return;
  for(const item of items){
    if(item.kind==='file'){
      const entry=item.webkitGetAsEntry?.();
      if(entry&&entry.isDirectory){
        // Browser sandbox: can't get full path. Show as hint.
        pathInput.value=entry.name;
        pathInput.style.borderColor='var(--orange)';
        setTimeout(()=>pathInput.style.borderColor='',2000);
        dropZone.querySelector('.drop-hint').textContent='📂 '+entry.name+' — '+(lang==='zh'?'请在上方粘贴完整路径':'paste full path above');
        setTimeout(()=>dropZone.querySelector('.drop-hint').textContent=_('dropHint'),3000);
      }
    }
  }
});
fileInput.addEventListener('change',()=>{
  if(fileInput.files.length>0){
    const f=fileInput.files[0];
    pathInput.value=f.webkitRelativePath?f.webkitRelativePath.split('/')[0]:f.name;
  }
});

// Search
const searchInput=document.getElementById('searchInput');
const clearSearch=document.getElementById('clearSearch');
searchInput.addEventListener('input',()=>{
  query=searchInput.value.toLowerCase();
  clearSearch.classList.toggle('visible',!!query);
  render();
});
clearSearch.addEventListener('click',()=>{searchInput.value='';query='';clearSearch.classList.remove('visible');render()});

// Expand/collapse all
document.getElementById('expandAllBtn').addEventListener('click',()=>{collapsed.clear();render()});
document.getElementById('collapseAllBtn').addEventListener('click',()=>{
  (data.findings||[]).forEach(f=>collapsed.add(f.file));render();
});

// Export
document.getElementById('exportBtn').addEventListener('click',()=>{
  const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='ai-config-guard-report.json';a.click();
});

// ── Render ────────────────────────────────────────────────
function render(){
  const hasData=data&&data.findings;
  document.getElementById('summary').classList.toggle('hidden',!hasData);
  document.getElementById('toolbar').classList.toggle('hidden',!hasData);

  if(!hasData){document.getElementById('results').innerHTML='';return}

  // Summary
  const scanned=data.scannedFiles||0,flagged=data.flaggedFiles||0,total=data.totalIssues||0;
  document.getElementById('summary').innerHTML=[
    {cls:scanned>0&&flagged===0?'ok':'',num:scanned,label:_('filesScanned')},
    {cls:flagged>0?'danger':'ok',num:flagged,label:_('filesFlagged')},
    {cls:total>0?'danger':'ok',num:total,label:_('totalIssues')},
  ].map(s=>'<div class="stat '+s.cls+'"><div class="num">'+s.num+'</div><div class="label">'+s.label+'</div></div>').join('');

  // Severity filter
  const cnts={ALL:0,HIGH:0,MEDIUM:0,LOW:0};
  (data.findings||[]).forEach(f=>f.issues.forEach(i=>{cnts.ALL++;cnts[i.severity]=(cnts[i.severity]||0)+1}));
  document.getElementById('sevGroup').innerHTML=['ALL','HIGH','MEDIUM','LOW'].map(s=>
    '<button data-s="'+s+'" class="'+(severity===s?'active':'')+'">'+_(s.toLowerCase())+' ('+(cnts[s]||0)+')</button>'
  ).join('');
  document.querySelectorAll('.sev-group button').forEach(b=>b.addEventListener('click',()=>{severity=b.dataset.s;render()}));

  // Filter findings
  const findings=(data.findings||[]).map(f=>{
    const issues=f.issues.filter(i=>{
      if(severity!=='ALL'&&i.severity!==severity)return false;
      if(query&&!f.file.toLowerCase().includes(query)&&!i.content.toLowerCase().includes(query)&&!i.help.toLowerCase().includes(query))return false;
      return true;
    });
    return{...f,issues};
  }).filter(f=>f.issues.length>0);

  const container=document.getElementById('results');
  if(!findings.length){
    container.innerHTML='<div class="empty-state"><div class="icon">🔍</div><div class="title">'+_('noResults')+'</div></div>';
    return;
  }

  container.innerHTML=findings.map(f=>{
    const hi=f.issues.some(i=>i.severity==='HIGH');
    const isCollapsed=collapsed.has(f.file);
    return '<div class="file-group'+(isCollapsed?' collapsed':'')+'">'+
      '<div class="file-header" data-file="'+esc(f.file)+'">'+
        '<div class="file-left"><span class="file-icon">📄</span><span class="file-path">'+esc(f.file)+'</span></div>'+
        '<div class="file-meta">'+
          '<span class="file-count '+(hi?'has-high':'no-high')+'">'+f.issues.length+' '+_('issuesFound').replace('{n}',f.issues.length)+'</span>'+
          '<span class="file-chevron">▼</span>'+
        '</div>'+
      '</div>'+
      '<div class="file-issues">'+f.issues.map(i=>
        '<div class="issue-row">'+
          '<span class="sev-badge '+i.severity+'">'+_(i.severity.toLowerCase())+'</span>'+
          '<span class="rule-badge">'+rl(i.rule)+'</span>'+
          '<span class="line-badge">L'+i.line+'</span>'+
          '<div class="body">'+
            '<div class="code-snippet">'+esc(i.content)+'</div>'+
            '<div class="help-note">💡 '+esc(i.help)+'</div>'+
          '</div>'+
        '</div>'
      ).join('')+'</div>'+
    '</div>';
  }).join('');

  // File collapse
  document.querySelectorAll('.file-header').forEach(h=>h.addEventListener('click',()=>{
    const f=h.dataset.file;
    if(collapsed.has(f))collapsed.delete(f);else collapsed.add(f);
    render();
  }));
}

// Init
pathInput.value="CURRENT_PATH_PLACEHOLDER";
if(data&&data.findings)render();
setLang(lang);
</script>
</body>
</html>`;

// ── Server ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') {
    const scanData = cachedData?.findings ? cachedData : (cachedData = runScan(targetPath));
    const page = HTML
      .replace('DATA_PLACEHOLDER', JSON.stringify(scanData))
      .replace('TRANSLATIONS_PLACEHOLDER', JSON.stringify(T))
      .replace('RULE_LABELS_PLACEHOLDER', JSON.stringify(RULE_LABELS))
      .replace('CURRENT_PATH_PLACEHOLDER', targetPath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
  } else if (reqUrl.pathname === '/scan') {
    const newPath = reqUrl.searchParams.get('path');
    if (newPath && fs.existsSync(newPath)) {
      targetPath = path.resolve(newPath);
    }
    cachedData = runScan(targetPath);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(cachedData));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🛡️  ai-config-guard Web UI v3`);
  console.log(`   Target: ${targetPath}`);
  console.log(`   URL:    http://localhost:${PORT}\n`);
});
