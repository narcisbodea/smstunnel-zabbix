#!/usr/bin/env node
// Builds media_smstunnel.yaml (the file users import) from src/mediatype.mjs and src/smstunnel.js,
// in the same YAML style as Zabbix's own export.
//
//   node scripts/build.mjs           write media_smstunnel.yaml
//   node scripts/build.mjs --check   exit 1 when media_smstunnel.yaml is not up to date

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXPORT_VERSION, mediaType } from '../src/mediatype.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = join(root, 'media_smstunnel.yaml');
export const SCRIPT = join(root, 'src', 'smstunnel.js');

const PLAIN_SPECIAL = /^[\s\-?:,[\]{}#&*!|>'"%@`<=~]/;
const RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;
const NUMERIC = /^[-+]?(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?$|^0x[0-9a-f]+$|^0o?[0-7]+$/i;

// One scalar, as Zabbix writes it: plain when safe, otherwise single-quoted; multi-line as a literal block.
function scalar(value, indent) {
  const text = String(value);

  if (text.includes('\n')) {
    const body = text.endsWith('\n') ? text.slice(0, -1) : text;
    const chomp = text.endsWith('\n') ? '|' : '|-';
    const pad = ' '.repeat(indent);
    return chomp + '\n' + body.split('\n').map((line) => pad + line).join('\n');
  }

  const needsQuotes = text === '' || PLAIN_SPECIAL.test(text) || /\s$/.test(text) || text.includes(': ')
    || text.includes(' #') || text.endsWith(':') || RESERVED.test(text) || NUMERIC.test(text);

  return needsQuotes ? `'${text.replace(/'/g, "''")}'` : text;
}

function field(key, value, indent) {
  return `${' '.repeat(indent)}${key}: ${scalar(value, indent + 2)}`;
}

export function buildYaml() {
  const script = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
  const lines = ['zabbix_export:', field('version', EXPORT_VERSION, 2), '  media_types:'];
  const m = mediaType;

  lines.push(`    - ${field('name', m.name, 0)}`);
  lines.push(field('type', m.type, 6));
  lines.push('      parameters:');
  for (const p of m.parameters) {
    lines.push(`        - ${field('name', p.name, 0)}`);
    lines.push(field('value', p.value, 10));
  }
  for (const key of ['status', 'max_sessions', 'attempts', 'attempt_interval']) {
    if (m[key] !== undefined) lines.push(field(key, m[key], 6));
  }
  lines.push(field('script', script.endsWith('\n') ? script : script + '\n', 6));
  for (const key of ['timeout', 'process_tags', 'show_event_menu', 'event_menu_url', 'event_menu_name']) {
    if (m[key] !== undefined) lines.push(field(key, m[key], 6));
  }
  lines.push(field('description', m.description + '\n', 6));
  lines.push('      message_templates:');
  for (const t of m.message_templates) {
    lines.push(`        - ${field('event_source', t.event_source, 0)}`);
    lines.push(field('operation_mode', t.operation_mode, 10));
    lines.push(field('subject', t.subject, 10));
    lines.push(field('message', t.message + '\n', 10));
  }

  return lines.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const yaml = buildYaml();

  if (process.argv.includes('--check')) {
    const current = readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n');
    if (current !== yaml) {
      console.error('media_smstunnel.yaml is out of date: run `npm run build`.');
      process.exit(1);
    }
    console.log('media_smstunnel.yaml is up to date.');
  } else {
    writeFileSync(OUTPUT, yaml);
    console.log(`Wrote ${OUTPUT} (${yaml.length} bytes).`);
  }
}
