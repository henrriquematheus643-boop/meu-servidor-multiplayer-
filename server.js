const WebSocket = require('ws');

// Tenta carregar o banco de dados. Se falhar, usa a memória reserva e não crasha o servidor!
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Arquivo database.js carregado com sucesso.");
} catch (e) {
    console.log("⚠️ [SISTEMA] database.js não encontrado ou com erros. Usando memória reserva.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Reduto RP rodando na porta ${PORTA}...`);

// Memória temporária para salvar as contas se o banco de dados falhar
let contasNaMemoria = new Map();

wss.on('connection', (ws) => {
    let meuNomeNoServidor = null;
    console.log("👤 Novo cliente conectado!");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido:", data.comando);

            switch (data.comando) {
                case 'registrar':
                    console.log(`🔄 [REGISTRO] Tentando cadastrar: ${data.username}`);
                    try {
                        let usuarioExiste = false;

                        // 1. Tenta buscar no banco PostgreSQL
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const res = await database.buscarUsuarioNaNuvem(data.username);
                            if (res) usuarioExiste = true;
                        } else if (contasNaMemoria.has(data.username)) {
                            usuarioExiste = true;
                        }

                        if (usuarioExiste) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso!" }));
                        } else {
                            const novoJogador = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0]
                            };

                            let salvoNoBanco = false;
                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                salvoNoBanco = await database.salvarUsuarioNaNuvem(novoJogador);
                            }

                            if (!salvoNoBanco) {
                                contasNaMemoria.set(data.username, novoJogador);
                                console.log(`💾 [MEMÓRIA] Conta salva em cache local: ${data.username}`);
                            } else {
                                console.log(`✅ [BANCO] Conta salva no PostgreSQL: ${data.username}`);
                            }

                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                        }
                    } catch (err) {
                        console.error("❌ Erro no registro, usando plano de emergência:", err);
                        let idEmergencia = Math.floor(Math.random() * 90000) + 10000;
                        contasNaMemoria.set(data.username, { username: data.username, password: data.password, id: idEmergencia, last_pos: [0, 2, 0] });
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    console.log("🔑 [LOGIN] Tentativa para: " + data.username);
                    try {
                        let conta = null;

                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            conta = await database.buscarUsuarioNaNuvem(data.username);
                        }
                        if (!conta) {
                            conta = contasNaMemoria.get(data.username);
                        }

                        if (conta && String(conta.password) === String(data.password)) {
                            meuNomeNoServidor = conta.username;
                            
                            // Manda a resposta com os dados que a Godot precisa para o spawn e teleporte
                            ws.send(JSON.stringify({ 
                                status: "logado_com_sucesso", 
                                nome_oficial: conta.username,
                                id_oficial: String(conta.id),
                                posicao: conta.last_pos || [0, 2, 0]
                            }));
                            console.log(`🔓 [SUCESSO] ${data.username} entrou.`);

                            // Avisa os outros players que você entrou no mapa (Multiplayer)
                            broadcast({
                                status: "player_nasceu",
                                username: data.username
                            }, ws);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        }
                    } catch (err) {
                        console.error("❌ Erro no login, aplicando entrada forçada:", err);
                        let idFalso = Math.floor(Math.random() * 90000) + 10000;
                        ws.send(JSON.stringify({ 
                            status: "logado_com_sucesso", 
                            nome_oficial: data.username,
                            id_oficial: String(idFalso),
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    var nome_alvo = data.username || meuNomeNoServidor;
                    if (nome_alvo && data.posicao) {
                        // Tenta atualizar no banco de dados
                        try {
                            if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                                const jogador = await database.buscarUsuarioNaNuvem(nome_alvo);
                                if (jogador) {
                                    jogador.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(jogador);
                                }
                            }
                            // Também atualiza na memória para garantir sincronia
                            let contaLocal = contasNaMemoria.get(nome_alvo);
                            if (contaLocal) {
                                contaLocal.last_pos = data.posicao;
                            }
                        } catch (e) {
                            console.error("Erro ao salvar posição no banco:", e);
                        }
                    }

                    // Envia a posição em tempo real para os outros jogadores se mexerem no seu mapa
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: nome_alvo,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro de processamento:", e);
        }
    });
});

function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

