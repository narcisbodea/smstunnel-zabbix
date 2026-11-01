#!/usr/bin/env node
// End-to-end test of the SMSTunnel media type inside a real Zabbix (see docker-compose.yml next to this file).
//
// It imports media_smstunnel.yaml, adds a host with trapper items and triggers, gives two users an SMSTunnel
// media, and fires real problems, an update, a recovery and failures. It checks what Zabbix recorded
// (alert.get) and, when it can reach the test database, the texts SMSTunnel accepted.
//
//   node test/e2e/e2e.mjs --zabbix http://127.0.0.1:8571 --key-file key.json \
//     [--api-url http://host.docker.internal:3101] [--local-api http://127.0.0.1:3101] \
//     [--mongo mongodb://127.0.0.1:27018/smstunnel_app_dev] [--mongo-driver D:/ANDROID/SMSserver/package.json] \
//     [--server-container smst-int-zabbix70-server-1] [--tls-check]
//
// key.json is {"apiKey": "..."} (or set SMSTUNNEL_API_KEY). Use a key of a local SMSTunnel test server only:
// every text in this test goes to --api-url. Numbers used: +14155550123 and +14155550124.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { ZabbixApi, sleep } from './zabbix-api.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const args = parseArgs(process.argv.slice(2));

const ZABBIX_URL = args.zabbix || 'http://127.0.0.1:8571';
const API_URL = args['api-url'] || 'http://host.docker.internal:3101';
const LOCAL_API = args['local-api'] || 'http://127.0.0.1:3101';
const CONTAINER = args['server-container'] || '';
const STUB_PORT = Number(args['stub-port'] || 8579);
const NUMBER_ADMIN = '+14155550123';
const NUMBER_ONCALL = '+14155550124';
const RUN = Date.now().toString(36);
const HOST = `smstunnel-e2e-${RUN}`;
const KEY = readKey();
const BAD_KEY = 'sk_live_e2e_not_a_real_key_0000000000000';

const api = new ZabbixApi(ZABBIX_URL);
const results = [];
const texts = [];
let mediatypeid;
let shippedParams;
let mongo;

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (!list[i].startsWith('--')) continue;
    const name = list[i].slice(2);
    out[name] = list[i + 1] && !list[i + 1].startsWith('--') ? list[++i] : true;
  }
  return out;
}

function readKey() {
  if (process.env.SMSTUNNEL_API_KEY) return process.env.SMSTUNNEL_API_KEY;
  if (!args['key-file']) throw new Error('Give --key-file (JSON with apiKey) or set SMSTUNNEL_API_KEY.');
  return JSON.parse(readFileSync(args['key-file'], 'utf8')).apiKey;
}

function scrub(value) {
  return String(value).split(KEY).join('[API key]');
}

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: scrub(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${scrub(detail)})` : ''}`);
}

function docker(...command) {
  return execFileSync('docker', command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

// Global macros live in Zabbix's configuration cache: reload it (or wait for the next sync).
async function syncConfig() {
  if (CONTAINER) {
    docker('exec', CONTAINER, 'zabbix_server', '-R', 'config_cache_reload');
    await sleep(5000);
  } else {
    await sleep(15000);
  }
}

async function setGlobalMacro(macro, value, type = 0) {
  const [existing] = await api.call('usermacro.get', { globalmacro: true, filter: { macro }, output: ['globalmacroid'] });
  if (existing) await api.call('usermacro.updateglobal', { globalmacroid: existing.globalmacroid, value, type });
  else await api.call('usermacro.createglobal', { macro, value, type });
}

async function setParams(changes) {
  const merged = shippedParams.filter((p) => !(p.name in changes)).map((p) => ({ name: p.name, value: p.value }));
  for (const [name, value] of Object.entries(changes)) {
    if (value !== null) merged.push({ name, value });
  }
  await api.call('mediatype.update', { mediatypeid, parameters: merged });
}

async function setOptions(maxattempts, attempt_interval) {
  await api.call('mediatype.update', { mediatypeid, maxattempts: String(maxattempts), attempt_interval });
}

function media(sendto) {
  return { mediatypeid, sendto, active: 0, severity: 63, period: '1-7,00:00-24:00' };
}

// Trapper values reach the trigger once the new item is in the configuration cache.
async function push(key, value) {
  for (let i = 0; i < 40; i++) {
    const result = await api.call('history.push', [{ host: HOST, key, value: String(value) }]);
    const row = result?.data?.[0];
    if (result?.response === 'success' && row && !row.error) return;
    await sleep(3000);
  }
  throw new Error(`history.push to ${key} kept failing`);
}

async function waitEvent(triggerid, value, since, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const events = await api.call('event.get', {
      objectids: [triggerid], source: 0, object: 0, value, time_from: since,
      output: ['eventid', 'clock', 'name', 'r_eventid'], sortfield: ['clock', 'eventid'], sortorder: 'DESC',
    });
    if (events.length) return events[0];
    await sleep(2000);
  }
  throw new Error(`no event (value ${value}) for trigger ${triggerid}`);
}

async function alerts(eventids, subjectPrefix) {
  const list = await api.call('alert.get', {
    eventids, mediatypeids: [mediatypeid],
    output: ['alertid', 'userid', 'sendto', 'subject', 'message', 'status', 'retries', 'error', 'clock'],
  });
  return list.filter((a) => !subjectPrefix || a.subject.startsWith(subjectPrefix));
}

// Status: 0 not sent yet (or retrying), 1 sent, 2 failed.
async function waitAlerts(eventids, subjectPrefix, count, done, timeoutMs = 240000) {
  const start = Date.now();
  let list = [];
  while (Date.now() - start < timeoutMs) {
    list = await alerts(eventids, subjectPrefix);
    if (list.length >= count && done(list)) return list;
    await sleep(3000);
  }
  return list;
}

const settled = (list) => list.every((a) => a.status === '1' || a.status === '2');

async function openMongo() {
  try {
    let driver;
    try {
      driver = await import('mongodb');
    } catch {
      driver = createRequire(args['mongo-driver'] || 'D:/ANDROID/SMSserver/package.json')('mongodb');
    }
    const client = new driver.MongoClient(args.mongo || 'mongodb://127.0.0.1:27018/smstunnel_app_dev', {
      serverSelectionTimeoutMS: 4000,
    });
    await client.connect();
    return client;
  } catch (error) {
    console.log(`(no test database: ${error.message}; the texts are checked in Zabbix only)`);
    return null;
  }
}

// The texts SMSTunnel accepted (read-only).
async function textsSince(since, numbers, startsWith) {
  if (!mongo) return null;
  const docs = await mongo.db().collection('messages').find({
    createdAt: { $gte: since }, phoneNumber: { $in: numbers }, type: 'outgoing',
  }).project({ phoneNumber: 1, message: 1, status: 1, createdAt: 1 }).toArray();
  return docs.filter((d) => typeof d.message === 'string' && d.message.startsWith(startsWith));
}

async function expectTexts(label, since, numbers, startsWith, contains = []) {
  if (!mongo) return;
  let found = [];
  for (let i = 0; i < 10; i++) {
    found = await textsSince(since, numbers, startsWith);
    if (found.length >= numbers.length) break;
    await sleep(2000);
  }
  const perNumber = numbers.map((n) => found.filter((d) => d.phoneNumber === n).length);
  check(`${label}: SMSTunnel got one text per number`, perNumber.every((c) => c === 1), `texts per number ${perNumber.join('/')}`);
  for (const doc of found) {
    texts.push({ phase: label, to: doc.phoneNumber, status: doc.status, message: doc.message });
    const missing = contains.filter((c) => !doc.message.includes(c));
    check(`${label}: text to ${doc.phoneNumber} reads right`, missing.length === 0,
      missing.length ? `missing ${missing.join(', ')}` : JSON.stringify(doc.message));
  }
}

// Answers 503 to the first text for each number, then passes everything on to the real test server.
function startFlakyStub() {
  const seen = new Set();
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    let to = '';
    try {
      to = JSON.parse(body).to;
    } catch {}
    if (!seen.has(to)) {
      seen.add(to);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 503, message: 'Service Unavailable (E2E stub, first try)' }));
      return;
    }
    const upstream = await fetch(LOCAL_API + req.url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': req.headers['x-api-key'] || '' },
      body,
    });
    const headers = { 'Content-Type': upstream.headers.get('content-type') || 'application/json' };
    if (upstream.headers.get('retry-after')) headers['Retry-After'] = upstream.headers.get('retry-after');
    res.writeHead(upstream.status, headers);
    res.end(await upstream.text());
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const version = await api.waitReady();
  console.log(`Zabbix ${version} at ${ZABBIX_URL}; texts go to ${API_URL}; run ${RUN}`);
  mongo = await openMongo();

  if (CONTAINER) {
    try {
      docker('exec', CONTAINER, 'zabbix_server', '-R', 'log_level_increase=alerter');
    } catch (error) {
      console.log(`(could not raise the alerter log level: ${error.message.split('\n')[0]})`);
    }
  }

  // 1. Import, and compare with Zabbix's own export of what it imported.
  const source = readFileSync(join(root, 'media_smstunnel.yaml'), 'utf8');
  check('import media_smstunnel.yaml', await api.call('configuration.import', {
    format: 'yaml', rules: { mediaTypes: { createMissing: true, updateExisting: true } }, source,
  }));
  const [mt] = await api.call('mediatype.get', { filter: { name: 'SMSTunnel' }, output: 'extend' });
  mediatypeid = mt.mediatypeid;
  shippedParams = mt.parameters;
  const exported = await api.call('configuration.export', { format: 'yaml', options: { mediaTypes: [mediatypeid] } });
  const ours = yaml.load(source).zabbix_export.media_types;
  const theirs = yaml.load(exported).zabbix_export.media_types;
  check('Zabbix exports the same media type back', JSON.stringify(ours) === JSON.stringify(theirs),
    exported === source ? 'byte-identical' : `export version ${yaml.load(exported).zabbix_export.version}`);
  check('imported options: 5 attempts, 30s apart, 30s timeout',
    mt.maxattempts === '5' && mt.attempt_interval === '30s' && mt.timeout === '30s',
    `${mt.maxattempts} / ${mt.attempt_interval} / ${mt.timeout}`);

  // 2. Point it at the test server; the key goes into a secret global macro.
  await setParams({ server_url: API_URL });
  await setGlobalMacro('{$SMSTUNNEL.API.KEY}', KEY, 1);
  await setGlobalMacro('{$HTTP.TLS.VERIFY:"SMSTunnel"}', 'none', 0);

  // 3. A host with one trapper item and trigger per phase, two users with their own numbers, one action.
  const groupid = (await api.call('hostgroup.create', { name: `SMSTunnel E2E ${RUN}` })).groupids[0];
  const hostid = (await api.call('host.create', { host: HOST, groups: [{ groupid }] })).hostids[0];
  const triggers = {};
  for (const phase of ['main', 'retry', 'badkey', 'number', 'multi', 'tls1', 'tls2', 'tls3']) {
    await api.call('item.create', { hostid, name: `SMSTunnel E2E ${phase}`, key_: `smstunnel.${phase}`, type: 2, value_type: 3 });
    triggers[phase] = (await api.call('trigger.create', {
      description: `SMSTunnel E2E ${phase}: value is high`, expression: `last(/${HOST}/smstunnel.${phase})>0`,
      priority: 4, manual_close: 1, opdata: 'Value: {ITEM.LASTVALUE1}',
    })).triggerids[0];
  }
  const usrgrpid = (await api.call('usergroup.create', {
    name: `SMSTunnel on-call ${RUN}`, hostgroup_rights: [{ id: groupid, permission: 2 }],
  })).usrgrpids[0];
  await api.call('user.update', { userid: '1', medias: [media(NUMBER_ADMIN)] });
  const oncall = (await api.call('user.create', {
    username: `oncall-${RUN}`, name: 'Ana', surname: 'On-call', passwd: 'Sms-Tunnel-e2e-2026!', roleid: '1',
    usrgrps: [{ usrgrpid }], medias: [media(NUMBER_ONCALL)],
  })).userids[0];
  await api.call('action.create', {
    name: `SMSTunnel E2E ${RUN}`, eventsource: 0, status: 0, esc_period: '1h',
    filter: { evaltype: 0, conditions: [{ conditiontype: 0, operator: 0, value: groupid }] },
    operations: [{
      operationtype: 0, esc_step_from: 1, esc_step_to: 1,
      opmessage: { default_msg: 1, mediatypeid }, opmessage_usr: [{ userid: '1' }, { userid: oncall }],
    }],
    recovery_operations: [{ operationtype: 11, opmessage: { default_msg: 1 } }],
    update_operations: [{ operationtype: 12, opmessage: { default_msg: 1 } }],
  });
  await syncConfig();
  const both = [NUMBER_ADMIN, NUMBER_ONCALL];

  // A. A problem: each user gets the text on their own number.
  let since = Math.floor(Date.now() / 1000) - 1;
  let sinceDate = new Date();
  await push('smstunnel.main', 5);
  const problem = await waitEvent(triggers.main, 1, since);
  let list = await waitAlerts([problem.eventid], 'PROBLEM:', 2, settled);
  check('problem: Zabbix sent 2 texts', list.length === 2 && list.every((a) => a.status === '1'),
    list.map((a) => `${a.sendto}=${a.status}${a.error ? ' ' + a.error : ''}`).join(', '));
  check('problem: each user\'s own "Send to"', both.every((n) => list.some((a) => a.sendto === n)));
  await expectTexts('problem', sinceDate, both, `PROBLEM: SMSTunnel E2E main: value is high`,
    [`Host: ${HOST}`, 'Severity: High', 'Data: Value: 5', 'Started: ', `ID: ${problem.eventid}`]);

  // B. An update (acknowledged with a comment) goes to everyone involved.
  sinceDate = new Date();
  await api.call('event.acknowledge', { eventids: [problem.eventid], action: 2 | 4, message: 'On it (E2E test)' });
  list = await waitAlerts([problem.eventid], 'UPDATED:', 1, settled);
  check('update: Zabbix sent the update text', list.length >= 1 && list.every((a) => a.status === '1'),
    list.map((a) => `${a.sendto}=${a.status}${a.error ? ' ' + a.error : ''}`).join(', '));
  await expectTexts('update', sinceDate, [...new Set(list.map((a) => a.sendto))], 'UPDATED: SMSTunnel E2E main',
    ['acknowledged', 'On it (E2E test)', 'Status: PROBLEM']);

  // C. The recovery.
  since = Math.floor(Date.now() / 1000) - 1;
  sinceDate = new Date();
  await push('smstunnel.main', 0);
  const recovery = await waitEvent(triggers.main, 0, since);
  list = await waitAlerts([problem.eventid, recovery.eventid], 'RESOLVED:', 2, settled);
  check('recovery: Zabbix sent 2 texts', list.length === 2 && list.every((a) => a.status === '1'),
    list.map((a) => `${a.sendto}=${a.status}${a.error ? ' ' + a.error : ''}`).join(', '));
  await expectTexts('recovery', sinceDate, both, 'RESOLVED: SMSTunnel E2E main: value is high',
    [`Host: ${HOST}`, 'Duration: ', 'Resolved: ']);

  // D. A 503 is worth retrying: the first try fails, Zabbix tries again 30 s later and the text goes out once.
  const stub = await startFlakyStub();
  await setParams({ server_url: `http://host.docker.internal:${STUB_PORT}` });
  since = Math.floor(Date.now() / 1000) - 1;
  sinceDate = new Date();
  await push('smstunnel.retry', 1);
  const retryProblem = await waitEvent(triggers.retry, 1, since);
  const firstTry = await waitAlerts([retryProblem.eventid], 'PROBLEM:', 2,
    (l) => l.every((a) => Number(a.retries) >= 1 || a.status !== '0'), 120000);
  const retryError = firstTry.map((a) => a.error).find(Boolean) || '';
  check('retry: the first try shows the 503 in Zabbix', /HTTP 503/.test(retryError) && /Zabbix retries/.test(retryError),
    retryError);
  await setParams({ server_url: API_URL });
  list = await waitAlerts([retryProblem.eventid], 'PROBLEM:', 2, settled, 180000);
  check('retry: sent on a later attempt', list.length === 2 && list.every((a) => a.status === '1' && Number(a.retries) >= 1),
    list.map((a) => `${a.sendto}=${a.status} retries=${a.retries}`).join(', '));
  stub.close();
  await expectTexts('retry', sinceDate, both, 'PROBLEM: SMSTunnel E2E retry');

  // Three attempts 30 s apart for the phases below: enough for a 429 (the local test server's limit is
  // shared) to pass, and the expected failures still settle in about a minute.
  await setOptions(3, '30s');

  // E. A wrong key: Zabbix shows SMSTunnel's error and gives up after the attempts.
  await setGlobalMacro('{$SMSTUNNEL.API.KEY}', BAD_KEY, 1);
  await syncConfig();
  since = Math.floor(Date.now() / 1000) - 1;
  await push('smstunnel.badkey', 1);
  const badKeyProblem = await waitEvent(triggers.badkey, 1, since);
  list = await waitAlerts([badKeyProblem.eventid], 'PROBLEM:', 2, settled);
  const keyError = list.map((a) => a.error).find(Boolean) || '';
  check('bad key: both alerts failed', list.length === 2 && list.every((a) => a.status === '2'),
    list.map((a) => `${a.sendto}=${a.status} retries=${a.retries}`).join(', '));
  check('bad key: the action log shows SMSTunnel\'s message and the macro',
    /Invalid or expired API key/.test(keyError) && keyError.includes('{$SMSTUNNEL.API.KEY}') && !keyError.includes(BAD_KEY),
    keyError);
  await setGlobalMacro('{$SMSTUNNEL.API.KEY}', KEY, 1);
  await syncConfig();

  // F. A "Send to" that is not a phone number fails for that user only.
  await api.call('user.update', { userid: oncall, medias: [media('not-a-number')] });
  since = Math.floor(Date.now() / 1000) - 1;
  sinceDate = new Date();
  await push('smstunnel.number', 1);
  const numberProblem = await waitEvent(triggers.number, 1, since);
  list = await waitAlerts([numberProblem.eventid], 'PROBLEM:', 2, settled);
  const bad = list.find((a) => a.sendto === 'not-a-number');
  const good = list.find((a) => a.sendto === NUMBER_ADMIN);
  check('invalid number: that alert failed with a clear reason',
    bad && bad.status === '2' && /is not a phone number \(not-a-number\)/.test(bad.error), bad && bad.error);
  check('invalid number: the other user still got the text', good && good.status === '1', good && good.error);
  await expectTexts('invalid number (other user)', sinceDate, [NUMBER_ADMIN], 'PROBLEM: SMSTunnel E2E number');

  // G. Several numbers in one "Send to": one media per number is asked for.
  await api.call('user.update', { userid: oncall, medias: [media('+14155550126, +14155550127')] });
  since = Math.floor(Date.now() / 1000) - 1;
  await push('smstunnel.multi', 1);
  const multiProblem = await waitEvent(triggers.multi, 1, since);
  list = await waitAlerts([multiProblem.eventid], 'PROBLEM:', 2, settled);
  const multi = list.find((a) => a.sendto.includes(','));
  check('several numbers: refused with a hint', multi && multi.status === '2' && /more than one number/.test(multi.error),
    multi && multi.error);

  // H. Optional: TLS checks inside this Zabbix (public test hosts, a dummy key, no SMSTunnel involved).
  if (args['tls-check']) {
    await api.call('user.update', { userid: oncall, medias: [media(NUMBER_ONCALL)] });
    await api.call('user.update', { userid: '1', medias: [] });
    const cases = [
      ['tls1', 'https://self-signed.badssl.com', 'full', /SSL|certificate/i, 'self-signed certificate refused (full)'],
      ['tls2', 'https://wrong.host.badssl.com', 'peer', /HTTP \d{3}/, 'wrong host accepted with peer'],
      ['tls3', 'https://wrong.host.badssl.com', 'full', /SSL|certificate|host name|subject/i, 'wrong host refused (full)'],
    ];
    for (const [phase, url, mode, expected, label] of cases) {
      await setParams({ server_url: url, api_key: 'sk_live_dummy_tls_check', tls_verify: mode });
      since = Math.floor(Date.now() / 1000) - 1;
      await push(`smstunnel.${phase}`, 1);
      const p = await waitEvent(triggers[phase], 1, since);
      list = await waitAlerts([p.eventid], 'PROBLEM:', 1, settled);
      check(`TLS: ${label}`, list[0] && list[0].status === '2' && expected.test(list[0].error), list[0] && list[0].error);
    }
    await setParams({ server_url: API_URL });
    await api.call('user.update', { userid: '1', medias: [media(NUMBER_ADMIN)] });
  }

  // I. Server log: the script's own lines never hold the key and shorten numbers.
  if (CONTAINER) {
    const lines = docker('logs', CONTAINER).split('\n');
    const ours = lines.filter((l) => l.includes('[ SMSTunnel ]'));
    const hasKey = (l) => l.includes(KEY) || l.includes(BAD_KEY);
    check('server log: the script never logs the key', ours.length > 0 && !ours.some(hasKey), `${ours.length} lines`);
    check('server log: the script logs each send at debug level', ours.some((l) => l.includes('Sending a text')));
    check('server log: the script masks numbers',
      ours.every((l) => !l.replace(/e\.g\. \+14155550123/g, '').includes(NUMBER_ADMIN)));
    // Zabbix itself writes every webhook's resolved parameters at DebugLevel 4 (raised by this test).
    const zabbixDumps = lines.filter(hasKey);
    check('server log: the key shows only in Zabbix\'s own DebugLevel 4 dump of webhook parameters',
      zabbixDumps.every((l) => l.includes('In zbx_es_execute() param:')), `${zabbixDumps.length} such lines`);
  }

  // Back to the shipped options; the media type stays pointed at the test server.
  await setOptions(5, '30s');
  await api.call('user.update', { userid: oncall, medias: [media(NUMBER_ONCALL)] });
}

let crashed = null;
try {
  await main();
} catch (error) {
  crashed = error;
  check('test ran to the end', false, error.stack || error.message);
} finally {
  if (mongo) await mongo.close();
}

const failed = results.filter((r) => !r.ok);
const version = await api.call('apiinfo.version').catch(() => 'unknown');
mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', `report-${version}.json`), JSON.stringify({ version, run: RUN, results, texts }, null, 2));
console.log(`\nZabbix ${version}: ${results.length - failed.length} passed, ${failed.length} failed.`);
process.exit(failed.length || crashed ? 1 : 0);
