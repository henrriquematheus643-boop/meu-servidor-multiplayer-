const WebSocket = require('ws');
const database = require('./database');

const PORT = process.env.PORT || 8080;

async function iniciarServidor() {
    try {
        console.log("🔄 [Reduto RP] Inicializando conexão com o banco PostgreSQL...");
        await database.conectarBanco();
        
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Servidor Multiplayer online na porta ${PORT}`);

        server.on('connection', (socket) => {
            console.log('🔌 [Conexão] Um jogador abriu o jogo e está na tela de login!');

            socket.on('message', async (data) => {
                try {
                    // Transforma o texto vindo da Godot em Objeto Javascript
                    const texto = data.toString();
                    const msg = JSON.parse(texto);
                    const { comando, username, password, posicao } = msg;

                    // 📝 COMANDO: REGISTRAR
                    if (comando === 'registrar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha em branco!' }));
                            return;
                        }
                        try {
                            await database.registrarJogador(username, password);
                            console.log(`📝 [Cadastro] Conta criada: ${username}`);
                            socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                        } catch (err) {
                            console.error("❌ Erro ao registrar:", err.message);
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Nome já existe ou erro no banco!' }));
                        }
                    }

                    // 🔑 COMANDO: LOGAR
                    else if (comando === 'logar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Preencha todos os campos!' }));
                            return;
                        }
                        try {
                            const conta = await database.buscarJogador(username);

                            if (conta && conta.password === password) {
                                console.log(`🔓 [Login] Cidadão liberado: ${username}`);
                                
                                // Envia exatamente o que o AuthSystem.gd precisa ler
                                socket.send(JSON.stringify({
                                    status: 'logado_com_sucesso',
                                    id_oficial: conta.id_oficial,
                                    nome_oficial: conta.username,
                                    posicao: [conta.pos_x || 0, conta.pos_y || 0, conta.pos_z || 0]
                                }));
                            } else {
                                socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha incorretos!' }));
                            }
                        } catch (err) {
                            console.error("❌ Erro ao buscar jogador:", err.message);
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Erro interno ao consultar banco!' }));
                        }
                    }

                    // 📍 COMANDO: SALVAR POSIÇÃO
                    else if (comando === 'salvar_posicao') {
                        if (username && posicao && posicao.length === 3) {
                            await database.salvarPosicaoJogador(username, posicao);
                        }
                    }

                } catch (erroParse) {
                    console.error('❌ [Erro de Pacote] Dados mal formatados vindos do cliente.');
                }
            });

            socket.on('close', () => {
                console.log('❌ [Conexão] Cidadão fechou a tela de login ou deslogou.');
            });
        });

    } catch (erroFatal) {
        console.error("❌ [Erro Fatal] O servidor não pôde iniciar:", erroFatal.message);
    }
}

iniciarServidor();
