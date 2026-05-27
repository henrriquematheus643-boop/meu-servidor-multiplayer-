const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP via Armazenamento GitHub Online!");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                const listaContas = await banco.carregarListaUsuarios();
                const usuarioLimpado = String(dados.username).trim();

                // Se o usuário já existir no arquivo do GitHub, cancela
                if (listaContas[usuarioLimpado]) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                // Adiciona o novo player no formato padrão
                listaContas[usuarioLimpado] = {
                    username: usuarioLimpado,
                    password: String(dados.password).trim(),
                    id: 1000 + Object.keys(listaContas).length,
                    last_pos: [0, 2, 0]
                };

                // Envia direto para o seu repositório do GitHub
                await banco.salvarListaUsuarios(listaContas);
                
                console.log(`[GitHub Salvo] Conta criada: ${usuarioLimpado}`);
                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const listaContas = await banco.carregarListaUsuarios();
                const usuarioLimpado = String(dados.username).trim();
                const senhaLimpada = String(dados.password).trim();

                const conta = listaContas[usuarioLimpado];

                // Validação idêntica às chaves que o Godot envia
                if (conta && String(conta.password) === senhaLimpada) {
                    console.log(`[Login] ${usuarioLimpado} entrou.`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    console.log(`[Login Falhou] Dados incorretos para: ${usuarioLimpado}`);
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorretos!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const listaContas = await banco.carregarListaUsuarios();
                const usuarioLimpado = String(dados.username).trim();

                if (listaContas[usuarioLimpado] && dados.pos) {
                    listaContas[usuarioLimpado].last_pos = dados.pos;
                    await banco.salvarListaUsuarios(listaContas);
                }
                return;
            }

            // --- 4. TRANSMISSÃO MULTIPLAYER ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Ignora erros bobos de JSON para não derrubar o servidor
        }
    });
});
