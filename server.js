const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP Online - Focado na Nuvem");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- REGISTRO ---
            if (dados.action === "register") {
                const existe = await banco.buscarUsuario(dados.username);
                
                if (existe) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                const novoPlayer = {
                    username: dados.username,
                    password: dados.password, // Batendo com o Godot
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                await banco.salvarUsuario(novoPlayer);
                console.log(`[Nuvem] Nova conta criada: ${dados.username}`);
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                return;
            }

            // --- LOGIN ---
            if (dados.action === "login") {
                const conta = await banco.buscarUsuario(dados.username);

                // Verificação rigorosa de senha e nome
                if (conta && String(conta.password) === String(dados.password)) {
                    console.log(`[Nuvem] Login realizado: ${dados.username}`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // --- SALVAR POSIÇÃO (A todo momento) ---
            if (dados.action === "save_position") {
                await banco.atualizarPosicao(dados.username, dados.pos);
                return;
            }

            // --- MULTIPLAYER ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (e) {
            // Silencia erros de JSON malformado
        }
    });
});
