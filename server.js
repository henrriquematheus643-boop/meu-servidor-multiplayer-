const WebSocket = require('ws');
const { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem } = require('./database');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Servidor Reduto RP ativo na porta ${PORT}`);

// Lista de conexões ativas
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
                    console.log(`📝 Tentativa de registro: ${dados.username}`);
                    const usuarioExiste = await buscarUsuarioNaNuvem(dados.username);
                    
                    if (usuarioExiste) {
                        ws.send(JSON.stringify({ "status": "erro", "msg": "Esta conta ja existe!" }));
                    } else {
                        const novoId = Math.floor(Math.random() * 1000000) + 1; 
                        const novoUsuario = {
                            username: dados.username,
                            password: dados.password,
                            id: novoId,
                            last_pos: [0, 2, 0]
                        };
                        
                        await salvarUsuarioNaNuvem(novoUsuario);
                        console.log(`✅ Conta ${dados.username} salva no banco!`);
                        ws.send(JSON.stringify({ "status": "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    console.log(`🔑 Tentativa de login: ${dados.username}`);
                    const conta = await buscarUsuarioNaNuvem(dados.username);

                    if (conta && String(conta.password) === String(dados.password)) {
                        usuarioDestaConexao = conta.username;
                        idDestaConexao = String(conta.id);

                        // Salva na lista de players online
                        clientesConectados.set(idDestaConexao, { ws, username: usuarioDestaConexao });
                        console.log(`✅ ${usuarioDestaConexao} logou. ID: ${idDestaConexao}`);
                        
                        // Envia de volta para a Godot os dados cruciais para o teleporte
                        ws.send(JSON.stringify({
                            "status": "logado_com_sucesso",
                            "id_oficial": idDestaConexao,
                            "nome_oficial": usuarioDestaConexao,
                            "posicao": conta.last_pos || [0, 2, 0]
                        }));

                        // Avisa os outros players para multiplicarem o corpo desse jogador
                        enviarParaTodosMenos(idDestaConexao, {
                            "status": "player_nasceu",
                            "username": usuarioDestaConexao,
                            "id_jogador": idDestaConexao,
                            "posicao": conta.last_pos || [0, 2, 0]
                        });
                    } else {
                        ws.send(JSON.stringify({ "status": "erro", "msg": "Usuario ou senha incorretos!" }));
                    }
                    break;

                case 'salvar_posicao':
                    if (idDestaConexao && dados.posicao) {
                        const contaAtiva = await buscarUsuarioNaNuvem(usuarioDestaConexao);
                        if (contaAtiva) {
                            contaAtiva.last_pos = dados.posicao;
                            await salvarUsuarioNaNuvem(contaAtiva);
                        }

                        enviarParaTodosMenos(idDestaConexao, {
                            "status": "player_moveu",
                            "id_oficial": idDestaConexao,
                            "posicao": dados.posicao
                        });
                    }
                    break;
            }
        } catch (erro) {
            console.error("❌ Erro ao processar mensagem:", erro);
        }
    });

    ws.on('close', () => {
        if (idDestaConexao) {
            console.log(`🛑 Player desconectado: ${usuarioDestaConexao}`);
            clientesConectados.delete(idDestaConexao); // CORRIGIDO: .delete() em vez de .erase()
            
            enviarParaTodosMenos(idDestaConexao, {
                "status": "player_desconectou",
                "id_oficial": idDestaConexao
            });
        }
    });
});

function enviarParaTodosMenos(idExcluido, dados) {
    const pacote = JSON.stringify(dados);
    clientesConectados.forEach((cliente, id) => {
        if (id !== idExcluido && cliente.ws.readyState === WebSocket.OPEN) {
            cliente.ws.send(pacote);
        }
    });
}
