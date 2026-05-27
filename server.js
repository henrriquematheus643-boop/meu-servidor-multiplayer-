const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Sistema de Nuvem Reduto RP v3 - Ativado");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- REGISTRO (Com trava real para nomes iguais) ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                // Busca se já existe esse nome exato
                const usuarioExistente = await banco.buscarUsuarioUnico(username);
                
                if (usuarioExistente) {
                    console.log(`[Registro] Recusado: ${username} já existe.`);
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                // Se não existe, cria a conta nova
                const novaConta = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 8999),
                    last_pos: [0, 2, 0]
                };

                await banco.salvarUsuarioDireto(novaConta);
                console.log(`[Registro] Sucesso: ${username} salvo na nuvem.`);
                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
                return;
            }

            // --- LOGIN (Com verificação rigorosa) ---
            if (dados.action === "login") {
                const usernameDigitado = String(dados.username).trim();
                const passwordDigitada = String(dados.password).trim();

                const conta = await banco.buscarUsuarioUnico(usernameDigitado);
                
                // Verifica se a conta existe E se a senha bate exatamente
                if (conta && String(conta.password) === passwordDigitada) {
                    console.log(`[Login] Sucesso: ${usernameDigitado} entrou.`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    console.log(`[Login] Falhou: Dados incorretos para ${usernameDigitado}`);
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorretos!" }));
                }
                return;
            }

            // --- SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                if (dados.username && dados.pos) {
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // --- MULTIPLAYER ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            console.error("Erro no servidor:", erro);
        }
    });
});
