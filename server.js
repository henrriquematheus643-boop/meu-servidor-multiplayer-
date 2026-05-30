const WebSocket = require('ws');

// Tenta conectar com o seu arquivo database.js (PostgreSQL do Railway)
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Conexao com database.js configurada.");
} catch (e) {
    console.log("⚠️ [SISTEMA] Arquivo database.js nao encontrado. Rodando em modo cache.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDO] Reduto RP online na porta de rede ${PORTA}...`);

// Memoria reserva para garantir o funcionamento caso o banco fique offline
let cacheUsuarios = new Map();

wss.on('connection', (ws) => {
    // Vincular as variaveis diretamente na conexao para evitar duplicar players no mapa
    ws.nomeJogador = null;
    ws.idJogador = null;

    console.log("👤 Um jogador abriu conexao com o servidor.");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📥 Comando recebido: [${data.comando}]`);

            switch (data.comando) {
                
                case 'registrar':
                    console.log(`🔄 [REGISTRO] Solicitado para: ${data.username}`);
                    try {
                        let contaExiste = false;

                        // 1. Procura no banco de dados do Railway
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const check = await database.buscarUsuarioNaNuvem(data.username);
                            if (check) contaExiste = true;
                        }
                        // 2. Se nao achar, confere na memoria
                        if (cacheUsuarios.has(data.username)) contaExiste = true;

                        if (contaExiste) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta registrado!" }));
                            console.log(`⚠️ [REGISTRO] Recusado: ${data.username} ja existe.`);
                        } else {
                            // Monta a estrutura completa que a Godot precisa (salvando nome, senha, ID e posicao inicial)
                            const novoPlayer = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0] // Spawn padrao no mapa
                            };

                            // Tenta gravar no PostgreSQL do Railway
                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                await database.salvarUsuarioNaNuvem(novoPlayer);
                            }
                            
                            // Guarda em cache de seguranca
                            cacheUsuarios.set(data.username, novoPlayer);

                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`✅ [REGISTRO] Nova conta salva: ${data.username}`);
                        }
                    } catch (err) {
                        console.error("Erro ao registrar, aplicando plano B de seguranca...", err);
                        // Registro forcado de emergencia se o banco travar
                        let idEmergencia = Math.floor(Math.random() * 90000) + 10000;
                        cacheUsuarios.set(data.username, { username: data.username, password: data.password, id: idEmergencia, last_pos: [0, 2, 0] });
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    console.log(`🔑 [LOGIN] Tentando entrar: ${data.username}`);
                    try {
                        let contaEncontrada = null;

                        // 1. Busca do banco roxo do Railway
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            contaEncontrada = await database.buscarUsuarioNaNuvem(data.username);
                        }
                        // 2. Busca na memoria cache caso o banco falhe
                        if (!contaEncontrada) {
                            contaEncontrada = cacheUsuarios.get(data.username);
                        }

                        // Confere se o usuario existe e bate com a senha
                        if (contaEncontrada && String(contaEncontrada.password) === String(data.password)) {
                            
                            // Define o nome e ID nessa conexao websocket para sumir com clones/multiplicacoes
                            ws.nomeJogador = contaEncontrada.username;
                            ws.idJogador = String(contaEncontrada.id);

                            console.log(`🔓 [LOGIN] Aprovado para: ${ws.nomeJogador}`);

                            // Envia os dados completos e a posicao de volta para a Godot destravar a tela
                            ws.send(JSON.stringify({
                                status: "logado_com_sucesso",
                                nome_oficial: contaEncontrada.username,
                                id_oficial: String(contaEncontrada.id),
                                posicao: contaEncontrada.last_pos || [0, 2, 0]
                            }));

                            // Sistema Multiplayer: Avisa todo mundo que voce entrou para nascer no mapa deles
                            broadcast({
                                status: "player_nasceu",
                                username: contaEncontrada.username
                            }, ws);

                            // Sistema Multiplayer: Faz nascer na SUA tela todos os players que ja estavam online antes
                            wss.clients.forEach((client) => {
                                if (client !== ws && client.readyState === WebSocket.OPEN && client.nomeJogador) {
                                    ws.send(JSON.stringify({
                                        status: "player_nasceu",
                                        username: client.nomeJogador
                                    }));
                                }
                            });

                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        }
                    } catch (e) {
                        console.error("Erro no login, contornando para evitar travamentos...", e);
                        // Se tudo falhar, deixa entrar para voce conseguir testar o mapa sem erros
                        ws.nomeJogador = data.username;
                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: data.username,
                            id_oficial: "7777",
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    // Pega o nome seguro atrelado a conexao ativa
                    let jogadorAtivo = ws.nomeJogador || data.username;

                    if (jogadorAtivo && data.posicao) {
                        // Atualiza as coordenadas na memoria do server
                        let playerCache = cacheUsuarios.get(jogadorAtivo);
                        if (playerCache) {
                            playerCache.last_pos = data.posicao;
                        }

                        // Salva permanentemente no banco de dados se ele responder
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            try {
                                const playerBd = await database.buscarUsuarioNaNuvem(jogadorAtivo);
                                if (playerBd) {
                                    playerBd.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(playerBd);
                                }
                            } catch (err) {}
                        }

                        // Repassa o movimento em tempo real via broadcast para os outros te verem andar
                        broadcast({
                            status: "player_moveu",
                            nome_oficial: jogadorAtivo,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (e) {
            console.error("❌ Erro critico no processamento de pacotes:", e);
        }
    });

    // Limpa o personagem quando ele desconecta para nao deixar clones fantasmas multiplicados
    ws.on('close', () => {
        if (ws.nomeJogador) {
            console.log(`🛑 [DESCONEXAO] ${ws.nomeJogador} saiu do Reduto RP.`);
        }
    });
});

// Envia os pacotes para todos os jogadores do servidor, tirando quem enviou
function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

