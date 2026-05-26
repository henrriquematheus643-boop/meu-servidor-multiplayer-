// === REDUTO RP - SERVIDOR MULTIPLAYER (server.js) ===
const WebSocket = require('ws');
const banco = require('./database.js'); // Importa o novo arquivo de armazenamento automaticamente!

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosCadastrados = {};
let proximoPlayerId = 1000;

// Inicializa o servidor conectando ao arquivo de banco de dados do GitHub
async function iniciarServidor() {
    usuariosCadastrados = await banco.carregarDados();
    proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;
    console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);
}
iniciarServidor();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRO ---
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
                    
                    // Salva usando a função do arquivo database.js
                    await banco.salvarDados(usuariosCadastrados);
                }
                return;
            }

            // --- 2. LOGIN ---
            if (dados.action === "login") {
                const conta = usuariosCadastrados[dados.username];
                if (conta && conta.password === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos,
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    
                    // Atualiza a caminhada dele lá no arquivo do GitHub
                    await banco.salvarDados(usuariosCadastrados);
                    console.log(`[Posição] ${username} salva no GitHub: ${pos}`);
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

