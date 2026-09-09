/**
 * Monitor de tráfego de rede para interceptação de mídias geradas no Google Flow
 */
export class NetworkMonitor {
  constructor(cdpClient) {
    this.client = cdpClient;
    this.mediaUrls = [];
    this.listeners = [];
  }

  start() {
    this.client.on('Network.responseReceived', async (params) => {
      const { response } = params;
      const url = response.url || '';
      const mimeType = response.mimeType || '';

      // Intercepta respostas da API de backend da Google ou downloads diretos de mídia
      const isGoogleMedia = url.includes('aisandbox-pa.googleapis.com') ||
                            url.includes('flow.google.com') ||
                            url.includes('storage.googleapis.com') ||
                            mimeType.includes('video/mp4') ||
                            mimeType.includes('image/png') ||
                            mimeType.includes('image/webp');

      if (isGoogleMedia) {
        // Se for um link direto de vídeo ou imagem
        if (url.endsWith('.mp4') || url.includes('/video/') || mimeType === 'video/mp4') {
          this._emitMedia({ type: 'video', url, mimeType });
        } else if (url.includes('/image/') || mimeType.startsWith('image/')) {
          this._emitMedia({ type: 'image', url, mimeType });
        }
      }
    });
  }

  _emitMedia(media) {
    this.mediaUrls.push(media);
    for (const cb of this.listeners) {
      try { cb(media); } catch (e) { console.error('Erro no callback de mídia:', e); }
    }
  }

  onMedia(callback) {
    this.listeners.push(callback);
  }

  /**
   * Aguarda até que uma mídia do tipo especificado seja detectada na rede
   */
  waitForMedia(type = 'video', timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      // Verifica se já capturou
      const existing = this.mediaUrls.find(m => m.type === type);
      if (existing) return resolve(existing);

      const timer = setTimeout(() => {
        reject(new Error(`Timeout (${timeoutMs / 1000}s) aguardando renderização de ${type} pelo Google Flow.`));
      }, timeoutMs);

      const handler = (media) => {
        if (media.type === type) {
          clearTimeout(timer);
          resolve(media);
        }
      };

      this.onMedia(handler);
    });
  }
}
