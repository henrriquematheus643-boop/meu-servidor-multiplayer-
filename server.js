const WebSocket = require('ws');
const banco = require('./database.js'); // Conecta direto com o seu database.js da nuvem

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP Online e Conectado a Nuvem!");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- 1. AÇÃO: REGISTRAR CONTA (Salva na Nuvem) ---
            if (dados.action === "register") {
                const listaAtual = await banco.carregarListaUsuarios();
                
                // Se o usuário já existir no banco em nuvem, barra o registro
                if (listaAtual[dados.username]) {
                    console.log(`[Registro] Nome recusado (ja existe): ${dados.username}`);
                    return ws.send(JSON.stringify({ success: false, message: "Este usuario ja existe!" }));
                }

                // Cria o ID único baseado em quantos players já existem no banco
                const novoId = 1000 + Object.keys(listaAtual).length;

                // Salva a conta de forma definitiva na nuvem
                await banco.salvarNovoUsuario(dados.username, dados.password, novoId);
                
                // Cria a posição inicial padrão na nuvem para o player
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);

                console.log(`[Registro] Nova conta salva na nuvem: ${dados.username} (ID: ${novoId})`);
                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
                return;
            }

            // --- 2. AÇÃO: LOGIN (Busca na Nuvem na hora) ---
            if (dados.action === "login") {
                const listaAtual = await banco.carregarListaUsuarios();
                const conta = listaAtual[dados.username];

                // Valida se o usuário existe e se a senha está certa
                if (conta && String(conta.senha) === String(dados.password)) {
                    console.log(`[Login] ${dados.username} entrou com sucesso!`);
                    
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // O jogo vai puxar a posição real logo em seguida
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    console.log(`[Login Falhou] Dados incorretos para: ${dados.username}`);
                    ws.send(JSON.stringify({ success: false, message: "Usuario ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO / ATUALIZAÇÕES ---
            if (dados.action === "save_position") {
                if (dados.username && dados.pos) {
                    // Atualiza a posição na nuvem a todo momento sem apagar a conta
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            // Envia a movimentação de um player para todos os outros que estão online
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            console.error("[Erro no Processamento]", erro.message);
        }
    });
});
