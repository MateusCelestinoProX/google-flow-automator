# Google Flow Automator (Conexão Unificada via Chrome CDP)

Solução de automação local para o **Google Flow** (geração unificada de vídeos com **Veo 3.1** e imagens com **Nano Banana**), conectando-se diretamente ao **Google Chrome oficial com a sua Conta Pro já logada** no macOS via Chrome DevTools Protocol (CDP).

---

## 🎯 Por que esta abordagem?

- **Zero Intermediários Pagos**: Não requer assinaturas de serviços de terceiros (como os US$ 15/mês da useapi). Usa diretamente os créditos da sua Conta Pro no Google Labs.
- **Sessão Autêntica e Sem Bloqueios**: Conecta-se à porta `9222` do Google Chrome oficial (`~/.gemini/antigravity-browser-profile`), herdando sua sessão legítima, cookies e bypass de Botguard/reCAPTCHA.
- **Dependência Zero de Instalação de Browsers**: Utiliza a infraestrutura já configurada no macOS e o motor nativo de WebSocket do Node.js (v21+), sem a necessidade de baixar gigabytes de binários extras.
- **Interceptação Inteligente de Rede**: Captura diretamente as URLs de mídia em alta resolução geradas pelos servidores da Google, garantindo download confiável e rápido.

---

## 🚀 Como Usar

### 1. Diagnóstico e Verificação de Sessão
Para conferir se o Chrome está ativo e se a aba do Google Flow está autenticada na sua Conta Pro:

```bash
node src/cli.mjs status
```

### 2. Geração de Vídeo com Veo 3.1
Para gerar um vídeo cinemático:

```bash
node src/cli.mjs video --prompt "Cinematic drone shot of Rio de Janeiro at sunset, 4k photorealistic"
```

O vídeo final será baixado automaticamente na pasta `outputs/`.

### 3. Geração de Imagem com Nano Banana
Para gerar uma imagem na interface unificada:

```bash
node src/cli.mjs image --prompt "Cyberpunk coffee shop in São Paulo with neon lights, high details"
```

A imagem será salva automaticamente em `outputs/`.

---

## 📁 Estrutura de Arquivos

```text
google-flow-automator/
├── package.json            # Metadados e scripts de execução
├── README.md               # Documentação completa
├── .gitignore              # Arquivos ignorados no Git
├── src/
│   ├── cdp-client.mjs      # Cliente WebSocket nativo para Chrome DevTools Protocol
│   ├── cdp-bridge.mjs      # Conector que valida e conecta à porta 9222 do Chrome
│   ├── network-monitor.mjs # Interceptador de eventos de rede para captura de mídias
│   ├── flow-controller.mjs # Controlador de alto nível para ações no Google Flow
│   └── cli.mjs             # CLI executável com comandos status, video e image
└── outputs/                # Diretório onde as mídias finais são salvas
```

---

## 🔧 Manutenção do Chrome no macOS

O Google Chrome é mantido ativo pelo LaunchAgent configurado no sistema:
- **Porta CDP**: `9222`
- **Perfil de Usuário**: `~/.gemini/antigravity-browser-profile`
- **Launcher**: `~/.local/bin/chrome`
