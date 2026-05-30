const WebSocket = require('ws');
const database = require('./database.js'); // Conexão com o seu banco PostgreSQL

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Reduto RP Online na porta ${PORTA}...`);

wss.on('connection', (ws) => {
    let meuNomeNoServidor = null;
    
    console.log("👤 Novo cidadão conectou ao servidor!");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido:", data.comando);

            switch (data.comando) {
                case 'registrar':
                    console.log(`🔄 [REGISTRO] Verificando nome: ${data.username}`);
                    try {
                        const usuarioExiste = await database.buscarUsuarioNaNuvem(data.username);
                        
                        if (usuarioExiste) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso!" }));
                        } else {
                            // Cria a conta com ID aleatório e posição inicial padrão
                            const novoJogador = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0] // Posição padrão de nascimento
                            };
                            
                            await database.salvarUsuarioNaNuvem(novoJogador);
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`✅ [BANCO] Conta criada: ${data.username}`);
                        }
                    } catch (err) {
                        console.error("❌ Erro ao registrar no banco:", err);
                        ws.send(JSON.stringify({ status: "erro", msg: "Erro interno no banco do Railway" }));
                    }
                    break;

                case 'logar':
                    console.log("🔑 [LOGIN] Tentativa para: " + data.username);
                    try {
                        const resultadoBanco = await database.buscarUsuarioNaNuvem(data.username);
                        
                        if (resultadoBanco && String(resultadoBanco.password) === String(data.password)) {
                            meuNomeNoServidor = resultadoBanco.username;
                            
                            // 🔥 CRÍTICO: Envia os dados do banco para a Godot saber que foi aprovado
                            ws.send(JSON.stringify({ 
                                status: "logado_com_sucesso", 
                                nome_oficial: resultadoBanco.username,
                                id_oficial: String(resultadoBanco.id),
                                posicao: resultadoBanco.last_pos || [0, 2, 0]
                            }));
                            console.log(`🔓 [SUCESSO] ${data.username} fez login.`);
                            
                            // Avisa os outros jogadores no mapa que você nasceu
                            broadcast({
                                status: "player_nasceu",
                                username: data.username
                            }, ws);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        }
                    } catch (err) {
                        console.error("❌ Erro ao buscar login:", err);
                        ws.send(JSON.stringify({ status: "erro", msg: "Erro ao conectar com o banco" }));
                    }
                    break;

                case 'salvar_posicao':
                    // Salva a posição atual [x, y, z] do jogador no PostgreSQL
                    var nome_alvo = data.username || meuNomeNoServidor;
                    if (nome_alvo && data.posicao) {
                        try {
                            const jogador = await database.buscarUsuarioNaNuvem(nome_alvo);
                            if (jogador) {
                                jogador.last_pos = data.posicao;
                                await database.salvarUsuarioNaNuvem(jogador);
                                console.log(`💾 [POSIÇÃO] Salva para ${nome_alvo}:`, data.posicao);
                            }
                        } catch (e) {
                            console.error("❌ Erro ao salvar posicao:", e);
                        }
                    }

                    // Sincroniza o movimento com os outros jogadores (Multiplayer)
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: nome_alvo,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro no processamento de mensagem:", e);
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
