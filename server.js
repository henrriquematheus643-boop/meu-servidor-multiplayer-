const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuarios = {}; 

async function iniciar() {
    usuarios = await banco.carregarTodosOsPlayers();
    console.log(`[Jarvis] Pronto! ${Object.keys(usuarios).length} pastas de players prontas.`);
}
iniciar();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // REGISTRO
            if (dados.action === "register") {
                if (usuarios[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Esta pasta já existe!" }));
                }
                
                // Primeiro guarda no servidor para o login funcionar na hora
                usuarios[dados.username] = {
                    senha: dados.password,
                    posicao: [0, 2, 0],
                    id: 1000 + Object.keys(usuarios).length
                };

                // Avisa o jogo que deu certo
                ws.send(JSON.stringify({ success: true, message: "Pasta criada! Pode logar." }));
                
                // Agora envia para o GitHub em segundo plano
                const novoSha = await banco.salvarPlayer(dados.username, usuarios[dados.username]);
                if (novoSha) usuarios[dados.username]._sha = novoSha;
                return;
            }

            // LOGIN
            if (dados.action === "login") {
                const conta = usuarios[dados.username];
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.posicao,
                        message: "Entrando na sua pasta..."
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha ou Pasta não encontrada!" }));
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
