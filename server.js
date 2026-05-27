const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("[Jarvis] Servidor Reduto RP Anti-Duplicacao Online!");

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);

            // --- 1. REGISTRO (Bloqueia nomes iguais de verdade) ---
            if (dados.action === "register") {
                // Puxa os dados mais novos direto do banco na nuvem
                const listaAtual = await banco.carregarListaUsuarios();
                
                // Se o nome já existir na lista vinda da nuvem, cancela!
                if (listaAtual[dados.username]) {
                    console.log(`[Registro Recusado] ${dados.username} ja existe.`);
                    return ws.send(JSON.stringify({ success: false, message: "Este usuario ja existe!" }));
                }

                // Se não existir, gera o ID baseado na quantidade atual de contas
                const novoId = 1000 + Object.keys(listaAtual).length;

                // Salva o usuário sozinho no banco de dados
                await banco.salvarNovoUsuario(dados.username, dados.password, novoId);
                
                // Cria a posição inicial dele para não dar erro no mapa
                await banco.salvarPosicaoPlayer(dados.username, [0, 2, 0]);

                console.log(`[Registro Sucesso] Nova conta criada: ${dados.username}`);
                ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
                return;
            }

            // --- 2. LOGIN (Busca na nuvem e valida na hora) ---
            if (dados.action === "login") {
                // Força o servidor a ler o banco de dados no exato momento do clique
                const listaAtual = await banco.carregarListaUsuarios();
                const conta = listaAtual[dados.username];
                
                if (conta && conta.senha === dados.password) {
                    console.log(`[Login Sucesso] ${dados.username} entrou no jogo.`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: [0, 2, 0], // Posição padrão que o Godot vai atualizar em seguida
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    console.log(`[Login Falhou] Tentativa errada para o usuario: ${dados.username}`);
                    ws.send(JSON.stringify({ success: false, message: "Usuario ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                if (dados.username && dados.pos) {
                    await banco.salvarPosicaoPlayer(dados.username, dados.pos);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            console.error("[Erro Servidor]", erro.message);
        }
    });
});
