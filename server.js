const WebSocket = require('ws');
const banco = require('./database.js'); // Puxa as funções da nuvem

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Game Rubi] Servidor do Reduto RP Inicializado com sucesso!");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            // Transforma o texto vindo do Godot em dados lógicos
            const dados = JSON.parse(message);

            // --- 1. AÇÃO: REGISTRAR CONTA ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                console.log(`[Game Rubi] Recebendo tentativa de registro para: ${username}`);

                // Pergunta para a nuvem se esse nome já existe
                const existe = await banco.buscarUsuario(username);
                if (existe) {
                    console.log(`[Game Rubi] Registro recusado: ${username} já existe.`);
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                // Cria a estrutura exata que o seu jogo precisa
                const novoPlayer = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                // Responde o jogo primeiro para não dar lag
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));

                // Envia para o MongoDB logo em seguida para salvar para sempre
                await banco.salvarUsuario(novoPlayer);
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                console.log(`[Game Rubi] Recebendo tentativa de login de: ${username}`);

                // Busca o usuário direto na nuvem
                const conta = await banco.buscarUsuario(username);

                // Compara se o usuário existe E se a senha bate exatamente com a digitada
                if (conta && String(conta.password) === password) {
                    console.log(`[Game Rubi] Login aprovado para: ${username}`);
                    
                    // Envia a resposta de sucesso de volta para o Godot entrar no mapa
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    console.log(`[Game Rubi] Login recusado para: ${username} (Dados incorretos)`);
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                if (dados.username && dados.pos) {
                    // Atualiza a localização na nuvem a todo momento
                    await banco.atualizarPosicao(dados.username, dados.pos);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            // Repassa a posição dos players na tela para todos os outros conectados
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Protege o servidor contra mensagens corrompidas do WebSocket
        }
    });
});
