const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let usuariosCadastrados = {};
let bancoCarregado = false; // Trava de segurança

// Função corrigida: Só libera o servidor DEPOIS de puxar os dados da nuvem
async function iniciarServidorComNuvem() {
    console.log("[Game Rubi] Iniciando conexão com o MongoDB...");
    
    // Tenta carregar os dados em um loop até conseguir se conectar à nuvem
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
        try {
            usuariosCadastrados = await banco.carregarTodosOsUsuarios();
            
            // Se encontrou dados ou pelo menos conectou sem erro
            bancoCarregado = true;
            console.log(`[Game Rubi] SUCESSO! Nuvem sincronizada na tentativa ${tentativa}. ${Object.keys(usuariosCadastrados).length} contas prontas.`);
            break;
        } catch (erro) {
            console.log(`[Game Rubi] Aguardando nuvem... Tentativa ${tentativa}/5`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Espera 3 segundos antes de tentar de novo
        }
    }

    if (!bancoCarregado) {
        console.log("[Game Rubi] Aviso: Servidor iniciado em modo de segurança, mas a nuvem pode estar fora do ar.");
    }
    console.log(`[Game Rubi] Servidor do Reduto RP Online na porta ${PORT}`);
}
iniciarServidorComNuvem();

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. AÇÃO: REGISTRAR ---
            if (dados.action === "register") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                if (usuariosCadastrados[username]) {
                    return ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                }

                usuariosCadastrados[username] = {
                    username: username,
                    password: password,
                    id: 1000 + Object.keys(usuariosCadastrados).length,
                    last_pos: [0, 2, 0]
                };

                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                
                // Salva o backup na nuvem na mesma hora
                await banco.salvarListaCompleta(usuariosCadastrados);
                return;
            }

            // --- 2. AÇÃO: LOGIN ---
            if (dados.action === "login") {
                const username = String(dados.username).trim();
                const password = String(dados.password).trim();

                const conta = usuariosCadastrados[username];

                if (conta && String(conta.password) === password) {
                    console.log(`[Reduto RP] ${username} entrou.`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos || [0, 2, 0],
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta!" }));
                }
                return;
            }

            // --- 3. AÇÃO: SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const username = String(dados.username).trim();
                if (usuariosCadastrados[username] && dados.pos) {
                    usuariosCadastrados[username].last_pos = dados.pos;
                    
                    // Sincroniza a posição com a nuvem
                    await banco.salvarListaCompleta(usuariosCadastrados);
                }
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
