// === REDUTO RP - SERVIDOR MULTIPLAYER (server.js) ===
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path'); // REMOVIDO ERRO DE CAMINHO: Adicionado para gerenciar pastas corretamente

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// CORREÇÃO CRÍTICA: Agora o arquivo sempre será salvo exatamente na mesma pasta do seu server.js
const DATA_FILE = path.join(__dirname, 'usuarios.json');

// Carrega os usuários do arquivo ao iniciar, ou cria um vazio se não existir
let usuariosCadastrados = {};

try {
    if (fs.existsSync(DATA_FILE)) {
        // CORREÇÃO: Forçando a leitura como texto puro ('utf8') para evitar bugs de leitura
        const dadosLidos = fs.readFileSync(DATA_FILE, 'utf8');
        usuariosCadastrados = JSON.parse(dadosLidos);
        console.log("[Banco] Dados dos cidadãos carregados com sucesso!");
    } else {
        console.log("[Banco] Nenhum arquivo de contas encontrado. Criando um novo...");
    }
} catch (erro) {
    console.log("[Erro] Falha ao ler o arquivo de usuários, iniciando banco vazio:", erro);
}

// Define o próximo ID com base em quantos usuários já existem para nunca repetir
let proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;

// Função organizada para salvar os dados com proteção de erro
function salvarNoDisco() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usuariosCadastrados, null, 2));
        console.log("[Banco] Posições e contas salvas no arquivo json!");
    } catch (erro) {
        console.log("[Erro] Não foi possível gravar os dados no disco:", erro);
    }
}

console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);

wss.on('connection', (ws) => {
    console.log("[Servidor] Um novo jogador se conectou à rede.");

    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRO ---
            if (dados.action === "register") {
                const { username, password } = dados;
                
                if (!username || !password) {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou senha inválidos!" }));
                    return;
                }

                if (usuariosCadastrados[username]) {
                    ws.send(JSON.stringify({ success: false, message: "Esse usuário já existe!" }));
                } else {
                    usuariosCadastrados[username] = {
                        password: password,
                        id: proximoPlayerId++,
                        last_pos: [0, 2, 0] // Posição inicial padrão na cidade
                    };
                    salvarNoDisco(); // Grava no arquivo imediatamente
                    ws.send(JSON.stringify({ success: true, message: "Conta criada com sucesso!" }));
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
                        last_pos: conta.last_pos, // Envia de volta para o Godot teletransportar o player
                        message: "Bem-vindo de volta ao Reduto RP!"
                    }));
                    console.log(`[Login] Cidadão conectado: ${dados.username}`);
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou senha incorretos!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                
                if (usuariosCadastrados[username] && pos) {
                    usuariosCadastrados[username].last_pos = pos;
                    salvarNoDisco(); // Salva a caminhada dele no arquivo .json
                    console.log(`[Posição] ${username} salvo em: X:${pos[0].toFixed(2)} Y:${pos[1].toFixed(2)} Z:${pos[2].toFixed(2)}`);
                }
                return;
            }

            // --- 4. MULTIPLAYER (MOVIMENTO EM TEMPO REAL) ---
            // Repassa os pacotes normais de movimentação para os outros jogadores na sessão
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Silencia mensagens que não sejam do formato de login/movimento padrão
        }
    });

    ws.on('close', () => {
        console.log("[Servidor] Um jogador desconectou da sessão.");
    });
});
