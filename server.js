const WebSocket = require('ws');
const { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem } = require('./database');

// Usa a porta que o Railway fornece ou a 8080 localmente
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Servidor multiplayer ativo na porta ${PORT}`);

// Guarda as conexões ativas dos jogadores que estão online
const clientesConectados = new Map();

wss.on('connection', (ws) => {
    console.log("🔄 Nova conexão temporária estabelecida.");
    let usuarioDestaConexao = null;
    let idDestaConexao = null;

    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            switch (dados.comando) {
                
                case 'registrar':
                    console.log(`📝 Tentativa de registro para: ${dados.username}`);
                    const usuarioExiste = await buscarUsuarioNaNuvem(dados.username);
                    
                    if (usuarioExiste) {
                        ws.send(JSON.stringify({ "status": "erro", "msg": "Esta conta já existe!" }));
                    } else {
                        // Cria um ID numérico único baseado no TimeStamp para o set_multiplayer_authority da Godot
                        const novoId = Math.floor(Math.random() * 1000000) + 1; 
                        const novoUsuario = {
                            username: dados.username,
                            password: dados.password,
                            id: novoId,
                            last_pos: [0, 2, 0] // Posição inicial padrão no mapa
                        };
                        
                        await salvarUsuarioNaNuvem(novoUsuario);
                        console.log(`✅ Conta ${dados.username} salva com sucesso no banco!`);
                        ws.send(JSON.stringify({ "status": "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    console.log(`🔑 Tentativa de login para: ${dados.username}`);
                    const conta = await buscarUsuarioNaNuvem(dados.username);

                    if (conta && conta.password === dados.password) {
                        usuarioDestaConexao = conta.username;
                        idDestaConexao = conta.id;

                        // Salva a conexão do jogador na lista de players online
                        clientesConectados.set(idDestaConexao, { ws, username: usuarioDestaConexao });

                        console.log(`✅ ${usuarioDestaConexao} logou com sucesso. ID: ${idDestaConexao}`);
                        
                        // Envia de volta para a Godot os dados cruciais para o teleporte
                        ws.send(JSON.stringify({
                            "status": "logado_com_sucesso",
                            "id_oficial": String(idDestaConexao),
                            "nome_oficial": usuarioDestaConexao,
                            "posicao": conta.last_pos
                        }));

                        // Avisa todos os OUTROS players que este jogador acabou de entrar (Multiplicação)
                        enviarParaTodosMenos(idDestaConexao, {
                            "status": "player_nasceu",
                            "username": usuarioDestaConexao,
                            "id_jogador": String(idDestaConexao),
                            "posicao": conta.last_pos
                        });
                    } else {
                        ws.send(JSON.stringify({ "status": "erro", "msg": "Usuário ou senha incorretos!" }));
                    }
                    break;

                case 'salvar_posicao':
                    if (idDestaConexao && dados.posicao) {
                        // Atualiza a posição na nuvem enquanto o player se move
                        const contaAtiva = await buscarUsuarioNaNuvem(usuarioDestaConexao);
                        if (contaAtiva) {
                            contaAtiva.last_pos = dados.posicao;
                            await salvarUsuarioNaNuvem(contaAtiva);
                        }

                        // Propaga o movimento para os outros jogadores na rede
                        enviarParaTodosMenos(idDestaConexao, {
                            "status": "player_moveu",
                            "id_oficial": String(idDestaConexao),
                            "posicao": dados.posicao
                        });
                    }
                    break;
            }
        } catch (erro) {
            console.error("❌ Erro ao processar mensagem do cliente:", erro);
        }
    });

    ws.on('close', () => {
        if (idDestaConexao) {
            console.log(`🛑 Player desconectado: ${usuarioDestaConexao}`);
            clientesConectados.erase(idDestaConexao);
            
            // Avisa a todo mundo para sumir com o boneco dele da tela
            enviarParaTodosMenos(idDestaConexao, {
                "status": "player_desconectou",
                "id_oficial": String(idDestaConexao)
            });
        }
    });
});

// Função auxiliar para replicar os dados via rede
function enviarParaTodosMenos(idExcluido, dados) {
    const pacote = JSON.stringify(dados);
    clientesConectados.forEach((cliente, id) => {
        if (id !== idExcluido && cliente.ws.readyState === WebSocket.OPEN) {
            cliente.ws.send(pacote);
        }
    });
}
