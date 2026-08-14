#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const rootArg = process.argv[2];
if (!rootArg) {
  console.error('usage: node tools/static-audit.mjs <client-project-root>');
  process.exit(2);
}
const root = resolve(rootArg);
const skipDirs = new Set(['node_modules','.git','.next','dist','build','coverage','.vercel','public/vendor']);
const textExt = new Set(['.css','.scss','.sass','.less','.html','.htm','.js','.jsx','.ts','.tsx','.vue','.svelte','.mdx']);
const failures = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full)); else if (textExt.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\','/');
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/archic-static-exception\s*:/.test(line)) return;
    const at = `${rel}:${i + 1}`;
    if (/\bLorem ipsum\b/i.test(line)) failures.push(`${at} placeholder copy (Lorem ipsum)`);
    if (/\bTODO\b/.test(line)) failures.push(`${at} TODO left in source`);
    if (/transition(?:-property)?\s*:\s*all\b/i.test(line)) failures.push(`${at} transition: all is forbidden`);
    if (/z-index\s*:\s*-?\d+\s*;?/i.test(line)) failures.push(`${at} raw numeric z-index; use the scale token`);
    if (/\.(?:css|scss|sass|less)$/.test(rel) && !/(foundation|semantic-contract|brand|tokens?)[^/]*\.(?:css|scss|sass|less)$/i.test(basename(rel)) && /#[0-9a-fA-F]{3,8}\b/.test(line)) failures.push(`${at} hardcoded hex outside token/brand file`);
  });

  for (const m of text.matchAll(/<input\b[^>]*\btype\s*=\s*["'](?:date|datetime-local)["'][^>]*>/gi)) {
    if (!/data-archic-native-date-ok/.test(m[0])) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      failures.push(`${rel}:${line} native date control detected; use the designed DatePicker or document an explicit data-archic-native-date-ok exception`);
    }
  }

  if (/(^|\/)components?\//i.test(rel)) {
    for (const m of text.matchAll(/var\((--(?:brand-[\w-]+|space-[\w-]+|fs-[\w-]+|dur-[\w-]+|ease-[\w-]+|radius-(?:xs|sm|md|lg|xl|full)))/g)) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      failures.push(`${rel}:${line} component bypasses semantic contract with ${m[1]}`);
    }
  }
}

if (failures.length) {
  console.error(`✗ static audit — ${failures.length} finding(s)`);
  failures.forEach((f) => console.error(`  ${f}`));
  console.error('  Fix the issue or add a narrow same-line `archic-static-exception: reason` only when the exception is intentional.');
  process.exit(1);
}
console.log('✓ static audit — no obvious template/default/token-boundary violations');


