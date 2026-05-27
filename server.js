const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosContas = {}; 

// Quando o servidor liga, ele busca as contas salvas na nuvem para ninguém perder o login
async function iniciarServidor() {
    console.log("[Jarvis] Conectando e baixando contas da nuvem...");
    // Espera 3 segundos para dar tempo do MongoDB conectar primeiro
    setTimeout(async () => {
        usuariosContas = await banco.carregarListaUsuarios();
        console.log(`[Jarvis] Sucesso! ${Object.keys(usuariosContas).length} contas carregadas e protegidas.`);
    }, 3000);
}
iniciarServidor();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- 1. REGISTRO (Salva para sempre na nuvem) ---
            if (dados.action === "register") {
                // Atualiza a lista antes de checar para garantir que pegou registros novos
                usuariosContas = await banco.carregarListaUsuarios();
                
                if (usuariosContas[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Este usuario ja existe!" }));
                }

                usuariosContas[dados.username] = {
                    nome: dados.username,
                    senha: dados.password,
                    id: 1000 + Object.keys(usuariosContas).length
                };

                ws.send(JSON.stringify({ success: true, message: "Conta criada e salva na nuvem!" }));

                // Salva no MongoDB de cima para baixo
                await banco.salvarListaUsuarios(usuariosContas);
                // Cria a posicao inicial dele para sempre
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);
                return;
            }

            // --- 2. LOGIN (Busca direto os dados seguros) ---
            if (dados.action === "login") {
                usuariosContas = await banco.carregarListaUsuarios();
                const conta = usuariosContas[dados.username];
                
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // O save_position do seu jogo vai atualizar isso logo em seguida
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuario ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO (Atualiza toda hora sem apagar nada) ---
            if (dados.action === "save_position") {
                // Atualiza direto no banco de dados a posicao atual do player
                await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});
