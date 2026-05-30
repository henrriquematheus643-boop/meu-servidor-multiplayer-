const express = require('express');
const http = require('http');
const WebSocket = require('ws'); // Ou socket.io, dependendo do seu sistema
const fs = require('fs').promises; // Usando promises para NÃO travar o servidor

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
let mapaDados = null;

// 1. CARREGAMENTO DO MAPA ULTRA-LEVE (ASSÍNCRONO)
// Isso impede que o Node.js trave o loop de eventos e fique "Offline"
async function carregarMapaSeguro() {
    try {
        console.log("[SERVER] Carregando dados da cidade de forma otimizada...");
        // Substitua pelo caminho real do seu arquivo de dados da cidade (JSON ou TSCN)
        const data = await fs.readFile('./mapa_cidade.json', 'utf8'); 
        mapaDados = JSON.parse(data);
        console.log("[SERVER] Cidade carregada com sucesso! Pronto para o Multiplayer.");
    } catch (err) {
        console.error("[ERRO] Não foi possível carregar o mapa, mas o servidor continuará ONLINE:", err.message);
        // Mantém uma array vazia para o servidor não crashar se o mapa sumir
        mapaDados = []; 
    }
}

// 2. GERENCIADOR DO MULTIPLAYER (LÓGICA DE REDE)
wss.on('connection', (ws) => {
    console.log("[MULTIPLAYER] Novo jogador conectado!");

    // Envia o status online e os dados do mapa imediatamente para o Player
    ws.send(JSON.stringify({
        type: "STATUS",
        online: true,
        mensagem: "Conectado ao Multiplayer Manager"
    }));

    // Se o player pedir o mapa, envia sem travar os outros jogadores
    ws.on('message', (message) => {
        try {
            const pacote = JSON.parse(message);
            if (pacote.type === "REQUEST_MAP") {
                ws.send(JSON.stringify({ type: "MAP_DATA", data: mapaDados }));
            }
        } catch (e) {
            console.error("[BREADCRUMB] Erro ao processar mensagem do cliente.");
        }
    });

    ws.on('close', () => {
        console.log("[MULTIPLAYER] Jogador desconectou.");
    });
});

// 3. INICIALIZAÇÃO BLINDADA
async function iniciarServidor() {
    // Primeiro carrega o mapa em segundo plano para não dar Timeout na porta
    await carregarMapaSeguro();

    server.listen(PORT, () => {
        console.log(`\n==========================================`);
        console.log(`  MULTIPLAYER MANAGER ONLINE NA PORTA ${PORT} `);
        console.log(`==========================================\n`);
    });
}

iniciarServidor();
