import http from 'node:http';

/**
 * Consulta a lista de abas ou versão do Chrome via HTTP na porta CDP
 */
export async function getCdpEndpoint(host = '127.0.0.1', port = 9222, path = '/json/version') {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Falha ao decodificar resposta CDP: ${data}`));
          }
        } else {
          reject(new Error(`Erro HTTP ao conectar ao Chrome CDP (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', err => {
      reject(new Error(`Não foi possível conectar ao Google Chrome na porta ${port}: ${err.message}`));
    });

    req.setTimeout(4000, () => {
      req.destroy();
      reject(new Error(`Timeout ao conectar ao Chrome na porta ${port}`));
    });
  });
}

/**
 * Retorna a lista de todas as abas abertas no Chrome oficial
 */
export async function getOpenTabs(host = '127.0.0.1', port = 9222) {
  return getCdpEndpoint(host, port, '/json/list');
}

/**
 * Cliente WebSocket CDP nativo (Node 21+ com globalThis.WebSocket)
 */
export class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  static async connectToTab(tab) {
    if (!tab.webSocketDebuggerUrl) {
      throw new Error(`Aba não possui webSocketDebuggerUrl disponível.`);
    }
    const client = new CDPClient(tab.webSocketDebuggerUrl);
    await client.connect();
    return client;
  }

  static async connectToFlowTab(host = '127.0.0.1', port = 9222) {
    const tabs = await getOpenTabs(host, port);
    // Procura aba existente do Google Flow
    let flowTab = tabs.find(t => t.url && (t.url.includes('labs.google/flow') || t.url.includes('flow.google.com')));
    
    if (!flowTab) {
      // Abre uma nova aba se não encontrar
      console.log('Criando nova aba para o Google Flow...');
      const version = await getCdpEndpoint(host, port, '/json/new?https://labs.google/flow');
      flowTab = version;
    }

    return CDPClient.connectToTab(flowTab);
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
      } catch (err) {
        return reject(err);
      }

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (err) => {
        reject(new Error(`Erro na conexão WebSocket CDP: ${err.message || 'Falha de conexão'}`));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve: reqResolve, reject: reqReject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
              reqReject(new Error(`CDP Error [${msg.error.code}]: ${msg.error.message}`));
            } else {
              reqResolve(msg.result);
            }
          } else if (msg.method) {
            const listeners = this.eventListeners.get(msg.method) || [];
            for (const fn of listeners) {
              try { fn(msg.params); } catch (e) { console.error('Erro no listener CDP:', e); }
            }
          }
        } catch (e) {
          console.error('Erro ao processar mensagem CDP:', e);
        }
      };

      this.ws.onclose = () => {
        for (const { reject: reqReject } of this.pending.values()) {
          reqReject(new Error('Conexão WebSocket CDP encerrada.'));
        }
        this.pending.clear();
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(listener);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      throw new Error(`Erro na execução de JavaScript: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res?.result?.value;
  }

  async navigate(url) {
    await this.send('Page.enable');
    return this.send('Page.navigate', { url });
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
