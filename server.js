const WebSocket = require('ws');

// Conexão com o banco de dados PostgreSQL do Railway
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Banco de dados (database.js) detectado.");
} catch (e) {
    console.log("⚠️ [SISTEMA] database.js não encontrado. Rodando em modo cache temporário.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Reduto RP ativo na porta ${PORTA}`);

// Guarda os dados dos jogadores online na memória para o multiplayer geral
let jogadoresOnline = new Map();

wss.on('connection', (ws) => {
    // 🔥 CONFIGURAÇÃO MULTIPLICATIVA: Cada nova conexão ganha um ID único automático para testes diretos
    ws.idJogador = Math.floor(Math.random() * 90000) + 10000;
    ws.nomeJogador = `Player_Anonimo_${ws.idJogador}`;
    ws.posicaoAtual = [0, 2, 0];

    console.log(`👤 [CONEXÃO] ${ws.nomeJogador} (ID: ${ws.idJogador}) entrou na rede.`);

    // Guarda o jogador na lista ativa do multiplayer
    jogadoresOnline.set(String(ws.idJogador), {
        username: ws.nomeJogador,
        id: String(ws.idJogador),
        last_pos: ws.posicaoAtual
    });

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`📥 Comando recebido: [${data.comando}]`);

            switch (data.comando) {
                
                case 'registrar':
                    try {
                        let existe = false;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const check = await database.buscarUsuarioNaNuvem(data.username);
                            if (check) existe = true;
                        }
                        if (existe) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esta conta ja existe!" }));
                        } else {
                            const novoUsuario = {
                                username: data.username,
                                password: data.password,
                                id: String(Math.floor(Math.random() * 90000) + 10000),
                                last_pos: [0, 2, 0]
                            };
                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                await database.salvarUsuarioNaNuvem(novoUsuario);
                            }
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`📝 Conta criada no Railway: ${data.username}`);
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    try {
                        let conta = null;
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            conta = await database.buscarUsuarioNaNuvem(data.username);
                        }

                        if (conta && String(conta.password) === String(data.password)) {
                            // Atualiza os dados da conexão com os dados reais do banco do site
                            jogadoresOnline.delete(String(ws.idJogador)); // Remove o anônimo antigo
                            
                            ws.idJogador = int(conta.id) || Math.floor(Math.random() * 90000) + 10000;
                            ws.nomeJogador = conta.username;
                            ws.posicaoAtual = conta.last_pos || [0, 2, 0];

                            if (typeof ws.posicaoAtual === 'string') ws.posicaoAtual = JSON.parse(ws.posicaoAtual);

                            jogadoresOnline.set(String(ws.idJogador), {
                                username: ws.nomeJogador,
                                id: String(ws.idJogador),
                                last_pos: ws.posicaoAtual
                            });

                            console.log(`🔓 [LOGIN BANCO] ${ws.nomeJogador} autenticado.`);

                            // Envia os dados de volta para destravar a Godot e exibir o Bem-Vindo Roxo
                            ws.send(JSON.stringify({
                                status: "logado_com_sucesso",
                                nome_oficial: ws.nomeJogador,
                                id_oficial: String(ws.idJogador),
                                posicao: ws.posicaoAtual
                            }));

                            // 💥 FORÇA MULTIPLICAÇÃO: Avisa a rede para fazer nascer esse player no mapa dos outros
                            broadcast({
                                status: "player_nasceu",
                                username: ws.nomeJogador,
                                id_jogador: String(ws.idJogador),
                                posicao: ws.posicaoAtual
                            }, ws);

                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Dados incorretos!" }));
                        }
                    } catch (e) {
                        console.log("Erro no login, usando dados locais de teste...");
                        ws.send(JSON.stringify({
                            status: "logado_com_sucesso",
                            nome_oficial: data.username,
                            id_oficial: String(ws.idJogador),
                            posicao: [0, 2, 0]
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    let idAlvo = String(ws.idJogador);
                    if (idAlvo && data.posicao) {
                        ws.posicaoAtual = data.posicao;
                        
                        let playerRef = jogadoresOnline.get(idAlvo);
                        if (playerRef) playerRef.last_pos = data.posicao;

                        // Grava os dados direto no armazenamento do site Railway se o banco estiver online
                        if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                            try {
                                await database.salvarUsuarioNaNuvem({
                                    username: ws.nomeJogador,
                                    id: String(ws.idJogador),
                                    last_pos: data.posicao
                                });
                            } catch (err) {}
                        }

                        // Sincroniza o movimento multiplicativo (repassa para os outros players da tela)
                        broadcast({
                            status: "player_moveu",
                            id_oficial: String(ws.idJogador),
                            nome_oficial: ws.nomeJogador,
                            posicao: data.posicao
                        }, ws);
                    }
                    break;
            }
        } catch (e) {
            console.error("Erro ao tratar pacote de rede:", e);
        }
    });

    // Envia os players que JÁ ESTAVAM online direto para a tela de quem acabou de conectar (Multiplayer)
    jogadoresOnline.forEach((player) => {
        if (String(player.id) !== String(ws.idJogador)) {
            ws.send(JSON.stringify({
                status: "player_nasceu",
                username: player.username,
                id_jogador: String(player.id),
                posicao: player.last_pos
            }));
        }
    });

    // Limpa a memória se o jogador fechar a janela (evita duplicados travados)
    ws.on('close', () => {
        console.log(`🛑 [SAÍDA] ${ws.nomeJogador} desconectou.`);
        jogadoresOnline.delete(String(ws.idJogador));
        broadcast({
            status: "player_desconectou",
            username: ws.nomeJogador,
            id_oficial: String(ws.idJogador)
        }, ws);
    });
});

function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

