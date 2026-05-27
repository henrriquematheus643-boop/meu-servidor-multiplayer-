// === REDUTO RP - SERVIDOR MULTIPLAYER (server.js) ===
const WebSocket = require('ws');
const banco = require('./database.js'); // Conecta com o sistema de nuvem automaticamente!

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosCadastrados = {};
let proximoPlayerId = 1000;

// Inicializa o servidor conectando ao banco de dados na nuvem
async function iniciarServidor() {
    // Carrega todas as contas da nuvem para a memória idêntico ao seu original
    usuariosCadastrados = await banco.carregarListaUsuarios();
    proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;
    console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT} (Nuvem Ativada)`);
}
iniciarServidor();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRO (Igual ao seu original, mas salvando na nuvem) ---
            if (dados.action === "register") {
                const { username, password } = dados;
                if (usuariosCadastrados[username]) {
                    ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                } else {
                    usuariosCadastrados[username] = {
                        password: password,
                        id: proximoPlayerId++,
                        last_pos: [0, 2, 0]
                    };
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                    
                    // Salva na nuvem usando a lista do seu jeito original
                    await banco.salvarListaUsuarios(usuariosCadastrados);
                    // Cria a posição inicial na nuvem
                    await banco.salvarPosicaoPlayer(username, [0, 2, 0]);
                }
                return;
            }

            // --- 2. LOGIN (Exatamente o seu original que funcionava no Godot) ---
            if (dados.action === "login") {
                const conta = usuariosCadastrados[dados.username];
                if (conta && conta.password === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO (Exatamente o seu original) ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    
                    // Atualiza a caminhada dele lá na nuvem a todo momento
                    await banco.salvarPosicaoPlayer(username, pos);
                    console.log(`[Posição] ${username} salva na Nuvem: ${pos}`);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});
