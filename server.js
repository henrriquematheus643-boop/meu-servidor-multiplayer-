const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Esta é a memória local do Game Rubi para logins instantâneos
let usuariosCadastrados = {};

// Quando o servidor liga, ele baixa tudo o que está salvo na nuvem para a memória
async function sincronizarComANuvem() {
    console.log("[Game Rubi] Conectando ao MongoDB e baixando dados...");
    setTimeout(async () => {
        usuariosCadastrados = await banco.carregarTodosOsUsuarios();
        console.log(`[Game Rubi] Sucesso! ${Object.keys(usuariosCadastrados).length} contas carregadas da nuvem.`);
    }, 3000); // Espera 3 segundos para o MongoDB ligar com folga
}
sincronizarComANuvem();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR (Salva na memória e joga para a nuvem) ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                if (usuariosCadastrados[username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                // Salva na memória do servidor para o login automático do Godot aceitar NA HORA
                usuariosCadastrados[username] = {
                    username: username,
                    password: password,
                    id: 1000 + Object.keys(usuariosCadastrados).length,
                    last_pos: [0, 2, 0]
                };

                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                // Envia uma cópia idêntica para o MongoDB ficar salvo permanentemente
                await banco.salvarListaCompleta(usuariosCadastrados);
                return;
            }

            // --- 2. AÇÃO: LOGIN (Instantâneo e direto da memória sincronizada) ---
            if (dados.action === "login") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                const conta = usuariosCadastrados[username];

                if (conta && String(conta.password) === password) {
                    console.log(`[Reduto RP] ${username} entrou com sucesso.`);
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

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const username = String(dados.username).trim();
                if (usuariosCadastrados[username] && dados.pos) {
                    usuariosCadastrados[username].last_pos = dados.pos;
                    
                    // Atualiza a nuvem a todo momento sem travar o jogo
                    await banco.salvarListaCompleta(usuariosCadastrados);
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
