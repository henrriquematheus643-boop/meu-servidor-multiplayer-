const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Inicializando Servidor com Painel de Monitoramento...");

// --- FUNÇÃO SECRETA: BUSCA AS CONTAS NA NUVEM E MOSTRA NO LOG DO RENDER ---
async function mostrarContasNoRender() {
    try {
        // Puxa do banco a coleção inteira para listar
        const { MongoClient } = require('mongodb');
        const uri = "mongodb://redutorp:rp123@cluster0-shard-00-00.v8k3m.mongodb.net:27017,cluster0-shard-00-01.v8k3m.mongodb.net:27017,cluster0-shard-00-02.v8k3m.mongodb.net:27017/reduto_rp?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";
        const clienteTemporario = new MongoClient(uri);
        await clienteTemporario.connect();
        const dados = await clienteTemporario.db("reduto_rp").collection("usuarios_permanentes").find({}).toArray();
        await clienteTemporario.close();

        console.log("\n=======================================================");
        console.log(`📊 [PAINEL REDUTO RP] CONTAS SALVAS NA NUVEM MONGODB (${dados.length})`);
        console.log("=======================================================");
        
        if (dados.length === 0) {
            console.log(" [!] Nenhuma conta criada ainda. Aguardando jogadores...");
        } else {
            dados.forEach((player, index) => {
                // Filtra para não mostrar lixo de sistema, apenas contas reais dos players
                if (player.username) {
                    console.log(`${index + 1}. 👤 PLAYER: ${player.username} | 🔑 SENHA: ${player.password} | 🆔 ID: ${player.id || 'Sem ID'} | 📍 POSIÇÃO: [${player.last_pos ? player.last_pos.join(', ') : '0, 2, 0'}]`);
                }
            });
        }
        console.log("=======================================================\n");
    } catch (e) {
        console.log("[Painel Erro] Não foi possível renderizar a lista de contas: ", e.message);
    }
}

// Aciona o painel assim que o servidor liga para você ver o que já tem lá
setTimeout(mostrarContasNoRender, 5000);

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

                await banco.salvarUsuarioNaNuvem(novoPlayer);
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                // Atualiza o painel do Render na mesma hora para você ver a conta surgir lá!
                setTimeout(mostrarContasNoRender, 1500);
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
                        await banco.salvarUsuarioNaNuvem(contaAtual);
                    }
                }
                return;
            }

            // --- 4. MULTIPLAYER ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});

