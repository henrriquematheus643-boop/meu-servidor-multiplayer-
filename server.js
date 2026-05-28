const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Servidor Reduto RP - Controle Supabase Ativado!");

async function mostrarContasNoRender() {
    try {
        const dados = await banco.obterTodosOsUsuarios();
        console.log("\n=======================================================");
        console.log(`📊 [PAINEL NUVEM SUPABASE] JOGADORES ATUAIS NO BANCO (${dados.length})`);
        console.log("=======================================================");
        if (dados.length === 0) {
            console.log(" [!] Banco de dados limpo e vazio.");
        } else {
            dados.forEach((player, index) => {
                if (player.username) {
                    console.log(`${index + 1}. 👤 ${player.username.toUpperCase()} | 🔑 SENHA: ${player.password} | 🆔 ID: ${player.id} | 📍 POS: [${player.last_pos ? player.last_pos.join(', ') : '0, 2, 0'}]`);
                }
            });
        }
        console.log("=======================================================\n");
    } catch (e) {
        console.log("[Painel Erro] Erro ao listar contas.");
    }
}

setTimeout(mostrarContasNoRender, 5000);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                if (!username || !password) {
                    return ws.send(JSON.stringify({ success: false, message: "Campos vazios inválidos!" }));
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

                const salvouComSucesso = await banco.salvarUsuarioNaNuvem(novoPlayer);
                
                if (salvouComSucesso) {
                    console.log(`\n✅ [NUVEM] CONTA '${username.toUpperCase()}' SALVA NO SUPABASE COM SUCESSO!`);
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                    setTimeout(mostrarContasNoRender, 1000);
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Erro crítico ao salvar na nuvem!" }));
                }
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                const conta = await banco.buscarUsuarioNaNuvem(username);

                if (conta && String(conta.username).toLowerCase() === username && String(conta.password) === password) {
                    console.log(`[Reduto RP] Login efetuado: ${username}`);
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

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
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

