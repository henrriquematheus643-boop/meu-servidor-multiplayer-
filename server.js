const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosContas = {}; 

async function iniciar() {
    console.log("[Jarvis] Sincronizando banco de dados do GitHub...");
    usuariosContas = await banco.carregarListaUsuarios();
    console.log("[Jarvis] Servidor Reduto RP totalmente Online!");
}
iniciar();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // 1. AÇÃO: REGISTRAR (Salva no usuarios.json e cria a pasta física)
            if (dados.action === "register") {
                if (usuariosContas[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Este usuário já existe!" }));
                }

                // Estrutura limpa de cima para baixo
                usuariosContas[dados.username] = {
                    nome: dados.username,
                    senha: dados.password,
                    id: 1000 + Object.keys(usuariosContas).filter(k => k !== '_sha').length
                };

                // Envia a resposta imediata pro Godot para não travar a tela do player
                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));

                // Grava no arquivo usuarios.json lá no GitHub
                const novoSha = await banco.salvarListaUsuarios(usuariosContas);
                if (novoSha) usuariosContas._sha = novoSha;

                // Cria a pasta física com a posição inicial de segurança [0, 2, 0]
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);
                return;
            }

            // 2. AÇÃO: LOGIN (Entra direto usando os dados salvos)
            if (dados.action === "login") {
                const conta = usuariosContas[dados.username];
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // Posição padrão (será atualizada pelo save_position do jogo)
                        message: "Entrando no Reduto RP..."
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // 3. AÇÃO: SALVAR LOCALIZAÇÃO (Salva apenas na pasta do player)
            if (dados.action === "save_position") {
                if (usuariosContas[dados.username]) {
                    // Salva direto na pasta física: players/Nome/dados.json
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // 4. SISTEMA MULTIPLAYER (Mandar movimento para os outros players)
            wss.clients.forEach(c => { if (c !== ws && c.readyState === WebSocket.OPEN) c.send(message); });
        } catch (e) {}
    });
});
