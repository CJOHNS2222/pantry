// Pure parsing/merge logic for the Agentic OS dashboard. No fs/git access here.

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text || '');
  if (!m) return { data: {}, body: text || '' };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: text.slice(m[0].length) };
}

const clip = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function firstParagraph(body) {
  for (const block of body.split(/\r?\n\r?\n/)) {
    const t = block.trim();
    if (t && !t.startsWith('#')) return t.split(/\r?\n/)[0].trim();
  }
  return '';
}

export function parseAgentFile(filename, text) {
  const name = filename.replace(/\.md$/i, '');
  const { body } = parseFrontmatter(text || '');
  let description = '';
  const role = /^## Role\s*\r?\n+([^\r\n#]+)/m.exec(body);
  if (role) description = role[1].trim();
  else description = firstParagraph(body);
  return { id: `agent:${name}`, name, description: clip(description), invoke: `run ${name} agent` };
}

export function parseSkillFile(dirName, text) {
  const { data } = parseFrontmatter(text || '');
  return {
    id: `skill:${dirName}`,
    name: data.name || dirName,
    description: clip(data.description || ''),
    invoke: `/${dirName}`,
  };
}

export function parseWorkflows(claudeMdText) {
  const sec = /## Available Workflows\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/.exec(claudeMdText || '');
  if (!sec) return [];
  const out = [];
  for (const line of sec[1].split(/\r?\n/)) {
    const m = /^- \*\*([\w-]+)\*\*:\s*(.+)$/.exec(line.trim());
    if (m) out.push({ id: `workflow:${m[1]}`, name: m[1], description: clip(m[2]), invoke: `run ${m[1]} workflow` });
  }
  return out;
}

export function parseAuditFile(filename, text, mtimeIso) {
  const { data, body } = parseFrontmatter(text || '');
  const severityCounts = {};
  const lines = body.split(/\r?\n/);
  let currentSeverity = null;
  let currentContent = [];
  for (const line of lines) {
    const severityMatch = /^### (Critical|High|Medium|Low)\b/.exec(line);
    if (severityMatch) {
      if (currentSeverity) {
        const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
        severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
      }
      currentSeverity = severityMatch[1];
      currentContent = [];
    } else if (currentSeverity && line.match(/^###/)) {
      if (currentContent.length) {
        const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
        severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
      }
      currentSeverity = null;
      currentContent = [];
    } else if (currentSeverity) {
      currentContent.push(line);
    }
  }
  if (currentSeverity && currentContent.length) {
    const items = currentContent.join('\n').match(/^\s*\d+\.\s/gm) || [];
    severityCounts[currentSeverity] = (severityCounts[currentSeverity] || 0) + items.length;
  }
  return {
    file: filename,
    agent: data.agent || null,
    status: data.status || null,
    findings: data.findings != null && /^\d+$/.test(data.findings) ? Number(data.findings) : null,
    severityCounts,
    updated: mtimeIso,
  };
}

export function parseFixesProgress(text) {
  const done = (text?.match(/✅/g) || []).length;
  const open = (text?.match(/[🔴🟡🟢]/gu) || []).length;
  return { done, total: done + open };
}
