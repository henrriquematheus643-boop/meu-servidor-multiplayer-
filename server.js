const WebSocket = require('ws');
const database = require('./database');

const PORT = process.env.PORT || 8080;

// 🧠 A MEMÓRIA DO RENDER (Funciona como o banco de dados principal do jogo)
const bancoLocalRender = new Map();

async function iniciarServidor() {
    try {
        console.log("🔄 [Render] Inicializando o Servidor Principal...");
        
        // Conecta ao Supabase apenas para puxar o backup das contas salvas
        try {
            await database.conectarBanco();
            console.log("📥 [Backup] Carregando contas antigas do Supabase para a memória do Render...");
            
            // Uma função simples para puxar todos os jogadores cadastrados de uma vez só no início
            // Se falhar ou estiver sem banco ainda, o servidor inicia mesmo assim!
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
                console.log(`📊 [Backup] ${bancoLocalRender.size} contas carregadas com sucesso na memória!`);
            }
        } catch (erroBanco) {
            console.log("⚠️ [Aviso] Não foi possível carregar o backup do Supabase. Usando armazenamento limpo do Render.");
        }
        
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Servidor Online na memória do Render na porta ${PORT}`);

        server.on('connection', (socket) => {
            socket.on('message', async (data) => {
                try {
                    const textoLimpado = data.toString('utf8');
                    const msg = JSON.parse(textoLimpado);
                    const { comando, username, password, posicao } = msg;

                    // 📝 SISTEMA DE REGISTRO - RODA INSTANTÂNEO NO RENDER
                    if (comando === 'registrar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Campos em branco!' }));
                            return;
                        }

                        // Verifica se o usuário já existe na memória local do Render
                        if (bancoLocalRender.has(username)) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Esta conta ja existe no Reduto!' }));
                            return;
                        }

                        // Cria a conta direto na memória do Render imediatamente
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
                        console.log(`📝 [Render-Memória] Nova conta criada direto no servidor: ${username}`);
                        
                        // Responde na hora para a Godot (Sem lag)
                        socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));

                        // 🔄 CÓPIA EM SEGUNDO PLANO: Envia uma cópia em silêncio para salvar no Supabase
                        database.registrarJogador(username, password).catch(err => {
                            console.error(`⚠️ [Cópia-Erro] Falha ao enviar cópia de cadastro de ${username} para o Supabase.`);
                        });
                    }

                    // 🔑 SISTEMA DE LOGIN - CONSULTA A MEMÓRIA DO RENDER DIRECT
                    else if (comando === 'logar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Preencha os campos!' }));
                            return;
                        }

                        // Procura o jogador na memória veloz do Render
                        const conta = bancoLocalRender.get(username);

                        if (conta && conta.password === password) {
                            console.log(`🔓 [Acesso-Local] ${username} entrou usando a memória do Render!`);
                            
                            socket.send(JSON.stringify({
                                status: 'logado_com_sucesso',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            }));
                        } else {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Usuario ou senha incorretos!' }));
                        }
                    }

                    // 📍 SISTEMA MULTIPLAYER DE POSIÇÃO - SALVA NO RENDER E DEPOIS FAZ CÓPIA
                    else if (comando === 'salvar_posicao') {
                        if (username && posicao && posicao.length === 3) {
                            const conta = bancoLocalRender.get(username);
                            if (conta) {
                                // Atualiza na memória do Render de forma instantânea
                                conta.pos_x = posicao[0];
                                conta.pos_y = posicao[1];
                                conta.pos_z = posicao[2];

                                // 🔄 CÓPIA EM SEGUNDO PLANO: Envia a atualização para o Supabase sem travar o jogo
                                database.salvarPosicaoJogador(username, posicao).catch(err => {
                                    // Ignora erros de rede do banco para o jogo não cair
                                });
                            }
                        }
                    }

                } catch (e) {
                    // Proteção de pacotes
                }
            });
        });

    } catch (err) {
        console.error("❌ Erro fatal ao iniciar o servidor principal:", err.message);
    }
}

iniciarServidor();
