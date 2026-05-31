const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Banco de dados temporário na memória do servidor
const contasRegistradas = {}; // Estrutura: { "mateus": "senha123" }
const posicoesJogadores = {}; // Estrutura: { "id_jogador": [x, y, z] }

// Lista de conexões multiplayer ativas
const clientesConectados = new Map(); 
let contadorId = 100; // Começa a gerar IDs a partir de 100

console.log(`🚀 Servidor Multiplayer do Reduto RP ativo na porta ${PORT}`);

wss.on('connection', (ws) => {
    // Cria uma ID única para esta conexão de rede
    const idUnica = (contadorId++).toString();
    let nomeUsuarioConectado = "";

    console.log(`📡 Nova conexão de rede estabelecida. ID Provisória: ${idUnica}`);

    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);

            // 📝 COMANDO: REGISTRAR CONTA
            if (dados.comando === "registrar") {
                const user = dados.username.trim().toLowerCase();
                const pass = dados.password;

                if (contasRegistradas[user]) {
                    // Erro: Usuário já existe no sistema!
                    ws.send(JSON.stringify({ 
                        status: "erro", 
                        msg: "Esta conta já existe!" 
                    }));
                    console.log(`⚠️ Registro negado: O nome '${user}' já está em uso.`);
                } else {
                    // Sucesso: Salva os dados de verdade
                    contasRegistradas[user] = pass;
                    ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    console.log(`📝 Nova conta criada com sucesso: ${user}`);
                }
            }

            // 🔐 COMANDO: LOGAR NA CONTA
            if (dados.comando === "logar") {
                const user = dados.username.trim().toLowerCase();
                const pass = dados.password;

                // Verifica se a conta existe e se a senha está correta
                if (contasRegistradas[user] && contasRegistradas[user] === pass) {
                    nomeUsuarioConectado = dados.username; // Guarda o nome real original
                    clientesConectados.set(idUnica, { ws: ws, nome: nomeUsuarioConectado });

                    // Se o jogador já tinha uma posição salva, puxa ela, senão nasce no centro
                    if (!posicoesJogadores[user]) {
                        posicoesJogadores[user] = [0, 2, 0];
                    }

                    // Envia a confirmação oficial com a ID gerada pelo servidor
                    ws.send(JSON.stringify({
                        status: "logado_com_sucesso",
                        id_oficial: idUnica,
                        nome_oficial: nomeUsuarioConectado,
                        posicao: posicoesJogadores[user]
                    }));

                    console.log(`🔓 Cidadão logado: ${nomeUsuarioConectado} | ID: ${idUnica}`);

                    // 📢 MULTIPLAYER MANAGER: Avisa a todos os outros que esse player nasceu
                    transmitirParaOutros(idUnica, {
                        status: "player_nasceu",
                        id_jogador: idUnica,
                        username: nomeUsuarioConectado,
                        posicao: posicoesJogadores[user]
                    });

                    // Informa ao jogador que acabou de entrar onde estão os outros jogadores que já estavam lá
                    clientesConectados.forEach((cliente, idAntigo) => {
                        if (idAntigo !== idUnica) {
                            ws.send(JSON.stringify({
                                status: "player_nasceu",
                                id_jogador: idAntigo,
                                username: cliente.name,
                                posicao: posicoesJogadores[cliente.name.toLowerCase()] || [0, 2, 0]
                            }));
                        }
                    });

                } else {
                    // Falha na autenticação
                    ws.send(JSON.stringify({ 
                        status: "erro", 
                        msg: "Usuário ou senha incorretos!" 
                    }));
                    console.log(`❌ Falha de login para o usuário: ${user}`);
                }
            }

            // 🏃 COMANDO: SALVAR E SINCRONIZAR POSIÇÃO MULTIPLAYER
            if (dados.comando === "salvar_posicao") {
                const user = dados.username.trim().toLowerCase();
                if (contasRegistradas[user]) {
                    posicoesJogadores[user] = dados.posicao;

                    // Transmite o movimento em tempo real para os outros jogadores verem ele andando
                    transmitirParaOutros(idUnica, {
                        status: "player_moveu",
                        id_oficial: idUnica,
                        posicao: dados.posicao
                    });
                }
            }

        } catch (e) {
            console.log("❌ Erro de processamento de pacote:", e.message);
        }
    });

    ws.on('close', () => {
        console.log(`📴 Conexão encerrada para ID: ${idUnica}`);
        if (clientesConectados.has(idUnica)) {
            const nomeExcluido = clientesConectados.get(idUnica).nome;
            clientesConectados.erase(idUnica);

            // 📢 MULTIPLAYER MANAGER: Avisa todo mundo para remover o boneco da tela
            transmitirParaOutros(idUnica, {
                status: "player_desconectou",
                id_oficial: idUnica
            });
            console.log(`👋 ${nomeExcluido} saiu do servidor.`);
        }
    });
});

// Função auxiliar do Multiplayer Manager para espalhar pacotes pela rede
function transmitirParaOutros(idRemetente, pacoteDados) {
    const jsonTexto = JSON.stringify(pacoteDados);
    clientesConectados.forEach((cliente, idDestinatario) => {
        if (idDestinatario !== idRemetente && cliente.ws.readyState === WebSocket.OPEN) {
            cliente.ws.send(jsonTexto);
        }
    });
}
