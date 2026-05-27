const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuarios = {}; 

async function iniciar() {
    console.log("[Jarvis] Lendo pastas físicas de jogadores...");
    usuarios = await banco.carregarTodosOsPlayers();
    console.log("[Jarvis] Sistema de Pastas pronto!");
}
iniciar();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // AÇÃO: REGISTRAR (Cria a pasta física)
            if (dados.action === "register") {
                if (usuarios[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Pasta já existe!" }));
                }
                
                usuarios[dados.username] = {
                    nome: dados.username,
                    senha: dados.password,
                    posicao: [0, 2, 0],
                    id: 1000 + Object.keys(usuarios).length
                };

                // Cria fisicamente no GitHub
                const novoSha = await banco.salvarNoGitHub(dados.username, usuarios[dados.username]);
                if (novoSha) usuarios[dados.username]._sha = novoSha;

                ws.send(JSON.stringify({ success: true, message: "Pasta física criada no Game Rubi!" }));
                return;
            }

            // AÇÃO: LOGIN (Entra na pasta)
            if (dados.action === "login") {
                const conta = usuarios[dados.username];
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.posicao,
                        message: "Você entrou na sua pasta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Pasta ou senha não encontrada!" }));
                }
                return;
            }

            // AÇÃO: SALVAR POSIÇÃO
            if (dados.action === "save_position") {
                if (usuarios[dados.username]) {
                    usuarios[dados.username].posicao = dados.pos;
                    const novoSha = await banco.salvarNoGitHub(dados.username, usuarios[dados.username]);
                    if (novoSha) usuarios[dados.username]._sha = novoSha;
                }
                return;
            }

            // REPASSE MULTIPLAYER
            wss.clients.forEach(c => { if (c !== ws && c.readyState === WebSocket.OPEN) c.send(message); });
        } catch (e) {}
    });
});
