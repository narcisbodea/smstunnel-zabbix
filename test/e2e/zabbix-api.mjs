// A minimal Zabbix JSON-RPC client for the end-to-end test (Zabbix 7.0 and later: Bearer auth).

export class ZabbixApi {
  constructor(url) {
    this.url = url.replace(/\/+$/, '') + '/api_jsonrpc.php';
    this.token = null;
    this.id = 0;
  }

  async call(method, params = {}) {
    const headers = { 'Content-Type': 'application/json-rpc' };
    if (this.token && method !== 'apiinfo.version' && method !== 'user.login') {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: ++this.id }),
    });
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
        const version = await this.call('apiinfo.version');
        await this.login();
        return version;
      } catch (error) {
        lastError = error;
        await sleep(3000);
      }
    }
    throw new Error(`Zabbix API not ready: ${lastError?.message}`);
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
