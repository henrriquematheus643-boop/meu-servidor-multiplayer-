const WebSocket = require('ws');
const fs = require('fs'); // Para salvar os dados em um arquivo real

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Nome do arquivo onde as contas e posições serão salvas
const DATA_FILE = './usuarios.json';

// Carrega os usuários do arquivo ao iniciar, ou cria um vazio se não existir
let usuariosCadastrados = {};
if (fs.existsSync(DATA_FILE)) {
    usuariosCadastrados = JSON.parse(fs.readFileSync(DATA_FILE));
    console.log("[Banco] Dados carregados com sucesso!");
}

let proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;

function salvarNoDisco() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(usuariosCadastrados, null, 2));
}

console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRO ---
            if (dados.action === "register") {
                const { username, password } = dados;
                if (usuariosCadastrados[username]) {
                    ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                } else {
                    usuariosCadastrados[username] = {
                        password: password,
                        id: proximoPlayerId++,
                        last_pos: [0, 2, 0] // Posição inicial padrão
                    };
                    salvarNoDisco();
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                }
                return;
            }

            // --- 2. LOGIN ---
            if (dados.action === "login") {
                const conta = usuariosCadastrados[dados.username];
                if (conta && conta.password === dados.password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos, // Envia a posição onde ele parou
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO (Ação nova que você pediu) ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    salvarNoDisco(); // Grava no arquivo .json
                    console.log(`[Posição] ${username} salvou em: ${pos}`);
                }
                return;
            }

            // --- 4. MULTIPLAYER (MOVIMENTO EM TEMPO REAL) ---
            // Repassa para os outros jogadores verem o boneco andando
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Silencia erros de JSON malformado
        }
    });
});
