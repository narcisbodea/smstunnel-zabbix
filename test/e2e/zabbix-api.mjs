// A minimal Zabbix JSON-RPC client for the end-to-end test, and the trapper (sender protocol) client it needs on
// Zabbix 6.0, which has no history.push.

import net from 'node:net';
import { inflateSync } from 'node:zlib';

// True when `version` ("6.0.49", "8.0.0rc3") is at least `wanted` ("6.4").
export function atLeast(version, wanted) {
  const [a, b] = [version, wanted].map((v) => String(v).split('.').map((n) => parseInt(n, 10) || 0));
  return a[0] !== b[0] ? a[0] > b[0] : (a[1] || 0) >= (b[1] || 0);
}

export class ZabbixApi {
  constructor(url) {
    this.url = url.replace(/\/+$/, '') + '/api_jsonrpc.php';
    this.token = null;
    this.version = null;
    this.id = 0;
  }

  async call(method, params = {}) {
    const headers = { 'Content-Type': 'application/json-rpc' };
    const request = { jsonrpc: '2.0', method, params, id: ++this.id };
    if (this.token && method !== 'apiinfo.version' && method !== 'user.login') {
      // Zabbix 6.4 and later take the token as a Bearer header; 6.0 and 6.2 take it in the request ("auth").
      if (this.version && !atLeast(this.version, '6.4')) request.auth = this.token;
      else headers.Authorization = `Bearer ${this.token}`;
    }
    const res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(request) });
    const body = await res.json();
    if (body.error) {
      const err = new Error(`${method}: ${body.error.message} ${body.error.data || ''}`.trim());
      err.zabbix = body.error;
      throw err;
    }
    return body.result;
  }

  async login(username = 'Admin', password = 'zabbix') {
    this.token = await this.call('user.login', { username, password });
    return this.token;
  }

  async waitReady(timeoutMs = 180000) {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < timeoutMs) {
      try {
        this.version = await this.call('apiinfo.version');
        await this.login();
        return this.version;
      } catch (error) {
        lastError = error;
        await sleep(3000);
      }
    }
    throw new Error(`Zabbix API not ready: ${lastError?.message}`);
  }
}

// Sends one value to a trapper item, like zabbix_sender: "ZBXD", flags 1, the data length and 4 reserved bytes
// (little-endian), then the JSON. Answers {"response": "success", "info": "processed: 1; failed: 0; ..."}.
export function senderPush({ host, port }, item, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify({ request: 'sender data', data: [item] }), 'utf8');
    const header = Buffer.alloc(13);
    header.write('ZBXD', 0, 'ascii');
    header[4] = 1;
    header.writeUInt32LE(data.length, 5);
    const chunks = [];
    const socket = net.connect(port, host, () => socket.end(Buffer.concat([header, data])));
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error(`no answer from the trapper at ${host}:${port}`)));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('error', reject);
    socket.on('close', () => {
      const all = Buffer.concat(chunks);
      if (all.length < 13 || all.toString('ascii', 0, 4) !== 'ZBXD') {
        reject(new Error(`no sender-protocol answer from ${host}:${port}`));
        return;
      }
      const flags = all[4];
      const length = all.readUInt32LE(5);
      let payload = all.subarray(13, 13 + length);
      if (flags & 0x02) payload = inflateSync(payload);
      try {
        resolve(JSON.parse(payload.toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
