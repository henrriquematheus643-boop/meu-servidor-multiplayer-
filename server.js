const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Servidor Reduto RP - Controle de Contas Corrigido!");

// --- PAINEL DE MONITORAMENTO NO LOG DO RENDER ---
async function mostrarContasNoRender() {
    try {
        const dados = await banco.obtenerTodosOsUsuarios();

        console.log("\n=======================================================");
        console.log(`📊 [PAINEL NUVEM MONGODB] JOGADORES SALVOS (${dados.length})`);
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
        console.log("[Painel Erro] Aguardando conexão para listar dados.");
    }
}

setTimeout(mostrarContasNoRender, 5000);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                // Força o nome a ficar em minúsculo para nunca dar erro de digitação
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                if (!username || !password) {
                    return ws.send(JSON.stringify({ success: false, message: "Dados inválidos!" }));
                }

                const contaExistente = await banco.buscarUsuarioNaNuvem(username);
                if (contaExistente) {
                    return ws.send(JSON.stringify({ success: false, message: "Esta conta já existe!" }));
                }

                const novoPlayer = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                await banco.salvarUsuarioNaNuvem(novoPlayer);
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                setTimeout(mostrarContasNoRender, 1000);
                return;
            }

            // --- 2. AÇÃO: LOGIN (CORRIGIDO) ---
            if (dados.action === "login") {
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                const conta = await banco.buscarUsuarioNaNuvem(username);

                // Checagem blindada: Garante que a conta existe antes de ler a senha
                if (conta && String(conta.username).toLowerCase() === username && String(conta.password) === password) {
                    console.log(`[Reduto RP] Jogador logado: ${username}`);
                    
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    // Se não achar ou a senha errar, avisa aqui
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const username = String(dados.username).trim().toLowerCase();
                
                if (username && dados.pos) {
                    const contaAtual = await banco.buscarUsuarioNaNuvem(username);
                    if (contaAtual) {
                        contaAtual.last_pos = dados.pos;
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

process.on('uncaughtException', (err) => {
    console.log('[Segurança] Erro evitado:', err.message);
});
