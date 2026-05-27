const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuarios = {}; 

async function iniciar() {
    console.log("[Jarvis] Carregando pastas de players do GitHub...");
    usuarios = await banco.carregarTodosOsPlayers();
    console.log(`[Jarvis] ${Object.keys(usuarios).length} players carregados. Pronto para o Reduto RP!`);
}
iniciar();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // REGISTRO
            if (dados.action === "register") {
                if (usuarios[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Pasta já existe!" }));
                }
                const novo = {
                    senha: dados.password,
                    posicao: [0, 2, 0],
                    id: 1000 + Object.keys(usuarios).length
                };
                usuarios[dados.username] = novo;
                ws.send(JSON.stringify({ success: true, message: "Conta e Pasta criadas!" }));
                
                // Salva no GitHub em segundo plano (não trava o player)
                const novoSha = await banco.salvarPlayer(dados.username, novo);
                usuarios[dados.username]._sha = novoSha;
                return;
            }

            // LOGIN (Agora é instantâneo)
            if (dados.action === "login") {
                const conta = usuarios[dados.username];
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.posicao,
                        message: "Login realizado com sucesso!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Dados incorretos!" }));
                }
                return;
            }

            // SALVAR POSIÇÃO
            if (dados.action === "save_position") {
                if (usuarios[dados.username]) {
                    usuarios[dados.username].posicao = dados.pos;
                    const novoSha = await banco.salvarPlayer(dados.username, usuarios[dados.username]);
                    if (novoSha) usuarios[dados.username]._sha = novoSha;
                }
                return;
            }

            // MULTIPLAYER
            wss.clients.forEach(c => { if (c !== ws && c.readyState === WebSocket.OPEN) c.send(message); });
        } catch (e) {}
    });
});
