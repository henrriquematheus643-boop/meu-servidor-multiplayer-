const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP conectado ao Banco em Nuvem!");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- 1. REGISTRO (Salva na Nuvem para Sempre) ---
            if (dados.action === "register") {
                // Busca a lista atualizada direto do banco para saber se o nome já existe
                const listaAtual = await banco.carregarListaUsuarios();
                
                if (listaAtual[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Este usuario ja existe!" }));
                }

                // Cria o novo usuário na lista
                listaAtual[dados.username] = {
                    nome: dados.username,
                    senha: dados.password,
                    id: 1000 + Object.keys(listaAtual).length
                };

                // Salva a lista de contas atualizada no banco de dados
                await banco.salvarListaUsuarios(listaAtual);
                
                // Cria a posição inicial de segurança do player na nuvem
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);

                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
                return;
            }

            // --- 2. CONSERTADO: LOGIN (Busca direto na Nuvem na hora) ---
            if (dados.action === "login") {
                // Força o servidor a carregar as contas do banco AGORA
                const listaAtual = await banco.carregarListaUsuarios();
                const conta = listaAtual[dados.username];
                
                if (conta && conta.senha === dados.password) {
                    console.log(`[Login] ${dados.username} entrou no servidor.`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // O jogo vai carregar a posição real logo em seguida
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuario ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO (Atualiza a todo momento sem apagar nada) ---
            if (dados.action === "save_position") {
                if (dados.username && dados.pos) {
                    // Atualiza a posição na nuvem sem mexer na senha ou no ID do player
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            console.error("[Erro Servidor]", erro.message);
        }
    });
});
