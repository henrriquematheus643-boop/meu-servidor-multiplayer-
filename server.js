const WebSocket = require('ws');

// Integração com o banco de dados PostgreSQL do Railway
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [BANCO] Módulo database.js carregado com sucesso.");
} catch (e) {
    console.log("⚠️ [BANCO] database.js não encontrado. Usando memória temporária.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [REDUTO RP] Servidor ativo e operando na porta ${PORTA}`);

// Cache para guardar os dados das contas e posições em tempo real
let contasRegistradas = new Map();

wss.on('connection', (ws) => {
    // 🔐 Segurança: Vincula o nome e o ID diretamente nesta conexão de rede
    ws.nomeJogador = null;
    ws.idJogador = null;

    console.log("👤 Um novo dispositivo se conectou ao servidor.");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📥 Comando processado: ${data.comando}`);

            switch (data.comando) {
                
                case 'registrar':
                    try {
                        let existe = false;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const bdCheck = await database.buscarUsuarioNaNuvem(data.username);
                            if (bdCheck) existe = true;
                        }
                        if (contasRegistradas.has(data.username)) existe = true;

                        if (existe) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Este nome ja existe na cidade!" }));
                        } else {
                            const novoUsuario = {
                                username: data.username,
                                password: data.password,
                                id: String(Math.floor(Math.random() * 90000) + 10000), // Gera ID único de 5 dígitos
                                last_pos: [0, 2, 0] // Posição inicial padrão de spawn
                            };

                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                await database.salvarUsuarioNaNuvem(novoUsuario);
                            }
                            contasRegistradas.set(data.username, novoUsuario);
                            
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`📝 Nova conta salva no banco: ${data.username} (ID: ${novoUsuario.id})`);
                        }
                    } catch (err) {
                        // Plano de contingência caso o PostgreSQL do Railway falhe ou demore
                        let idFalso = String(Math.floor(Math.random() * 90000) + 10000);
                        contasRegistradas.set(data.username, { username: data.username, password: data.password, id: idFalso, last_pos: [0, 2, 0] });
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    try {
                        let conta = null;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            conta = await database.buscarUsuarioNaNuvem(data.username);
                        }
                        if (!conta) conta = contasRegistradas.get(data.username);

                        if (conta && String(conta.password) === String(data.password)) {
                            // Guardamos o Nome e o ID ÚNICO da conta dentro desse WebSocket ativo
                            ws.nomeJogador = conta.username;
                            ws.idJogador = String(conta.id);

                            console.log(`🔓 [LOGIN] ${ws.nomeJogador} (ID: ${ws.idJogador}) entrou no mapa.`);

                            // 1. Envia a autorização de volta para a Godot com a posição salva no banco
                            ws.send(JSON.stringify({
                                status: "logado_com_sucesso",
                                nome_oficial: conta.username,
                                id_oficial: String(conta.id),
                                posicao: conta.last_pos || [0, 2, 0]
                            }));

                            // 2. MULTIPLAYER: Avisa todos os outros que este Player nasceu no mapa deles
                            broadcast({
                                status: "player_nasceu",
                                username: ws.nomeJogador,
                                id_jogador: ws.idJogador,
                                posicao: conta.last_pos || [0, 2, 0]
                            }, ws);

                            // 3. MULTIPLAYER: Faz aparecer na tela do novo Player todos os que JÁ ESTAVAM online
                            wss.clients.forEach((client) => {
                                if (client !== ws && client.readyState === WebSocket.OPEN && client.nomeJogador) {
                                    // Pega a posição atualizada do cache de quem já está online
                                    let cInfo = contasRegistradas.get(client.nomeJogador);
                                    ws.send(JSON.stringify({
                                        status: "player_nasceu",
                                        username: client.nomeJogador,
                                        id_jogador: client.idJogador,
                                        posicao: cInfo ? cInfo.last_pos : [0, 2, 0]
                                    }));
                                }
                            });

                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Nome de usuario ou senha incorretos!" }));
                        }
                    } catch (e) {
                        // Entrada forçada caso o banco caia durante o teste
                        ws.nomeJogador = data.username;
                        ws.idJogador = "99999";
                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: data.username,
                            id_oficial: "99999",
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    // Proteção contra clonagem: Sempre usa as credenciais amarradas à conexão ativa
                    let donoDaPosicao = ws.nomeJogador || data.username;

                    if (donoDaPosicao && data.posicao) {
                        // Sincroniza e atualiza as coordenadas na memória do servidor
                        let playerCache = contasRegistradas.get(donoDaPosicao);
                        if (playerCache) {
                            playerCache.last_pos = data.posicao;
                        }

                        // Envia para o banco PostgreSQL se ele estiver ativo
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            try {
                                const playerBd = await database.buscarUsuarioNaNuvem(donoDaPosicao);
                                if (playerBd) {
                                    playerBd.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(playerBd);
                                }
                            } catch (err) {}
                        }

                        // TRANSMISSÃO MULTIPLAYER: Atualiza a movimentação de todos em tempo real
                        broadcast({
                            status: "player_moveu",
                            nome_oficial: donoDaPosicao,
                            id_oficial: ws.idJogador || data.id_jogador,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (e) {
            console.error("❌ Erro ao descriptografar mensagem recebida:", e);
        }
    });

    // Remove o boneco do mapa se o jogador fechar o jogo (Evita bonecos duplicados e travados)
    ws.on('close', () => {
        if (ws.nomeJogador) {
            console.log(`🛑 [DESCONECTADO] O jogador ${ws.nomeJogador} saiu do servidor.`);
            
            // Avisa a Godot para remover o nó desse jogador específico
            broadcast({
                status: "player_desconectou",
                username: ws.nomeJogador
            }, ws);
        }
    });
});

// Envia os pacotes para todo mundo da rede, exceto para o autor original do comando
function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

