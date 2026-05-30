const WebSocket = require('ws');
const database = require('./database');

const PORT = process.env.PORT || 8080;

// 🧠 A MEMÓRIA DO RENDER (Cofre veloz de contas)
const bancoLocalRender = new Map();

// 🌐 LISTA DE JOGADORES ONLINE AGORA (Para o sistema multiplayer se multiplicar)
const clientesConectados = new Map();

async function iniciarServidor() {
    try {
        console.log("🔄 [Render] Inicializando o Servidor Principal...");
        
        // Carrega o backup do Supabase para a memória veloz do Render
        try {
            await database.conectarBanco();
            console.log("📥 [Backup] Carregando contas antigas do Supabase para a memória do Render...");
            
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
                console.log(`📊 [Backup] ${bancoLocalRender.size} contas carregadas na memória!`);
            }
        } catch (erroBanco) {
            console.log("⚠️ [Aviso] Sem backup do Supabase. Usando armazenamento limpo do Render.");
        }
        
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Servidor Online com Multiplayer ativo na porta ${PORT}`);

        server.on('connection', (socket) => {
            // Guarda o nome do usuário assim que ele logar para sabermos quem desconectou depois
            let usuarioDesteSocket = null;

            socket.on('message', async (data) => {
                try {
                    const textoLimpado = data.toString('utf8');
                    const msg = JSON.parse(textoLimpado);
                    const { comando, username, password, posicao } = msg;

                    // 📝 SISTEMA DE REGISTRO
                    if (comando === 'registrar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Campos em branco!' }));
                            return;
                        }
                        if (bancoLocalRender.has(username)) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Esta conta ja existe no Reduto!' }));
                            return;
                        }

                        const novoIdOficial = 'ID_' + Math.floor(1000 + Math.random() * 9000);
                        const novosDadosJogador = {
                            username: username,
                            password: password,
                            id_oficial: novoIdOficial,
                            pos_x: 0.0,
                            pos_y: 0.0,
                            pos_z: 0.0
                        };
                        
                        bancoLocalRender.set(username, novosDadosJogador);
                        socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));

                        database.registrarJogador(username, password).catch(err => {});
                    }

                    // 🔑 SISTEMA DE LOGIN (CONECTA O PLAYER NA REDE MULTIPLAYER)
                    else if (comando === 'logar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Preencha os campos!' }));
                            return;
                        }

                        const conta = bancoLocalRender.get(username);

                        if (conta && conta.password === password) {
                            usuarioDesteSocket = username;
                            
                            // 🔥 ENTRADA MULTIPLAYER: Salva o socket do jogador na lista de ativos
                            clientesConectados.set(username, socket);
                            
                            console.log(`🔓 [Acesso-Multiplayer] ${username} entrou na rede.`);
                            
                            // Envia os dados de sucesso para quem acabou de logar
                            socket.send(JSON.stringify({
                                status: 'logado_com_sucesso',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            }));

                            // 🔥 MULTIPLICAÇÃO: Avisa a TODOS os outros jogadores que esse cara nasceu
                            transmitirParaTodos(username, {
                                status: 'player_nasceu',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            });
                        } else {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Usuario ou senha incorretos!' }));
                        }
                    }

                    // 📍 SISTEMA MULTIPLAYER DE MOVIMENTAÇÃO (ATUALIZAÇÃO EM TEMPO REAL)
                    else if (comando === 'salvar_posicao') {
                        if (username && posicao && posicao.length === 3) {
                            const conta = bancoLocalRender.get(username);
                            if (conta) {
                                // 1. Atualiza na memória interna do Render
                                conta.pos_x = posicao[0];
                                conta.pos_y = posicao[1];
                                conta.pos_z = posicao[2];

                                // 2. 🔥 MULTIPLICAÇÃO: Envia a nova posição dele para os outros players verem ele andando!
                                transmitirParaTodos(username, {
                                    status: 'player_moveu',
                                    nome_oficial: username,
                                    id_oficial: conta.id_oficial,
                                    posicao: posicao
                                });

                                // 3. Envia a cópia de backup em silêncio para o Supabase
                                database.salvarPosicaoJogador(username, posicao).catch(err => {});
                            }
                        }
                    }

                } catch (e) {
                    // Proteção contra dados corrompidos
                }
            });

            // ❌ QUANDO O JUGADOR FECHA O JOGO: Remove ele e avisa os outros sumirem com o boneco
            socket.on('close', () => {
                if (usuarioDesteSocket) {
                    console.log(`❌ [Multiplayer] ${usuarioDesteSocket} saiu do jogo.`);
                    clientesConectados.delete(usuarioDesteSocket);
                    
                    // Avisa a todos para apagarem a cópia duplicada desse boneco no mapa
                    transmitirParaTodos(usuarioDesteSocket, {
                        status: 'player_saiu',
                        nome_oficial: usuarioDesteSocket
                    });
                }
            });
        });

    } catch (err) {
        console.error("❌ Erro fatal no servidor principal:", err.message);
    }
}

// 📡 Função auxiliar para enviar dados para todo mundo, menos para o próprio dono dos dados
function transmitirParaTodos(remetente, dados) {
    const pacoteTexto = JSON.stringify(dados);
    clientesConectados.forEach((socketCliente, nomeCliente) => {
        if (nomeCliente !== remetente && socketCliente.readyState === WebSocket.OPEN) {
            socketCliente.send(pacoteTexto);
        }
    });
}

iniciarServidor();
