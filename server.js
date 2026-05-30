const WebSocket = require('ws');
const database = require('./database'); // Conexão com o seu banco Supabase/PostgreSQL

const PORT = process.env.PORT || 8080;

// 🧠 Banco de dados temporário na memória do Render para carregar rápido
const bancoLocalRender = new Map();

// 🌐 Lista de sockets dos jogadores que estão ONLINE jogando agora
const playersOnline = new Map();

async function iniciarServidor() {
    try {
        console.log("🔄 [Render] Inicializando o Servidor Principal...");
        
        // Sincroniza o banco de dados
        try {
            await database.conectarBanco();
            console.log("📥 [Backup] Carregando contas para a memória veloz...");
            const comandoSQL = 'SELECT username, password, id_oficial, pos_x, pos_y, pos_z FROM jogadores';
            if (database.db && typeof database.db.query === 'function') {
                const resultado = await database.db.query(comandoSQL);
                resultado.rows.forEach(conta => {
                    bancoLocalRender.set(conta.username, {
                        username: conta.username,
                        password: conta.password,
                        id_oficial: conta.id_oficial,
                        pos_x: conta.pos_x || 0.0,
                        pos_y: conta.pos_y || 0.0,
                        pos_z: conta.pos_z || 0.0
                    });
                });
            }
        } catch (e) {
            console.log("⚠️ [Aviso] Rodando sem banco externo. Usando memória local.");
        }
        
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Servidor rodando com Multiplayer na porta ${PORT}`);

        server.on('connection', (socket) => {
            let meuUsuario = null;

            socket.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data.toString('utf8'));
                    const { comando, username, password, posicao } = msg;

                    // 📝 REGISTRO DE CONTA
                    if (comando === 'registrar') {
                        if (bancoLocalRender.has(username)) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Esta conta ja existe!' }));
                            return;
                        }
                        const novoId = 'ID_' + Math.floor(1000 + Math.random() * 9000);
                        const novosDados = { username, password, id_oficial: novoId, pos_x: 0.0, pos_y: 0.0, pos_z: 0.0 };
                        
                        bancoLocalRender.set(username, novosDados);
                        socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                        database.registrarJogador(username, password).catch(() => {});
                    }

                    // 🔑 LOGIN (ENTRADA NO MULTIPLAYER)
                    else if (comando === 'logar') {
                        const conta = bancoLocalRender.get(username);
                        if (conta && conta.password === password) {
                            meuUsuario = username;
                            
                            // 🔥 Salva o jogador na lista de ativos do multiplayer
                            playersOnline.set(username, socket);
                            
                            // Responde para o próprio jogador que ele entrou
                            socket.send(JSON.stringify({
                                status: 'logado_com_sucesso',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            }));

                            // 📡 MULTIPLAYER: Avisa TODOS os outros que você nasceu no mapa
                            transmitirParaOutros(username, {
                                status: 'player_nasceu',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            });
                        } else {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Dados incorretos!' }));
                        }
                    }

                    // 🏃‍♂️ ATUALIZAÇÃO DE POSIÇÃO EM TEMPO REAL (MULTIPLAYER)
                    else if (comando === 'salvar_posicao') {
                        if (username && posicao && posicao.length === 3) {
                            const conta = bancoLocalRender.get(username);
                            if (conta) {
                                conta.pos_x = posicao[0];
                                conta.pos_y = posicao[1];
                                conta.pos_z = posicao[2];

                                // 📡 MULTIPLAYER: Repassa a sua nova posição para os outros verem você andando
                                transmitirParaOutros(username, {
                                    status: 'player_moveu',
                                    nome_oficial: username,
                                    id_oficial: conta.id_oficial,
                                    posicao: posicao
                                });

                                // Salva no banco em segundo plano
                                database.salvarPosicaoJogador(username, posicao).catch(() => {});
                            }
                        }
                    }

                } catch (err) {}
            });

            // ❌ SE DESCONECTAR OU FECHAR O APLICATIVO
            socket.on('close', () => {
                if (meuUsuario) {
                    console.log(`❌ [Multiplayer] ${meuUsuario} saiu.`);
                    playersOnline.delete(meuUsuario);
                    
                    // 📡 MULTIPLAYER: Avisa todo mundo para remover o seu boneco da tela deles
                    transmitirParaOutros(meuUsuario, {
                        status: 'player_saiu',
                        nome_oficial: meuUsuario
                    });
                }
            });
        });

    } catch (err) {
        console.error("❌ Erro fatal:", err.message);
    }
}

// 📡 Função mestre do multiplayer: envia os dados para todo mundo, menos para o dono deles
function transmitirParaOutros(remetente, dados) {
    const stringDados = JSON.stringify(dados);
    playersOnline.forEach((socketCliente, nomeCliente) => {
        if (nomeCliente !== remetente && socketCliente.readyState === WebSocket.OPEN) {
            socketCliente.send(stringDados);
        }
    });
}

iniciarServidor();
