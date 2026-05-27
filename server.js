// === REDUTO RP - SERVIDOR MULTIPLAYER (server.js) ===
const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Jarvis] Servidor de Pastas Reduto RP Online!`);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- REGISTRO (Cria a Pasta) ---
            if (dados.action === "register") {
                const existe = await banco.carregarDadosPlayer(dados.username);
                if (existe) {
                    ws.send(JSON.stringify({ success: false, message: "Este player já tem uma pasta!" }));
                } else {
                    const novosDados = {
                        nome: dados.username,
                        senha: dados.password,
                        posicao: [0, 2, 0],
                        inventario: [], // Exemplo para o futuro
                        carteira: 500   // Exemplo para o futuro
                    };
                    await banco.salvarDadosPlayer(dados.username, novosDados);
                    ws.send(JSON.stringify({ success: true, message: "Pasta criada no Game Rubi!" }));
                }
                return;
            }

            // --- LOGIN (Lê da Pasta) ---
            if (dados.action === "login") {
                const conta = await banco.carregarDadosPlayer(dados.username);
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        last_pos: conta.posicao,
                        message: `Bem vindo à sua pasta, ${dados.username}!`
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha ou Pasta não encontrada!" }));
                }
                return;
            }

            // --- SALVAR POSIÇÃO (Atualiza dentro da Pasta) ---
            if (dados.action === "save_position") {
                const conta = await banco.carregarDadosPlayer(dados.username);
                if (conta) {
                    conta.posicao = dados.pos;
                    await banco.salvarDadosPlayer(dados.username, conta);
                }
                return;
            }

            // REPASSE MULTIPLAYER
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});
