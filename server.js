const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP - Modo Permanente Ativado");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- REGISTRO PERMANENTE ---
            if (dados.action === "register") {
                // Checa direto na nuvem se existe
                const existe = await banco.buscarUsuarioUnico(dados.username);
                
                if (existe) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                const novaConta = {
                    username: dados.username,
                    password: dados.password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                await banco.salvarUsuarioDireto(novaConta);
                ws.send(JSON.stringify({ success: true, message: "Conta salva permanentemente!" }));
                return;
            }

            // --- LOGIN PERMANENTE ---
            if (dados.action === "login") {
                const conta = await banco.buscarUsuarioUnico(dados.username);
                
                if (conta && String(conta.password) === String(dados.password)) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Dados incorretos!" }));
                }
                return;
            }

            // --- SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                return;
            }

            // MULTIPLAYER
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            console.log("Erro no processamento:", erro);
        }
    });
});
