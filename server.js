const WebSocket = require('ws');
const database = require('./database'); 

const PORT = process.env.PORT || 8080;

const bancoLocalRender = new Map();
const playersOnline = new Map();

async function iniciarServidor() {
    try {
        console.log("🔄 [Render] Inicializando Servidor...");
        await database.conectarBanco();
        
        // Carrega dados iniciais
        const resultado = await database.db.query('SELECT username, password, id_oficial, pos_x, pos_y, pos_z FROM jogadores');
        resultado.rows.forEach(conta => {
            bancoLocalRender.set(conta.username, conta);
        });
        
        const server = new WebSocket.Server({ port: PORT });
        console.log(`🚀 [Reduto RP] Online na porta ${PORT}`);

        server.on('connection', (socket) => {
            let meuUsuario = null;

            socket.on('message', async (data) => {
                const msg = JSON.parse(data.toString());
                const { comando, username, password, posicao } = msg;

                // --- SISTEMA DE LOGIN ---
                if (comando === 'logar') {
                    const conta = bancoLocalRender.get(username);
                    if (conta && conta.password === password) {
                        meuUsuario = username;
                        playersOnline.set(username, socket);
                        
                        socket.send(JSON.stringify({
                            status: 'logado_com_sucesso',
                            nome_oficial: username,
                            posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                        }));

                        // Avisa os outros que você chegou
                        transmitirParaOutros(username, {
                            status: 'player_nasceu',
                            nome_oficial: username,
                            posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                        });
                    }
                }

                // --- SISTEMA DE MOVIMENTAÇÃO (Sincronização) ---
                else if (comando === 'salvar_posicao') {
                    if (meuUsuario) {
                        const conta = bancoLocalRender.get(meuUsuario);
                        conta.pos_x = posicao[0];
                        conta.pos_y = posicao[1];
                        conta.pos_z = posicao[2];

                        transmitirParaOutros(meuUsuario, {
                            status: 'player_moveu',
                            nome_oficial: meuUsuario,
                            posicao: posicao
                        });
                        database.salvarPosicaoJogador(meuUsuario, posicao).catch(() => {});
                    }
                }
            });

            socket.on('close', () => {
                if (meuUsuario) {
                    playersOnline.delete(meuUsuario);
                    transmitirParaOutros(meuUsuario, { status: 'player_saiu', nome_oficial: meuUsuario });
                }
            });
        });
    } catch (err) { console.error("Erro:", err); }
}

function transmitirParaOutros(remetente, dados) {
    const msg = JSON.stringify(dados);
    playersOnline.forEach((s, nome) => {
        if (nome !== remetente && s.readyState === WebSocket.OPEN) s.send(msg);
    });
}

iniciarServidor();

