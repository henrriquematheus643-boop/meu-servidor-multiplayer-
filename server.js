const WebSocket = require('ws');
const database = require('./database.js'); // Importa o seu arquivo do banco de dados

// O Railway define a porta automaticamente, mas deixamos a 8080 de reserva
const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 Servidor Node.js rodando e pronto para o Railway na porta ${PORTA}...`);

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;
    
    console.log("👤 Novo cliente conectado!");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido do cliente:", data.comando);

            switch (data.comando) {
                case 'log':
                    // CONFIRMAÇÃO DO APERTO DE MÃO
                    console.log("✅ [CONFIRMAÇÃO]: " + data.mensagem);
                    ws.send(JSON.stringify({ status: "log_recebido", info: "Conexão confirmada" }));
                    break;

                case 'registrar':
                    console.log(`🔄 [REGISTRO] Verificando nome no banco do Railway: ${data.username}`);
                    try {
                        const usuarioExiste = await database.buscarUsuarioNaNuvem(data.username);
                        
                        if (usuarioExiste) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso na cidade!" }));
                            console.log(`⚠️ [REGISTRO] Nome recusado (ja existe): ${data.username}`);
                        } else {
                            // Cria os dados do novo jogador com ID aleatório e posição inicial [0, 2, 0]
                            const novoJogador = {
                                username: data.username,
                                password: data.password,
                                id: Math.floor(Math.random() * 90000) + 10000,
                                last_pos: [0, 2, 0]
                            };
                            
                            const salvoComSucesso = await database.salvarUsuarioNaNuvem(novoJogador);
                            
                            if (salvoComSucesso) {
                                ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                                console.log(`✅ [BANCO] Conta criada com sucesso para: ${data.username}`);
                            } else {
                                ws.send(JSON.stringify({ status: "erro", msg: "Erro do banco ao salvar dados!" }));
                            }
                        }
                    } catch (err) {
                        console.error("❌ Erro ao registrar no banco:", err);
                        ws.send(JSON.stringify({ status: "erro", msg: "Erro interno no banco do Railway" }));
                    }
                    break;

                case 'logar':
                    console.log("🔑 Tentativa de login para: " + data.username);
                    try {
                        const resultadoBanco = await database.buscarUsuarioNaNuvem(data.username);
                        
                        // Verifica se o usuário existe e se a senha está certa
                        if (resultadoBanco && String(resultadoBanco.password) === String(data.password)) {
                            meuIdNoServidor = String(resultadoBanco.id);
                            meuNomeNoServidor = resultadoBanco.username;
                            
                            // 🔥 CRÍTICO: Envia TODOS os dados que a Godot precisa para teleportar!
                            ws.send(JSON.stringify({ 
                                status: "logado_com_sucesso", 
                                id_oficial: meuIdNoServidor,
                                nome_oficial: meuNomeNoServidor,
                                posicao: resultadoBanco.last_pos || [0, 2, 0]
                            }));
                            console.log(`🔓 [BANCO] Login aprovado para: ${data.username}`);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                            console.log(`❌ [BANCO] Negado ou nao encontrado: ${data.username}`);
                        }
                    } catch (err) {
                        console.error("❌ Erro ao buscar login no banco:", err);
                        ws.send(JSON.stringify({ status: "erro", msg: "Erro interno no servidor do Railway" }));
                    }
                    break;

                case 'salvar_posicao':
                    // 💾 SALVA NO BANCO POSTGRESQL DO RAILWAY
                    var nome_alvo = data.username || meuNomeNoServidor;
                    if (nome_alvo && data.posicao) {
                        try {
                            const jogador = await database.buscarUsuarioNaNuvem(nome_alvo);
                            if (jogador) {
                                jogador.last_pos = data.posicao; // Atualiza a array [x, y, z]
                                await database.salvarUsuarioNaNuvem(jogador);
                                console.log(`💾 [BANCO] Posicao de ${nome_alvo} salva:`, data.posicao);
                            }
                        } catch (e) {
                            console.error("❌ Erro ao salvar posicao de " + nome_alvo, e);
                        }
                    }

                    // 🌐 MULTIPLAYER (BROADCAST): Avisa todos os outros players que você se mexeu
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: nome_alvo,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro ao processar mensagem:", e);
        }
    });
});

// Função para enviar para todos, menos para quem enviou (Sistema Multiplayer original)
function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
