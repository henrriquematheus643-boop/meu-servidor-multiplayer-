const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosContas = {}; // Armazena o que vem do usuarios.json

async function iniciar() {
    console.log("[Jarvis] Baixando lista geral de usuários...");
    usuariosContas = await banco.carregarListaUsuarios();
    console.log("[Jarvis] Servidor Reduto RP pronto e sincronizado!");
}
iniciar();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // 1. REGISTRO (Salva no arquivo usuarios.json de cima para baixo)
            if (dados.action === "register") {
                if (usuariosContas[dados.username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Este usuário já existe!" }));
                }

                // Cria o formato limpo que você pediu: sem posição, só Nome, Senha e ID
                usuariosContas[dados.username] = {
                    nome: dados.username,
                    senha: dados.password,
                    id: 1000 + Object.keys(usuariosContas).filter(k => k !== '_sha').length
                };

                ws.send(JSON.stringify({ success: true, message: "Conta registrada com sucesso!" }));

                // Atualiza o arquivo usuarios.json lá no seu GitHub
                const novoSha = await banco.salvarListaUsuarios(usuariosContas);
                usuariosContas._sha = novoSha;

                // Cria a pasta física inicial dele com a posição padrão [0, 2, 0]
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);
                return;
            }

            // 2. LOGIN (Busca direto do arquivo usuarios.json que está na memória)
            if (dados.action === "login") {
                const conta = usuariosContas[dados.username];
                if (conta && conta.senha === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // Envia a inicial (o jogo vai atualizar com o save_position logo em seguida)
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha ou Usuário incorreto!" }));
                }
                return;
            }

            // 3. SALVAR POSIÇÃO (Não mexe no arquivo geral, salva na pasta física do player)
            if (dados.action === "save_position") {
                if (usuariosContas[dados.username]) {
                    // Envia a posição para a pasta do jogador: players/Nome/dados.json
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // 4. MULTIPLAYER EM TEMPO REAL
            wss.clients.forEach(c => { if (c !== ws && c.readyState === WebSocket.OPEN) c.send(message); });
        } catch (e) {}
    });
});
