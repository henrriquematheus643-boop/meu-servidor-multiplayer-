const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// Armazena as informações dos jogadores que estão online no mapa
// Estrutura: "nome_do_jogador" => { socket, posicao: [x, y, z] }
const jogadoresOnline = new Map();

console.log(`🚀 [Servidor Reduto RP] Iniciado com sucesso na porta ${PORT}`);

server.on('connection', (socket) => {
    let meuUsuario = null;
    console.log("🔄 [Conexão] Um novo dispositivo se conectou ao WebSocket.");

    socket.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString('utf8'));
            const { comando, username, posicao } = msg;

            // 🔑 LOGAR / ENTRAR NO MAPA
            if (comando === 'logar') {
                meuUsuario = username || "Jogador_" + Math.floor(1000 + Math.random() * 9000);
                console.log(`🔓 [Login] ${meuUsuario} entrou no servidor online.`);

                // Salva o jogador na lista com a posição inicial padrão [0, 1, 0]
                jogadoresOnline.set(meuUsuario, { socket: socket, posicao: [0.0, 1.0, 0.0] });

                // 1. Responde para o próprio jogador que ele logou com sucesso
                socket.send(JSON.stringify({
                    status: "logado_com_sucesso",
                    nome_oficial: meuUsuario
                }));

                // 2. Envia para o jogador que acabou de entrar a lista de todos os outros que já estavam lá
                jogadoresOnline.forEach((dadosJogador, nomeJogador) => {
                    if (nomeJogador !== meuUsuario) {
                        socket.send(JSON.stringify({
                            status: "player_nasceu",
                            nome_oficial: nomeJogador,
                            posicao: dadosJogador.posicao
                        }));
                    }
                });

                // 3. Avisa todos os outros jogadores da rede que um novo player nasceu
                transmitirParaOutros(meuUsuario, {
                    status: "player_nasceu",
                    nome_oficial: meuUsuario,
                    posicao: [0.0, 1.0, 0.0]
                });
            }

            // 🏃‍♂️ ATUALIZAR POSIÇÃO (MULTIPLAYER)
            else if (comando === 'salvar_posicao') {
                if (meuUsuario && posicao && posicao.length === 3) {
                    const dados = jogadoresOnline.get(meuUsuario);
                    if (dados) {
                        dados.posicao = posicao; // Atualiza a posição na memória do servidor

                        // Retransmite a nova posição para os outros jogadores verem o movimento
                        transmitirParaOutros(meuUsuario, {
                            status: "player_moveu",
                            nome_oficial: meuUsuario,
                            posicao: posicao
                        });
                    }
                }
            }

        } catch (err) {
            console.log("⚠️ [Erro] Falha ao processar pacote JSON recebido.");
        }
    });

    // ❌ QUANDO O JOGADOR FECHA O JOGO OU DESCONECTA
    socket.on('close', () => {
        if (meuUsuario) {
            console.log(`❌ [Desconexão] ${meuUsuario} saiu do jogo.`);
            jogadoresOnline.delete(meuUsuario);

            // Avisa os outros jogadores para removerem o clone desse player da tela
            transmitirParaOutros(meuUsuario, {
                status: "player_saiu",
                nome_oficial: meuUsuario
            });
        }
    });
});

// Função auxiliar para enviar pacotes para todos os jogadores conectados, exceto quem enviou
function transmitirParaOutros(remetente, dados) {
    const dadosString = JSON.stringify(dados);
    jogadoresOnline.forEach((dadosJogador, nomeJogador) => {
        if (nomeJogador !== remetente && dadosJogador.socket.readyState === WebSocket.OPEN) {
            dadosJogador.socket.send(dadosString);
        }
    });
}
