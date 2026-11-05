#!/usr/bin/env node
// Builds the files users import from src/mediatype.mjs and src/smstunnel.js, in the same YAML style as Zabbix's
// own export: media_smstunnel.yaml (7.0 export format, for Zabbix 7.0 and later) and media_smstunnel_6.0.yaml
// (6.0 export format, for Zabbix 6.0 LTS).
//
//   node scripts/build.mjs           write both files
//   node scripts/build.mjs --check   exit 1 when one of them is not up to date

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TARGETS, mediaType } from '../src/mediatype.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPT = join(root, 'src', 'smstunnel.js');
export { TARGETS };
export const outputPath = (target) => join(root, target.file);

const PLAIN_SPECIAL = /^[\s\-?:,[\]{}#&*!|>'"%@`<=~]/;
const RESERVED = /^(true|false|yes|no|on|off|null|y|n|~)$/i;
const NUMERIC = /^[-+]?(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?$|^0x[0-9a-f]+$|^0o?[0-7]+$/i;
// Zabbix's YAML library (Symfony) reads an unquoted date as a number, so it quotes anything that looks like one.
const TIMESTAMP = /^\d{4}-\d{1,2}-\d{1,2}(?:(?:[Tt]|[ \t]+)\d{1,2}:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d{1,2}(?::\d{2})?))?)?$/;

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
    || text.includes(' #') || text.endsWith(':') || RESERVED.test(text) || NUMERIC.test(text) || TIMESTAMP.test(text);

  return needsQuotes ? `'${text.replace(/'/g, "''")}'` : text;
}

function field(key, value, indent) {
  return `${' '.repeat(indent)}${key}: ${scalar(value, indent + 2)}`;
}

// The script as it goes into one file: src/smstunnel.js with the file's own menu paths in its two menu lines.
export function scriptFor(target) {
  let script = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');

  for (const [key, menu] of [['macrosMenu', 'macros'], ['usersMenu', 'users']]) {
    const line = `\t${key}: '${TARGETS[0].menu[menu]}',\n`;
    if (script.split(line).length !== 2) {
      throw new Error(`src/smstunnel.js must hold the line ${JSON.stringify(line)} exactly once.`);
    }
    script = script.replace(line, () => `\t${key}: '${target.menu[menu]}',\n`);
  }

  return script;
}

export function buildYaml(target = TARGETS[0]) {
  const script = scriptFor(target);
  const m = mediaType(target);
  const lines = ['zabbix_export:', field('version', target.exportVersion, 2)];

  if (target.date) lines.push(field('date', target.date, 2));
  lines.push('  media_types:');
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
  let stale = 0;

  for (const target of TARGETS) {
    const yaml = buildYaml(target);
    const path = outputPath(target);

    if (process.argv.includes('--check')) {
      let current = '';
      try {
        current = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      } catch {}
      if (current !== yaml) {
        console.error(`${target.file} is out of date: run \`npm run build\`.`);
        stale++;
      } else {
        console.log(`${target.file} is up to date.`);
      }
    } else {
      writeFileSync(path, yaml);
      console.log(`Wrote ${path} (${yaml.length} bytes).`);
    }
  }

  if (stale) process.exit(1);
}
