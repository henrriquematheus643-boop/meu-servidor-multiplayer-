const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Servidor Reduto RP - Multiplayer & Nuvem Online!");

// --- PAINEL DE MONITORAMENTO NO LOG DO RENDER ---
// Puxa as contas salvas na nuvem e desenha uma tabela visual no painel do Render
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
        console.log("[Painel Erro] Aguardando conexão estável para renderizar dados.");
    }
}

// Mostra o painel de contas 5 segundos após o boot do servidor
setTimeout(mostrarContasNoRender, 5000);

wss.on('connection', (ws) => {
    // console.log("[Multiplayer] Um novo jogador se conectou ao WebSocket!");

    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                // Procura na nuvem se já existe esse nome
                const contaExistente = await banco.buscarUsuarioNaNuvem(username);
                if (contaExistente) {
                    return ws.send(JSON.stringify({ success: false, message: "Esta conta já existe no Reduto RP!" }));
                }

                // Cria a ficha do novo cidadão
                const novoPlayer = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0] // Coordenadas iniciais do Spawn
                };

                // Grava na nuvem MongoDB
                await banco.salvarUsuarioNaNuvem(novoPlayer);
                
                // Responde para o Godot
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                // Força o painel do Render a atualizar e mostrar a nova conta na hora
                setTimeout(mostrarContasNoRender, 1000);
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                // Puxa os dados direto do MongoDB
                const conta = await banco.buscarUsuarioNaNuvem(username);

                if (conta && String(conta.password) === password) {
                    console.log(`[Reduto RP] Jogador autenticado: ${username}`);
                    
                    // Envia o ID e a POSIÇÃO DE VOLTA para o Godot recolocar o player onde parou
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
                        contaAtual.last_pos = dados.pos; // Atualiza as coordenadas
                        
                        // Sobrescreve e crava no MongoDB instantaneamente
                        await banco.salvarUsuarioNaNuvem(contaAtual);
                    }
                }
                return;
            }

            // --- 4. TRANSMISSÃO MULTIPLAYER EM TEMPO REAL ---
            // Se o pacote não for de login/registro (ex: pacotes de movimento, chat, animação),
            // o servidor replica essa informação para todos os outros players conectados na mesma hora.
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Bloco catch vazio evita que o servidor deslique se receber algum dado corrompido do jogo
        }
    });

    ws.on('close', () => {
        // console.log("[Multiplayer] Um jogador desconectou.");
    });
});

// Proteção extra para evitar crashes por oscilações na rede do Render
process.on('uncaughtException', (err) => {
    console.log('[Sistema de Segurança] Erro interceptado:', err.message);
});
