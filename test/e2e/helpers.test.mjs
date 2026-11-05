// Offline tests of the end-to-end test's helpers: version checks, how the API token is sent to each Zabbix
// version, and the sender protocol used on Zabbix 6.0. A local stand-in plays Zabbix; nothing leaves 127.0.0.1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { deflateSync } from 'node:zlib';
import { ZabbixApi, atLeast, senderPush } from './zabbix-api.mjs';

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

test('atLeast compares major.minor', () => {
  assert.ok(atLeast('6.0.49', '6.0'));
  assert.ok(!atLeast('6.0.49', '6.2'));
  assert.ok(atLeast('6.4.0', '6.4'));
  assert.ok(atLeast('7.0.32', '6.4'));
  assert.ok(atLeast('8.0.0rc3', '7.0'));
  assert.ok(!atLeast('6.0.49', '7.0'));
});

for (const [version, mode] of [['6.0.49', 'auth'], ['7.0.32', 'bearer'], ['8.0.0', 'bearer']]) {
  test(`Zabbix ${version} gets the token ${mode === 'auth' ? 'in the request' : 'as a Bearer header'}`, async () => {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const result = body.method === 'apiinfo.version' ? version
        : body.method === 'user.login' ? 'token-123'
          : { auth: body.auth ?? null, header: req.headers.authorization ?? null };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', result, id: body.id }));
    });
    const port = await listen(server);
    try {
      const api = new ZabbixApi(`http://127.0.0.1:${port}`);
      assert.equal(await api.waitReady(), version);
      const seen = await api.call('host.get', {});
      if (mode === 'auth') assert.deepEqual(seen, { auth: 'token-123', header: null });
      else assert.deepEqual(seen, { auth: null, header: 'Bearer token-123' });
    } finally {
      server.close();
    }
  });
}

// A stand-in for the trapper: reads one sender-protocol request and answers like Zabbix does.
function trapperStandIn(compress) {
  const requests = [];
  const server = net.createServer((socket) => {
    const chunks = [];
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => {
      const all = Buffer.concat(chunks);
      const length = all.readUInt32LE(5);
      requests.push({
        magic: all.toString('ascii', 0, 4), flags: all[4], length, reserved: all.readUInt32LE(9),
        body: JSON.parse(all.toString('utf8', 13, 13 + length)), extra: all.length - 13 - length,
      });
      const answer = Buffer.from(JSON.stringify({
        response: 'success', info: 'processed: 1; failed: 0; total: 1; seconds spent: 0.000045',
      }));
      const payload = compress ? deflateSync(answer) : answer;
      const header = Buffer.alloc(13);
      header.write('ZBXD', 0, 'ascii');
      header[4] = compress ? 3 : 1;
      header.writeUInt32LE(payload.length, 5);
      header.writeUInt32LE(compress ? answer.length : 0, 9);
      socket.end(Buffer.concat([header, payload]));
    });
  });
  return { server, requests };
}

for (const compress of [false, true]) {
  test(`senderPush frames one value and reads the ${compress ? 'compressed ' : ''}answer`, async () => {
    const { server, requests } = trapperStandIn(compress);
    const port = await listen(server);
    try {
      const answer = await senderPush({ host: '127.0.0.1', port }, { host: 'web-01', key: 'smstunnel.main', value: '5' });
      assert.equal(answer.response, 'success');
      assert.match(answer.info, /processed: 1;/);
      assert.equal(requests.length, 1);
      const [request] = requests;
      assert.equal(request.magic, 'ZBXD');
      assert.equal(request.flags, 1);
      assert.equal(request.reserved, 0);
      assert.equal(request.extra, 0);
      assert.deepEqual(request.body, { request: 'sender data', data: [{ host: 'web-01', key: 'smstunnel.main', value: '5' }] });
    } finally {
      server.close();
    }
  });
}

test('senderPush fails cleanly when nothing answers in the sender protocol', async () => {
  const server = net.createServer((socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  const port = await listen(server);
  try {
    await assert.rejects(senderPush({ host: '127.0.0.1', port }, { host: 'h', key: 'k', value: '1' }),
      /no sender-protocol answer/);
  } finally {
    server.close();
  }
});
