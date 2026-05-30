const WebSocket = require('ws');

let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Módulo database.js carregado.");
} catch (e) {
    console.log("⚠️ [SISTEMA] database.js não encontrado. Rodando com cache local.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Ativo na porta ${PORTA}`);
let cacheUsuarios = new Map();

wss.on('connection', (ws) => {
    ws.nomeJogador = null;
    ws.idJogador = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.comando) {
                case 'registrar':
                    let contaExiste = false;
                    if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                        const check = await database.buscarUsuarioNaNuvem(data.username);
                        if (check) contaExiste = true;
                    }
                    if (cacheUsuarios.has(data.username)) contaExiste = true;

                    if (contaExiste) {
                        ws.send(JSON.stringify({ status: "erro", msg: "Esta conta ja existe!" }));
                    } else {
                        const novoPlayer = {
                            username: data.username,
                            password: data.password,
                            id: String(Math.floor(Math.random() * 90000) + 10000),
                            last_pos: [0, 2, 0]
                        };

                        // Salva direto no Banco de Dados do Railway
                        if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                            await database.salvarUsuarioNaNuvem(novoPlayer);
                        }
                        cacheUsuarios.set(data.username, novoPlayer);
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    let conta = null;
                    if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                        conta = await database.buscarUsuarioNaNuvem(data.username);
                    }
                    if (!conta) conta = cacheUsuarios.get(data.username);

                    if (conta && String(conta.password) === String(data.password)) {
                        ws.nomeJogador = conta.username;
                        ws.idJogador = String(conta.id);

                        // Garante que a posição venha do banco ou use o padrão
                        let posValida = conta.last_pos || [0, 2, 0];
                        if (typeof posValida === 'string') posValida = JSON.parse(posValida);

                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: conta.username,
                            id_oficial: String(conta.id),
                            posicao: posValida
                        }));

                        // MULTIPLAYER: Avisa os outros para spawnar você
                        broadcast({
                            status: "player_nasceu",
                            username: ws.nomeJogador,
                            id_jogador: ws.idJogador,
                            posicao: posValida
                        }, ws);

                        // MULTIPLAYER: Faz os outros nascerem na sua tela
                        wss.clients.forEach((client) => {
                            if (client !== ws && client.readyState === WebSocket.OPEN && client.nomeJogador) {
                                let cInfo = cacheUsuarios.get(client.nomeJogador);
                                ws.send(JSON.stringify({
                                    status: "player_nasceu",
                                    username: client.nomeJogador,
                                    id_jogador: client.idJogador,
                                    posicao: cInfo ? (cInfo.last_pos || [0, 2, 0]) : [0, 2, 0]
                                }));
                            }
                        });
                    } else {
                        ws.send(JSON.stringify({ status: "erro", msg: "Dados incorretos!" }));
                    }
                    break;

                case 'salvar_posicao':
                    let jogadorAtivo = ws.nomeJogador || data.username;
                    if (jogadorAtivo && data.posicao) {
                        
                        // Atualiza na memória temporária
                        let pCache = cacheUsuarios.get(jogadorAtivo);
                        if (pCache) pCache.last_pos = data.posicao;

                        // Salva e atualiza direto na nuvem do Railway
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function' && typeof database.salvarUsuarioNaNuvem === 'function') {
                            try {
                                let pBd = await database.buscarUsuarioNaNuvem(jogadorAtivo);
                                if (pBd) {
                                    pBd.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(pBd);
                                }
                            } catch (err) {
                                console.log("Erro ao gravar posição no PostgreSQL:", err);
                            }
                        }

                        // Transmite o movimento para os outros players verem em tempo real
                        broadcast({
                            status: "player_moveu",
                            nome_oficial: jogadorAtivo,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        if (ws.nomeJogador) {
            broadcast({ status: "player_desconectou", username: ws.nomeJogador }, ws);
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
