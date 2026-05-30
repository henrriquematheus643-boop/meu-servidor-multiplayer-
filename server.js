const WebSocket = require('ws');

let database = null;
try {
    database = require('./database.js');
    console.log("✅ [DATABASE] Módulo integrado com sucesso.");
} catch (e) {
    console.log("⚠️ [DATABASE] Rodando em modo de cache local (sem database.js).");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

let contasCache = new Map();

wss.on('connection', (ws) => {
    let meuNome = null;
    console.log("👤 Nova conexão aberta.");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.comando) {
                case 'registrar':
                    try {
                        let existe = false;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const r = await database.buscarUsuarioNaNuvem(data.username);
                            if (r) existe = true;
                        } else if (contasCache.has(data.username)) {
                            existe = true;
                        }

                        if (existe) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Nome indisponivel!" }));
                        } else {
                            const novo = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0]
                            };

                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                await database.salvarUsuarioNaNuvem(novo);
                            }
                            contasCache.set(data.username, novo);
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                        }
                    } catch (e) {
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    try {
                        let conta = null;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            conta = await database.buscarUsuarioNaNuvem(data.username);
                        }
                        if (!conta) conta = contasCache.get(data.username);

                        if (conta && String(conta.password) === String(data.password)) {
                            meuNome = conta.username;
                            ws.send(JSON.stringify({
                                status: "logado_com_sucesso",
                                nome_oficial: conta.username,
                                id_oficial: String(conta.id),
                                posicao: conta.last_pos || [0, 2, 0]
                            }));

                            broadcast({ status: "player_nasceu", username: conta.username }, ws);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Dados incorretos!" }));
                        }
                    } catch (e) {
                        // Resposta de segurança para testes locais livres
                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: data.username,
                            id_oficial: "10001",
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    let alvo = data.username || meuNome;
                    if (alvo && data.posicao) {
                        let c = contasCache.get(alvo);
                        if (c) c.last_pos = data.posicao;

                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            try {
                                const jogador = await database.buscarUsuarioNaNuvem(alvo);
                                if (jogador) {
                                    jogador.last_pos = data.posicao;
                                    await database.salvarUsuarioNaNuvem(jogador);
                                }
                            } catch (err) {}
                        }

                        broadcast({
                            status: "player_moveu",
                            nome_oficial: alvo,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (err) {}
    });
});

function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
