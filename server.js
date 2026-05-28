const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Servidor Reduto RP Online - Roteamento MongoDB Ativado!");

// --- PAINEL DE MONITORAMENTO NO LOG DO RENDER ---
async function mostrarContasNoRender() {
    try {
        const dados = await banco.obterTodosOsUsuarios();

        console.log("\n=======================================================");
        console.log(`📊 [PAINEL NUVEM MONGODB] CONTAS ENCONTRADAS (${dados.length})`);
        console.log("=======================================================");
        
        if (dados.length === 0) {
            console.log(" [!] Nuvem vazia. Aguardando o primeiro registro no Godot...");
        } else {
            dados.forEach((player, index) => {
                if (player.username) {
                    console.log(`${index + 1}. 👤 PLAYER: ${player.username} | 🔑 SENHA: ${player.password} | 🆔 ID: ${player.id || 'Sem ID'} | 📍 POSIÇÃO: [${player.last_pos ? player.last_pos.join(', ') : '0, 2, 0'}]`);
                }
            });
        }
        console.log("=======================================================\n");
    } catch (e) {
        console.log("[Painel Erro] Erro ao desenhar tabela: ", e.message);
    }
}

// Força a tabela a aparecer 4 segundos após ligar
setTimeout(mostrarContasNoRender, 4000);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                const contaExistente = await banco.buscarUsuarioNaNuvem(username);
                if (contaExistente) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                const novoPlayer = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                // Envia para o MongoDB
                await banco.salvarUsuarioNaNuvem(novoPlayer);
                
                // Responde o Godot
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                // Atualiza o painel do Render na mesma hora
                setTimeout(mostrarContasNoRender, 1000);
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                const conta = await banco.buscarUsuarioNaNuvem(username);

                if (conta && String(conta.password) === password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const username = String(dados.username).trim();
                
                if (username && dados.pos) {
                    const contaAtual = await banco.buscarUsuarioNaNuvem(username);
                    if (contaAtual) {
                        contaAtual.last_pos = dados.pos;
                        // Sobrescreve na nuvem com a nova localização
                        await banco.salvarUsuarioNaNuvem(contaAtual);
                    }
                }
                return;
            }

            // --- 4. TRANSMISSÃO MULTIPLAYER ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});
