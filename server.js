const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Inicializando Servidor Blindado do Reduto RP...");

async function mostrarContasNoRender() {
    try {
        const dados = await banco.obterTodosOsUsuarios();
        console.log("\n=======================================================");
        console.log(`📊 [PAINEL NUVEM] JOGADORES CADASTRADOS (${dados.length})`);
        console.log("=======================================================");
        if (dados.length === 0) {
            console.log(" [!] Banco de dados limpo. Aguardando registros...");
        } else {
            dados.forEach((player, index) => {
                if (player.username) {
                    console.log(`${index + 1}. 👤 PLAYER: ${player.username} | 🔑 SENHA: ${player.password} | 🆔 ID: ${player.id || 'Sem ID'} | 📍 POSIÇÃO: [${player.last_pos ? player.last_pos.join(', ') : '0, 2, 0'}]`);
                }
            });
        }
        console.log("=======================================================\n");
    } catch (e) {
        console.log("[Painel] Aguardando sincronização completa da nuvem...");
    }
}

// Ativa a listagem automática
setTimeout(mostrarContasNoRender, 6000);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
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

                await banco.salvarUsuarioNaNuvem(novoPlayer);
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                setTimeout(mostrarContasNoRender, 1000);
                return;
            }

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

            if (dados.action === "save_position") {
                const username = String(dados.username).trim();
                if (username && dados.pos) {
                    const contaAtual = await banco.buscarUsuarioNaNuvem(username);
                    if (contaAtual) {
                        contaAtual.last_pos = dados.pos;
                        await banco.salvarUsuarioNaNuvem(contaAtual);
                    }
                }
                return;
            }

            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Protege o servidor contra quedas por pacotes corrompidos do Godot
        }
    });
});

// Mantém o processo do Node ativo mesmo se houver erros não capturados na nuvem
process.on('uncaughtException', (err) => {
    console.log('[Aviso Seguro] Erro ignorado para evitar crash:', err.message);
});
