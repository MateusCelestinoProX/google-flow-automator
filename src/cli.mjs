#!/usr/bin/env node

import path from 'node:path';
import { ChromeBridge } from './cdp-bridge.mjs';
import { FlowController } from './flow-controller.mjs';

function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], positional: positional.slice(1), options };
}

function showHelp() {
  console.log(`
============================================================
  Google Flow Automator - Conexão Unificada via Chrome CDP
============================================================

Uso:
  node src/cli.mjs <comando> [opções]

Comandos:
  status                   Verifica a conexão com o Chrome oficial e a sessão Pro
  video                    Gera um vídeo com Veo 3.1
    --prompt "texto"       Descrição do vídeo a ser gerado
    --output "caminho"     (Opcional) Nome/caminho do arquivo final

  image                    Gera uma imagem com Nano Banana
    --prompt "texto"       Descrição da imagem a ser gerada
    --output "caminho"     (Opcional) Nome/caminho do arquivo final

Exemplos:
  node src/cli.mjs status
  node src/cli.mjs video --prompt "Drone shot of Rio de Janeiro at sunset, 4k cinematic"
  node src/cli.mjs image --prompt "Cyberpunk coffee shop in São Paulo, high details"
============================================================
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || options.help) {
    showHelp();
    return;
  }

  const bridge = new ChromeBridge();

  try {
    switch (command) {
      case 'status': {
        console.log('\n🔍 Verificando conexão CDP com o Google Chrome oficial...');
        const running = await bridge.isChromeRunning();
        if (!running.running) {
          console.log('🔴 Google Chrome não está ativo na porta 9222.');
          console.log('   Iniciando via launcher oficial...');
          await bridge.ensureChromeRunning();
        } else {
          console.log('🟢 Google Chrome ativo e escutando na porta 9222.');
        }

        console.log('📡 Obtendo sessão ativa da aba do Google Flow...');
        const { client } = await bridge.getFlowSession();
        const controller = new FlowController(client);

        const auth = await controller.checkAuthStatus();
        console.log('\n--- Diagnóstico da Sessão ---');
        console.log(`URL Atual:        ${auth.url}`);
        console.log(`Título da Página: ${auth.title}`);
        console.log(`Autenticado Pro:  ${auth.isAuthenticated ? '🟢 SIM' : '🟡 NÃO / Requer verificação'}`);
        console.log('-----------------------------\n');
        await client.close();
        break;
      }

      case 'video': {
        const prompt = options.prompt;
        if (!prompt) {
          console.error('❌ Erro: Forneça o prompt com --prompt "seu texto"');
          return;
        }

        console.log('\n🎬 Iniciando fluxo de geração de vídeo (Veo 3.1)...');
        const { client } = await bridge.getFlowSession();
        const controller = new FlowController(client);

        await controller.setMode('video');
        await controller.setPrompt(prompt);
        await controller.triggerGenerate();

        const mediaUrl = await controller.waitForGeneration('video');
        const outputPath = path.resolve(options.output || `./outputs/veo_${Date.now()}.mp4`);
        await controller.saveMedia(mediaUrl, outputPath);

        console.log(`\n🎉 Vídeo Veo 3.1 gerado com sucesso: ${outputPath}\n`);
        await client.close();
        break;
      }

      case 'image': {
        const prompt = options.prompt;
        if (!prompt) {
          console.error('❌ Erro: Forneça o prompt com --prompt "seu texto"');
          return;
        }

        console.log('\n🎨 Iniciando fluxo de geração de imagem (Nano Banana)...');
        const { client } = await bridge.getFlowSession();
        const controller = new FlowController(client);

        await controller.setMode('image');
        await controller.setPrompt(prompt);
        await controller.triggerGenerate();

        const mediaUrl = await controller.waitForGeneration('image');
        const outputPath = path.resolve(options.output || `./outputs/img_${Date.now()}.png`);
        await controller.saveMedia(mediaUrl, outputPath);

        console.log(`\n🎉 Imagem Nano Banana gerada com sucesso: ${outputPath}\n`);
        await client.close();
        break;
      }

      default:
        console.error(`Comando desconhecido: "${command}". Use --help para ver as opções.`);
    }
  } catch (err) {
    console.error(`\n⛔ Erro: ${err.message}\n`);
    process.exit(1);
  }
}

main();
