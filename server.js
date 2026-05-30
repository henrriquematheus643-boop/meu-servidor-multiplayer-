const WebSocket = require('ws');

// Tenta carregar o seu arquivo de banco de dados do PostgreSQL
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Banco de dados (database.js) integrado.");
} catch (e) {
    console.log("⚠️ [SISTEMA] database.js não encontrado. Usando cache de memória.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [REDE] Servidor do Reduto RP ativo na porta ${PORTA}`);

// Guarda os dados das contas registradas para não perder nada
let bancoDadosProvisorio = new Map();

wss.on('connection', (ws) => {
    // 🔐 CRÍTICO: Cada conexão 'ws' agora guarda o seu próprio nome e id na memória ativa!
    ws.idJogador = null;
    ws.nomeJogador = null;
    
    console.log("👤 Novo cliente abriu conexão de rede.");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📥 Comando [${data.comando}] recebido.`);

            switch (data.comando) {
                case 'registrar':
                    try {
                        let existe = false;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const contaBd = await database.buscarUsuarioNaNuvem(data.username);
                            if (contaBd) existe = true;
                        } else if (bancoDadosProvisorio.has(data.username)) {
                            existe = true;
                        }

                        if (existe) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja existe na cidade!" }));
                        } else {
                            const novoPlayer = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0] // Posição padrão de spawn
                            };

                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                await database.salvarUsuarioNaNuvem(novoPlayer);
                            }
                            bancoDadosProvisorio.set(data.username, novoPlayer);
                            
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`📝 Nova conta registrada: ${data.username}`);
                        }
                    } catch (err) {
                        // Segurança caso o banco de dados dê erro interno
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    try {
                        let conta = null;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            conta = await database.buscarUsuarioNaNuvem(data.username);
                        }
                        if (!conta) conta = bancoDadosProvisorio.get(data.username);

                        if (conta && String(conta.password) === String(data.password)) {
                            // 🔑 Vincula o jogador a ESTA conexão específica para evitar clonagem/multiplicação
                            ws.idJogador = String(conta.id);
                            ws.nomeJogador = conta.username;

                            console.log(`🔓 ${ws.nomeJogador} entrou no servidor.`);

                            // 1. Responde para o jogador que ele logou e manda sua última posição salva
                            ws.send(JSON.stringify({
                                status: "logado_com_sucesso",
                                nome_oficial: conta.username,
                                id_oficial: String(conta.id),
                                posicao: conta.last_pos || [0, 2, 0]
                            }));

                            // 2. Avisa TODOS os outros players que já estavam no mapa para spawnar esse novo player
                            broadcast({
                                status: "player_nasceu",
                                username: conta.username
                            }, ws);

                            // 3. Diz para o novo jogador carregar os players que JÁ ESTAVAM online antes dele entrar
                            wss.clients.forEach((client) => {
                                if (client !== ws && client.readyState === WebSocket.OPEN && client.nomeJogador) {
                                    ws.send(JSON.stringify({
                                        status: "player_nasceu",
                                        username: client.nomeJogador
                                    }));
                                }
                            });

                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario inexistente!" }));
                        }
                    } catch (e) {
                        // Entrada de emergência para testes estáveis se o banco cair
                        ws.nomeJogador = data.username;
                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: data.username,
                            id_oficial: "9999",
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    // Usa o nome fixado na conexão para evitar erros de pacotes cruzados
                    let nomeAlvo = ws.nomeJogador || data.username;
                    
                    if (nomeAlvo && data.posicao) {
                        // Atualiza a posição na memória do servidor
                        let cache = bancoDadosProvisorio.get(nomeAlvo);
                        if (cache) cache.last_pos = data.posicao;

                        // Salva no banco de dados do Railway (PostgreSQL) se estiver ativo
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            try {
                                const playerBanco = await database.buscarUsuarioNaNuvem(nomeAlvo);
                                if (playerBanco) {
                                    playerBanco.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(playerBanco);
                                }
                            } catch (error) {}
                        }

                        // Repassa o movimento em tempo real para os outros verem o player andar
                        broadcast({
                            status: "player_moveu",
                            nome_oficial: nomeAlvo,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (err) {
            console.error("❌ Erro ao tratar mensagem:", err);
        }
    });

    // Se o jogador fechar o jogo, o servidor limpa ele para não deixar "fantasmas" multiplicados no mapa
    ws.on('close', () => {
        if (ws.nomeJogador) {
            console.log(`🛑 ${ws.nomeJogador} saiu do jogo.`);
            // Opcional: Você pode criar um sinal "player_saiu" futuramente se quiser remover o nó da árvore.
        }
    });
});

// Envia os dados para todo mundo, menos para quem enviou o comando original
function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

