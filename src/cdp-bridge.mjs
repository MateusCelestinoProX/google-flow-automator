import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getCdpEndpoint, getOpenTabs, CDPClient } from './cdp-client.mjs';

const execAsync = promisify(exec);

export class ChromeBridge {
  constructor({ host = '127.0.0.1', port = 9222 } = {}) {
    this.host = host;
    this.port = port;
  }

  /**
   * Verifica se o Chrome oficial está ativo e respondendo na porta CDP
   */
  async isChromeRunning() {
    try {
      const version = await getCdpEndpoint(this.host, this.port, '/json/version');
      return { running: true, version };
    } catch {
      return { running: false };
    }
  }

  /**
   * Dispara o inicializador oficial do Chrome caso não esteja rodando
   */
  async ensureChromeRunning() {
    const status = await this.isChromeRunning();
    if (status.running) {
      return status;
    }

    console.log('Iniciando Google Chrome oficial com flags de automação...');
    try {
      // Usa o script launcher oficial configurado no macOS
      await execAsync('~/.local/bin/chrome 2>/dev/null || open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.gemini/antigravity-browser-profile"');
    } catch (e) {
      console.warn('Tentando fallback de inicialização direta do Chrome...');
      await execAsync('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.gemini/antigravity-browser-profile" --remote-allow-origins="*" >/dev/null 2>&1 &');
    }

    // Aguarda até 5 segundos para a porta ficar disponível
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      const retry = await this.isChromeRunning();
      if (retry.running) {
        console.log('✅ Google Chrome conectado com sucesso na porta 9222!');
        return retry;
      }
    }

    throw new Error('Não foi possível conectar ao Google Chrome na porta 9222. Verifique se o daemon está ativo com "launchctl list | grep antigravity".');
  }

  /**
   * Obtém conexão ativa com a aba do Google Flow
   */
  async getFlowSession() {
    await this.ensureChromeRunning();
    const tabs = await getOpenTabs(this.host, this.port);
    
    // Procura por aba com labs.google/flow ou flow.google.com
    let tab = tabs.find(t => t.url && (t.url.includes('labs.google/flow') || t.url.includes('flow.google.com')));

    if (!tab) {
      console.log('Aba do Google Flow não encontrada. Abrindo nova aba...');
      tab = await getCdpEndpoint(this.host, this.port, '/json/new?https://labs.google/flow');
    }

    const client = await CDPClient.connectToTab(tab);

    // Habilita domínios fundamentais do CDP
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    return { client, tab };
  }
}
