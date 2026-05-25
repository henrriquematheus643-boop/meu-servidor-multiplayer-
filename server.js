// === MEU SERVIDOR MULTIPLAYER (server.js) ===
const WebSocket = require('ws');

// O Render define a porta automaticamente. Se for local, usa a 8080.
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Banco de dados temporário em memória (no futuro podemos salvar em arquivo)
const usuariosCadastrados = {}; 
let proximoPlayerId = 1000; // Os IDs do Reduto RP vão começar em 1000

console.log(`[Jarvis] Servidor do Reduto RP iniciado na porta ${PORT}`);

wss.on('connection', (ws) => {
    console.log("[Servidor] Um novo cidadão tentou conectar a rede.");

    ws.on('message', (message) => {
        try {
            // Transforma a mensagem do Godot em um objeto JavaScript
            const dados = JSON.parse(message);
            
            // --- 1. SISTEMA DE REGISTRO ONLINE ---
            if (dados.action === "register") {
                const { username, password } = dados;
                console.log(`[Registro] Tentativa de criar conta para: ${username}`);

                if (!username || !password) {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou senha vazios!" }));
                    return;
                }

                // Verifica se o usuário já existe no "banco de dados"
                if (usuariosCadastrados[username]) {
                    ws.send(JSON.stringify({ success: false, message: "Esse cidadão já está cadastrado!" }));
                } else {
                    // Salva o usuário e a senha
                    usuariosCadastrados[username] = {
                        password: password,
                        id: proximoPlayerId++
                    };
                    console.log(`[Sucesso] Conta criada: ${username} | ID: ${usuariosCadastrados[username].id}`);
                    
                    // RESPONDE AO GODOT (Isso destrava o seu botão de registrar!)
                    ws.send(JSON.stringify({ 
                        success: true, 
                        message: "Conta criada com sucesso!" 
                    }));
                }
                return; // Para o código aqui e não mistura com o multiplayer
            }

            // --- 2. SISTEMA DE LOGIN ONLINE ---
            if (dados.action === "login") {
                const { username, password } = dados;
                console.log(`[Login] Tentativa de entrada para: ${username}`);

                const conta = usuariosCadastrados[username];

                if (conta && conta.password === password) {
                    console.log(`[Sucesso] Cidadão logado: ${username}`);
                    
                    // RESPONDE AO GODOT COM O ID DO PERSONAGEM
                    ws.send(JSON.stringify({ 
                        success: true, 
                        message: "Bem-vindo ao Reduto RP!",
                        player_id: String(conta.id)
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou senha incorretos!" }));
                }
                return;
            }

            // --- 3. SISTEMA DE MULTIPLAYER (MOVIMENTAÇÃO) ---
            // Se não for login/registro, o servidor trata como movimentação dos bonecos no mapa
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    // Repassa a posição do boneco para os outros jogadores na sessão
                    client.send(message); 
                }
            });

        } catch (erro) {
            console.log("[Erro] Mensagem recebida em formato inválido:", erro);
        }
    });

    ws.on('close', () => {
        console.log("[Servidor] Um cidadão desconectou da cidade.");
    });
});
