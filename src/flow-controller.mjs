import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { NetworkMonitor } from './network-monitor.mjs';

export class FlowController {
  constructor(cdpClient) {
    this.client = cdpClient;
    this.network = new NetworkMonitor(cdpClient);
    this.network.start();
  }

  /**
   * Verifica se o Google Flow está aberto e autenticado na Conta Pro
   */
  async checkAuthStatus() {
    const status = await this.client.evaluate(`
      (() => {
        const url = window.location.href;
        const isFlow = url.includes('labs.google/flow') || url.includes('flow.google.com');
        const hasSignIn = !!document.querySelector('a[href*="accounts.google.com"], button[aria-label*="Sign in"], button[aria-label*="Fazer login"]');
        const hasAvatar = !!document.querySelector('img[src*="googleusercontent.com"], button[aria-label*="Google Account"], button[aria-label*="Conta do Google"]');
        
        return {
          url,
          isFlow,
          isAuthenticated: isFlow && (!hasSignIn || hasAvatar),
          title: document.title
        };
      })()
    `);

    return status;
  }

  /**
   * Preenche o campo de prompt na interface unificada
   */
  async setPrompt(promptText) {
    console.log(`📝 Inserindo prompt: "${promptText}"...`);
    const success = await this.client.evaluate(`
      (() => {
        // Localiza campo de prompt (textarea, contenteditable ou input principal)
        const el = document.querySelector('textarea, div[contenteditable="true"], input[type="text"][placeholder*="prompt" i], [aria-label*="prompt" i]');
        if (!el) return false;
        
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.value = ${JSON.stringify(promptText)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.innerText = ${JSON.stringify(promptText)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return true;
      })()
    `);

    if (!success) {
      throw new Error('Não foi possível localizar o campo de prompt na interface do Google Flow.');
    }
  }

  /**
   * Alterna entre modo de Vídeo (Veo) e Imagem (Nano Banana)
   */
  async setMode(mode = 'video') {
    console.log(`🔀 Ajustando modo para: ${mode.toUpperCase()}...`);
    await this.client.evaluate(`
      (() => {
        const target = ${JSON.stringify(mode.toLowerCase())};
        const buttons = Array.from(document.querySelectorAll('button, [role="tab"], [role="radio"]'));
        const match = buttons.find(b => {
          const text = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
          return target === 'video' ? text.includes('video') || text.includes('vídeo') : text.includes('image') || text.includes('imagem');
        });
        if (match) match.click();
      })()
    `);
  }

  /**
   * Clica no botão de gerar/criar
   */
  async triggerGenerate() {
    console.log('🚀 Disparando geração na interface...');
    const clicked = await this.client.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const genBtn = buttons.find(b => {
          const text = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
          return (text.includes('generate') || text.includes('gerar') || text.includes('create') || text.includes('criar')) && !b.disabled;
        });
        if (genBtn) {
          genBtn.click();
          return true;
        }
        return false;
      })()
    `);

    if (!clicked) {
      throw new Error('Botão de geração não encontrado ou desabilitado na interface.');
    }
  }

  /**
   * Monitora a conclusão da geração e captura o arquivo
   */
  async waitForGeneration(type = 'video', timeoutMs = 240000) {
    console.log(`⏳ Aguardando renderização do ${type}...`);
    
    // Tenta interceptação de rede primeiro
    try {
      const media = await this.network.waitForMedia(type, timeoutMs);
      return media.url;
    } catch (e) {
      console.warn('Tentando fallback via inspeção direta do DOM...');
    }

    // Fallback: busca elemento de vídeo ou imagem gerado no DOM
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const mediaUrl = await this.client.evaluate(`
        (() => {
          const video = document.querySelector('video[src]');
          if (video && video.src && !video.src.startsWith('blob:')) return video.src;
          const img = document.querySelector('img[src*="googleusercontent.com"], img[src*="storage.googleapis.com"]');
          if (img && img.src) return img.src;
          return null;
        })()
      `);

      if (mediaUrl) return mediaUrl;
      await new Promise(r => setTimeout(r, 4000));
    }

    throw new Error(`Tempo limite excedido aguardando a geração do ${type}.`);
  }

  /**
   * Baixa a mídia gerada diretamente para o disco
   */
  async saveMedia(url, outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    console.log(`⬇️  Baixando mídia para: ${outputPath}...`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha no download da mídia (HTTP ${res.status}): ${res.statusText}`);
    }

    const fileStream = createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    console.log(`💾 Arquivo salvo com sucesso: ${outputPath}`);
    return outputPath;
  }
}
