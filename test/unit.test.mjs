// Unit tests for the webhook script: it runs here with stand-ins for Zabbix's HttpRequest and Zabbix objects.
// The end-to-end test (test/e2e/e2e.mjs) runs the same script inside a real Zabbix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import yaml from 'js-yaml';
import { buildYaml } from '../scripts/build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = readFileSync(join(root, 'src', 'smstunnel.js'), 'utf8');
const KEY = 'sk_live_unit_test_key_0123456789abcdef';

// Runs the script once, as Zabbix does: `value` is the JSON of the parameters; the script returns or throws.
function run(params, reply = {}) {
  const calls = [];
  const logs = [];

  class HttpRequest {
    constructor(options) {
      this.options = options;
      this.headers = [];
      this.proxy = null;
      this.status = 0;
      calls.push(this);
    }
    addHeader(header) { this.headers.push(header); }
    setProxy(proxy) { this.proxy = proxy; }
    getStatus() { return this.status; }
    getHeaders() { return reply.headers || {}; }
    post(url, body) {
      this.url = url;
      this.body = body;
      if (reply.throws) throw new Error(reply.throws);
      this.status = reply.status ?? 200;
      if (reply.raw !== undefined) return reply.raw;
      return JSON.stringify(reply.body ?? {
        success: true,
        messageId: '6ae7b286ed02a29dd5391024',
        data: { messageId: '6ae7b286ed02a29dd5391024', branded: false, remaining: { clean: -1, total: 'unlimited' } },
      });
    }
  }

  const Zabbix = { log: (level, message) => logs.push({ level, message }) };
  const fn = new Function('value', 'HttpRequest', 'Zabbix', SCRIPT);
  let result;
  let error;
  try {
    result = fn(JSON.stringify(params), HttpRequest, Zabbix);
  } catch (e) {
    error = e;
  }
  return { result, error, calls, logs, request: calls[0], body: calls[0]?.body ? JSON.parse(calls[0].body) : undefined };
}

const base = (extra = {}) => ({
  api_key: KEY,
  default_country_code: '{$SMSTUNNEL.COUNTRY.CODE}',
  device_id: '{$SMSTUNNEL.DEVICE.ID}',
  max_length: '320',
  message: 'Host: web01\nSeverity: High\nStarted: 2026.11.01 10:00:00',
  send_to: '+14155550123',
  subject: 'PROBLEM: CPU load is too high',
  tls_verify: '{$HTTP.TLS.VERIFY:"SMSTunnel"}',
  ...extra,
});

test('is plain ES5, so Zabbix (Duktape) can run it', () => {
  assert.doesNotThrow(() => acorn.parse(`(function (value) {\n${SCRIPT}\n})`, { ecmaVersion: 5 }));
});

test('media_smstunnel.yaml is built from src/ and carries the same script', () => {
  const file = readFileSync(join(root, 'media_smstunnel.yaml'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(file, buildYaml());
  const doc = yaml.load(file);
  assert.equal(doc.zabbix_export.version, '7.0');
  const media = doc.zabbix_export.media_types[0];
  assert.equal(media.name, 'SMSTunnel');
  assert.equal(media.type, 'WEBHOOK');
  assert.equal(media.script, SCRIPT.replace(/\r\n/g, '\n'));
  const params = Object.fromEntries(media.parameters.map((p) => [p.name, p.value]));
  assert.equal(params.api_key, '{$SMSTUNNEL.API.KEY}');
  assert.equal(params.send_to, '{ALERT.SENDTO}');
  assert.equal(params.subject, '{ALERT.SUBJECT}');
  assert.equal(params.message, '{ALERT.MESSAGE}');
  assert.equal(params.tls_verify, '{$HTTP.TLS.VERIFY:"SMSTunnel"}');
  assert.ok(!('server_url' in params), 'server_url stays out of the shipped parameters');
  const modes = media.message_templates.map((t) => `${t.event_source}/${t.operation_mode}`);
  for (const mode of ['TRIGGERS/PROBLEM', 'TRIGGERS/RECOVERY', 'TRIGGERS/UPDATE', 'SERVICE/PROBLEM']) {
    assert.ok(modes.includes(mode), mode);
  }
  assert.doesNotMatch(file, /sk_live_[A-Za-z0-9]/, 'no key in the shipped file');
});

// Typical values, to see how long the shipped templates' texts are on a phone.
const SAMPLE = {
  'EVENT.NAME': 'High CPU utilization (over 90% for 5m)', 'HOST.NAME': 'web-01', 'HOST.HOST': 'web-01',
  'EVENT.SEVERITY': 'High', 'EVENT.OPDATA': 'Current utilization: 97.3 %', 'EVENT.DATE': '2026.11.01',
  'EVENT.TIME': '10:00:00', 'EVENT.ID': '123456', 'EVENT.DURATION': '12m 30s', 'EVENT.RECOVERY.DATE': '2026.11.01',
  'EVENT.RECOVERY.TIME': '10:12:30', 'USER.FULLNAME': 'Ana Pop (ana)', 'EVENT.UPDATE.ACTION': 'acknowledged',
  'EVENT.UPDATE.TIME': '10:05:00', 'EVENT.UPDATE.MESSAGE': 'On it', 'EVENT.STATUS': 'PROBLEM', 'EVENT.AGE': '5m',
  'DISCOVERY.DEVICE.STATUS': 'Up', 'DISCOVERY.DEVICE.IPADDRESS': '192.168.1.20', 'DISCOVERY.RULE.NAME': 'Local network',
  'DISCOVERY.DEVICE.DNS': 'printer.lan', 'DISCOVERY.SERVICE.NAME': 'HTTP', 'DISCOVERY.SERVICE.PORT': '80',
  'DISCOVERY.SERVICE.STATUS': 'Up', 'HOST.IP': '192.168.1.30', 'HOST.PORT': '10050', 'SERVICE.NAME': 'Web shop',
  'EVENT.UPDATE.SEVERITY': 'Average',
};
const resolve = (text) => text.replace(/\{([A-Z.]+)\}/g, (all, name) => SAMPLE[name] ?? all);

test('the shipped templates fit in one SMS (160 characters) with typical values', () => {
  const media = yaml.load(readFileSync(join(root, 'media_smstunnel.yaml'), 'utf8')).zabbix_export.media_types[0];
  for (const t of media.message_templates) {
    const { body, error } = run(base({ subject: resolve(t.subject), message: resolve(t.message) }));
    assert.equal(error, undefined);
    assert.doesNotMatch(body.message, /\{[A-Z.]+\}/, `${t.event_source}/${t.operation_mode}: every macro has a sample`);
    assert.ok(body.message.length <= 160, `${t.event_source}/${t.operation_mode}: ${body.message.length} chars`);
  }
});

test('sends one text: POST /api/v1/sms/send with X-API-Key, TLS checked', () => {
  const { result, error, calls, request, body } = run(base());
  assert.equal(error, undefined);
  assert.equal(calls.length, 1);
  assert.equal(request.url, 'https://smstunnel.io/api/v1/sms/send');
  assert.ok(request.headers.includes(`X-API-Key: ${KEY}`));
  assert.ok(request.headers.includes('Content-Type: application/json'));
  assert.deepEqual(request.options, { SSLVerifyPeer: true, SSLVerifyHost: true });
  assert.deepEqual(body, {
    to: '+14155550123',
    message: 'PROBLEM: CPU load is too high\nHost: web01\nSeverity: High\nStarted: 2026.11.01 10:00:00',
  });
  assert.deepEqual(JSON.parse(result), { status: 'sent', to: '+14155550123', messageId: '6ae7b286ed02a29dd5391024' });
});

test('adds deviceId and defaultCountryCode only when they are set', () => {
  const { body } = run(base({ device_id: '6ae660e96609f21a1184a210', default_country_code: '+40', send_to: '0721 123 456' }));
  assert.equal(body.deviceId, '6ae660e96609f21a1184a210');
  assert.equal(body.defaultCountryCode, '+40');
  assert.equal(body.to, '0721123456');
  const plain = run(base({ device_id: '', default_country_code: '  ' })).body;
  assert.ok(!('deviceId' in plain) && !('defaultCountryCode' in plain));
});

test('tidies the text: CRLF, trailing spaces, empty "Label:" and *UNKNOWN* lines', () => {
  const { body } = run(base({
    subject: 'PROBLEM: Disk full ',
    message: 'Host: db01\r\nData: \r\nOwner: *UNKNOWN*\r\nSeverity: Disaster  \r\n\r\n\r\n\r\nID: 42\r\n',
  }));
  assert.equal(body.message, 'PROBLEM: Disk full\nHost: db01\nSeverity: Disaster\n\nID: 42');
});

test('does not repeat the subject when the message already starts with it', () => {
  const { body } = run(base({ subject: 'Disk full', message: 'Disk full on db01' }));
  assert.equal(body.message, 'Disk full on db01');
});

test('cuts a long text to max_length and ends it with "..."', () => {
  const long = 'x'.repeat(1000);
  assert.equal(run(base({ subject: '', message: long })).body.message.length, 320);
  assert.ok(run(base({ subject: '', message: long })).body.message.endsWith('...'));
  assert.equal(run(base({ subject: '', message: long, max_length: '160' })).body.message.length, 160);
  assert.equal(run(base({ subject: '', message: 'y'.repeat(5000), max_length: '99999' })).body.message.length, 1600);
  assert.equal(run(base({ subject: '', message: long, max_length: 'abc' })).body.message.length, 320);
  const short = run(base({ subject: '', message: 'short' })).body.message;
  assert.equal(short, 'short');
});

test('never splits an emoji when it cuts', () => {
  const text = 'a'.repeat(16) + '\u{1F525}' + 'b'.repeat(50);
  const { body } = run(base({ subject: '', message: text, max_length: '20' }));
  assert.equal(body.message, 'a'.repeat(16) + '...');
});

test('the Test window (unresolved {ALERT.*}) sends a test text', () => {
  const { body, error } = run(base({ subject: '{ALERT.SUBJECT}', message: '{ALERT.MESSAGE}' }));
  assert.equal(error, undefined);
  assert.match(body.message, /^Test from Zabbix: SMSTunnel is set up/);
});

test('an empty text from a real alert is an error, and nothing is sent', () => {
  const { error, calls } = run(base({ subject: '', message: '  ' }));
  assert.match(String(error), /the text is empty/);
  assert.equal(calls.length, 0);
});

test('a missing key names the macro, and nothing is sent', () => {
  for (const api_key of ['{$SMSTUNNEL.API.KEY}', '', '<PLACE KEY>', undefined]) {
    const { error, calls } = run(base({ api_key }));
    assert.match(String(error), /^SMSTunnel: no API key/);
    assert.match(String(error), /\{\$SMSTUNNEL\.API\.KEY\}/);
    assert.equal(calls.length, 0);
  }
  assert.match(String(run(base({ api_key: 'sk_live_a\r\nX-Evil: 1' })).error), /line break/);
});

test('checks "Send to": one phone number per media', () => {
  assert.match(String(run(base({ send_to: '{ALERT.SENDTO}' })).error), /no phone number/);
  assert.match(String(run(base({ send_to: '' })).error), /no phone number/);
  assert.match(String(run(base({ send_to: '+14155550123, +14155550124' })).error), /more than one number/);
  assert.match(String(run(base({ send_to: 'abc' })).error), /is not a phone number \(abc\)/);
  assert.match(String(run(base({ send_to: '+1' })).error), /is not a phone number/);
  assert.match(String(run(base({ send_to: '+1234567890123456' })).error), /is not a phone number/);
  assert.equal(run(base({ send_to: '+1 (415) 555-0123' })).body.to, '+14155550123');
  assert.equal(run(base({ send_to: '0040 721.123.456' })).body.to, '0040721123456');
});

test('checks the country code', () => {
  assert.match(String(run(base({ default_country_code: 'RO' })).error), /not a calling code/);
  assert.equal(run(base({ default_country_code: '0049' })).body.defaultCountryCode, '0049');
});

test('401: shows SMSTunnel\'s words and the macro to check, never the key', () => {
  const { error } = run(base(), {
    status: 401,
    body: { message: 'Invalid or expired API key', error: 'Unauthorized', statusCode: 401 },
  });
  const text = String(error);
  assert.match(text, /^SMSTunnel: the API key was not accepted \(HTTP 401: Invalid or expired API key\)/);
  assert.match(text, /\{\$SMSTUNNEL\.API\.KEY\}/);
  assert.ok(!text.includes(KEY));
});

test('400: joins the list of reasons and points at "Send to"', () => {
  const { error } = run(base({ send_to: '+40 721 123 456' }), {
    status: 400,
    body: { message: ['Phone number must contain 7-25 characters'], error: 'Bad Request', statusCode: 400 },
  });
  assert.match(String(error), /HTTP 400: Phone number must contain 7-25 characters\)\. Check the number in "Send to"\./);
});

test('403: carries the code and a hint for PERMISSION_REQUIRED', () => {
  const { error } = run(base(), {
    status: 403,
    body: { message: 'This API key lacks sms:send', code: 'PERMISSION_REQUIRED', statusCode: 403 },
  });
  assert.match(String(error), /HTTP 403: This API key lacks sms:send \[PERMISSION_REQUIRED\]\)\. Use an API key that can send texts\./);
});

test('429 and 5xx are worth retrying: the message says Zabbix retries', () => {
  const limited = String(run(base(), {
    status: 429,
    headers: { 'Retry-After': '60' },
    body: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
  }).error);
  assert.match(limited, /too many texts in a short time \(HTTP 429: Too Many Requests, wait 60 s\)/);
  assert.match(limited, /Zabbix retries/);

  const down = String(run(base(), { status: 502, raw: '<html><body><h1>502 Bad Gateway</h1></body></html>' }).error);
  assert.match(down, /could not take the text right now \(HTTP 502: 502 Bad Gateway\)/);
  assert.match(down, /Zabbix retries/);

  const unreachable = String(run(base(), { throws: 'cannot get URL: Could not resolve host: smstunnel.io.' }).error);
  assert.match(unreachable, /could not reach https:\/\/smstunnel\.io \(cannot get URL: Could not resolve host/);
  assert.match(unreachable, /Zabbix retries/);
});

test('a certificate problem names the fix and is not called temporary', () => {
  const text = String(run(base(), {
    throws: 'cannot get URL: SSL certificate problem: unable to get local issuer certificate.',
  }).error);
  assert.match(text, /^SMSTunnel: the certificate of https:\/\/smstunnel\.io was not accepted \(cannot get URL: SSL/);
  assert.match(text, /ca-certificates/);
  assert.match(text, /\{\$HTTP\.TLS\.VERIFY:"SMSTunnel"\}/);
  assert.doesNotMatch(text, /Zabbix retries/);
});

test('a 2xx answer that does not confirm the text is an error', () => {
  assert.match(String(run(base(), { status: 200, raw: 'OK' }).error), /did not confirm the text/);
  assert.match(String(run(base(), { status: 200, body: { success: false, error: 'No phone' } }).error),
    /HTTP 200: No phone\) did not confirm/);
});

test('a phone that is offline: the text waits and the result says so', () => {
  const { result } = run(base(), {
    body: { success: true, messageId: 'm1', queued: true, data: { messageId: 'm1', queued: true } },
  });
  const parsed = JSON.parse(result);
  assert.equal(parsed.status, 'queued');
  assert.match(parsed.note, /offline/);
});

test('TLS: none allows a plain-HTTP test server, full refuses it, peer skips the host check', () => {
  const local = run(base({ server_url: 'http://host.docker.internal:3101/', tls_verify: 'none' }));
  assert.equal(local.error, undefined);
  assert.equal(local.request.url, 'http://host.docker.internal:3101/api/v1/sms/send');
  assert.deepEqual(local.request.options, { SSLVerifyPeer: false, SSLVerifyHost: false });
  assert.match(String(run(base({ server_url: 'http://example.test' })).error), /plain HTTP while TLS verification is on/);
  assert.deepEqual(run(base({ tls_verify: 'PEER' })).request.options, { SSLVerifyPeer: true, SSLVerifyHost: false });
  assert.deepEqual(run(base({ tls_verify: 'nonsense' })).request.options, { SSLVerifyPeer: true, SSLVerifyHost: true });
  assert.match(String(run(base({ server_url: 'smstunnel.io' })).error), /is not a web address/);
});

test('uses an HTTP proxy when http_proxy (or HTTPProxy) is set', () => {
  assert.equal(run(base({ http_proxy: 'http://proxy:3128' })).request.proxy, 'http://proxy:3128');
  assert.equal(run(base({ HTTPProxy: 'socks5://proxy:1080' })).request.proxy, 'socks5://proxy:1080');
  assert.equal(run(base()).request.proxy, null);
});

test('the key never reaches a log line or an error, even when a server echoes it', () => {
  const outcomes = [
    run(base()),
    run(base(), { status: 401, body: { message: `Key ${KEY} is not valid` } }),
    run(base(), { throws: `cannot get URL: ${KEY}` }),
    run(base({ send_to: 'abc' })),
  ];
  for (const { logs, error } of outcomes) {
    for (const { message } of logs) assert.ok(!message.includes(KEY), message);
    if (error) assert.ok(!String(error).includes(KEY), String(error));
  }
  assert.match(String(outcomes[1].error), /Key \[API key\] is not valid/);
  const sendLog = outcomes[0].logs.find((l) => l.message.includes('Sending a text'));
  assert.ok(sendLog && !sendLog.message.includes('+14155550123'), 'the number is masked in the log');
});
