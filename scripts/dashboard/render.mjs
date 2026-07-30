// scripts/dashboard/render.mjs
// Self-contained dark HTML. No external requests; inline CSS/JS only.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMarkdown(md) {
  const lines = esc(md).split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^### /.test(bolded)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h3>${bolded.slice(4)}</h3>`); }
    else if (/^## /.test(bolded)) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h2>${bolded.slice(3)}</h2>`); }
    else if (/^- /.test(bolded)) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${bolded.slice(2)}</li>`); }
    else if (bolded.trim() === '') { if (inList) { out.push('</ul>'); inList = false; } }
    else out.push(`<p>${bolded}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

const fmtDate = (iso) => (iso ? iso.slice(0, 10) : 'never');

function routineCard(r) {
  const badge = r.daysSince == null ? 'never' : `${r.daysSince}d ago`;
  return `<div class="card routine" data-status="${esc(r.status)}">
    <div class="row"><span class="name">${esc(r.name)}</span><span class="pill">${r.cadenceDays}d</span></div>
    <div class="meta">last: ${esc(fmtDate(r.lastDone))} · ${badge}</div>
    <button class="copy" data-copy="${esc(r.command)}">${esc(r.command)}</button>
  </div>`;
}

function capabilityCard(c) {
  return `<div class="card">
    <div class="name">${esc(c.name)}</div>
    <div class="desc">${esc(c.description)}</div>
    <button class="copy" data-copy="${esc(c.invoke)}">${esc(c.invoke)}</button>
  </div>`;
}

function auditRow(a) {
  const sev = Object.entries(a.severityCounts).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
  return `<div class="audit-row"><span class="mono">${esc(a.file)}</span><span>${a.findings ?? '?'} findings</span><span>${esc(sev)}</span><span class="meta">${esc(fmtDate(a.updated))}</span></div>`;
}

export function renderHtml(data) {
  const summaryHtml = data.summary
    ? `<section class="summary"><div class="meta">Claude summary · ${fmtDate(data.summary.updated)} · refresh with /dashboard</div>${renderMarkdown(data.summary.markdown)}</section>`
    : `<section class="summary empty"><div class="meta">No Claude summary yet — run /dashboard in Claude Code to add one.</div></section>`;

  const routinesHtml = data.routines.map(routineCard).join('\n');

  const fixes = data.audits.fixes;
  const pct = fixes && fixes.total > 0 ? Math.round((100 * fixes.done) / fixes.total) : 0;
  const auditsHtml = `
    ${fixes ? `<div class="fixes"><div class="row"><span>FIXES.md</span><span>${fixes.done}/${fixes.total}</span></div><div class="bar"><div class="fill" style="width:${pct}%"></div></div></div>` : '<div class="meta">No FIXES.md</div>'}
    ${data.audits.files.map(auditRow).join('\n') || '<div class="meta">No audit files</div>'}`;

  const byDomain = new Map(data.domains.map((d) => [d, []]));
  for (const c of data.cards) {
    if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
    byDomain.get(c.domain).push(c);
  }
  const mapHtml = [...byDomain.entries()]
    .filter(([, cards]) => cards.length)
    .map(([domain, cards]) => `<div class="column"><h3>${esc(domain)}</h3>${cards.map(capabilityCard).join('\n')}</div>`)
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stock &amp; Spoon — Agentic OS</title>
<style>
:root{--bg:#0b0e14;--panel:#131722;--card:#1a2030;--border:#2a3245;--text:#dbe2f0;--dim:#8b94a8;--accent:#e8833a;--ok:#3fb96a;--due:#e0b040;--overdue:#e05252;--mono:ui-monospace,Consolas,monospace}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font:14px/1.5 system-ui,Segoe UI,sans-serif;padding:24px;max-width:1400px;margin:0 auto}
h1{font-size:20px;letter-spacing:.04em} h2{font-size:15px;margin:8px 0} h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:8px}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
.meta{color:var(--dim);font-size:12px}
section{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px}
.summary h2{color:var(--accent)} .summary ul{padding-left:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px}
.card .name{font-weight:600} .card .desc{color:var(--dim);font-size:12px;margin:4px 0 8px}
.row{display:flex;justify-content:space-between;align-items:center}
.pill{background:var(--border);border-radius:99px;padding:1px 8px;font-size:11px;color:var(--dim)}
.routine{border-left:3px solid var(--border)}
.routine[data-status="ok"]{border-left-color:var(--ok)}
.routine[data-status="due"]{border-left-color:var(--due)}
.routine[data-status="overdue"]{border-left-color:var(--overdue)}
.copy{display:block;width:100%;margin-top:8px;background:#0e1220;border:1px dashed var(--border);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:12px;padding:6px 8px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy:hover{border-color:var(--accent)} .copy.copied{border-color:var(--ok)}
.columns{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.column .card{margin-bottom:10px}
.audit-row{display:grid;grid-template-columns:1.4fr .7fr 1.6fr .6fr;gap:8px;padding:6px 0;border-top:1px solid var(--border);font-size:13px}
.mono{font-family:var(--mono)}
.fixes{margin-bottom:10px}
.bar{height:8px;background:var(--border);border-radius:99px;overflow:hidden;margin-top:4px}
.fill{height:100%;background:var(--ok)}
</style></head><body>
<header><h1>Stock &amp; Spoon — Agentic OS</h1><span class="meta">generated ${esc(data.generatedAt)}</span></header>
${summaryHtml}
<section><h2>Routines</h2><div class="grid">${routinesHtml}</div></section>
<section><h2>Audit &amp; Fixes</h2>${auditsHtml}</section>
<section><h2>Capability Map</h2><div class="columns">${mapHtml}</div></section>
<script>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy'); if (!btn) return;
  var text = btn.getAttribute('data-copy');
  function done(){ btn.classList.add('copied'); setTimeout(function(){ btn.classList.remove('copied'); }, 800); }
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); }
  else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
});
</script>
</body></html>`;
}
