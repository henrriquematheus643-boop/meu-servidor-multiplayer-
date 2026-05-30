const WebSocket = require('ws');
// Importa o sistema do banco de dados (database.js)
const database = require('./database');

const PORT = process.env.PORT || 8080;

// Função principal que gerencia a inicialização segura do Reduto RP
async function iniciarServidor() {
    try {
        console.log("🔄 [Inicialização] Conectando ao armazenamento primeiro...");
        
        // 🔒 SEGURANÇA: Espera o banco conectar de verdade antes de avançar
        await database.conectarBanco();
        
        // Só cria o servidor WebSocket depois que o banco deu sinal verde
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Servidor Multiplayer ativo e rodando na porta ${PORT}`);

        server.on('connection', (socket) => {
            console.log('🔌 [Multiplayer] Um jogador acabou de entrar na cidade!');

            socket.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data);
                    const { comando, username, password, posicao } = msg;

                    // 📝 SISTEMA DE REGISTRO
                    if (comando === 'registrar') {
                        if (!username || !password) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Campos inválidos!' }));
                            return;
                        }
                        try {
                            await database.registrarJogador(username, password);
                            console.log(`📝 [Sucesso] Nova conta criada para: ${username}`);
                            socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                        } catch (err) {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Esta conta já existe no Reduto!' }));
                        }
                    }

                    // 🔑 SISTEMA DE LOGIN COM ID E SENHA
                    else if (comando === 'logar') {
                        const conta = await database.buscarJogador(username);

                        if (conta && conta.password === password) {
                            console.log(`🔓 [Acesso] Cidadão liberado: ${username}`);
                            
                            // Envia de volta para a Godot os dados para a HUD e a posição
                            socket.send(JSON.stringify({
                                status: 'logado_com_sucesso',
                                id_oficial: conta.id_oficial,
                                nome_oficial: conta.username,
                                posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                            }));
                        } else {
                            socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha incorretos!' }));
                        }
                    }

                    // 📍 SISTEMA MULTIPLAYER DE POSIÇÃO
                    else if (comando === 'salvar_posicao') {
                        if (username && posicao && posicao.length === 3) {
                            await database.salvarPosicaoJogador(username, posicao);
                        }
                    }

                } catch (erro) {
                    console.error('❌ [Erro Interno de Processamento]:', erro);
                }
            });

            socket.on('close', () => {
                console.log('❌ [Multiplayer] Um jogador saiu da cidade.');
            });
        });

    } catch (erroFatal) {
        console.error("❌ [Erro Fatal] Não foi possível iniciar o servidor do jogo:", erroFatal.message);
    }
}

// Executa a inicialização blindada
iniciarServidor();
