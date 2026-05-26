// === REDUTO RP - SERVIDOR COM SALVAMENTO NO GITHUB ===
const WebSocket = require('ws');
const axios = require('axios'); // Necessário para conversar com a API do GitHub

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// --- CONFIGURAÇÃO SECRETA DO GITHUB (COLOQUE SEUS DADOS AQUI) ---
const GITHUB_TOKEN = "SEU_TOKEN_AQUI"; // Cole aqui o Token que você gerou lá nas configurações
const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-"; // Seu usuário / nome do repositório
const GITHUB_FILE_PATH = "usuarios.json"; // O nome do arquivo no GitHub

// Objeto na memória que vai guardar os usuários temporariamente
let usuariosCadastrados = {};
let shaArquivo = ""; // O GitHub precisa desse código (SHA) para saber qual versão está atualizando

// --- FUNÇÃO 1: BUSCAR OS DADOS DO GITHUB ASSIM QUE O SERVIDOR LIGA ---
async function carregarDadosDoGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const resposta = await axios.get(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        // Guarda o SHA do arquivo (obrigatório para salvar depois)
        shaArquivo = resposta.data.sha;

        // O GitHub envia o texto criptografado em Base64, precisamos decodificar para texto normal
        const textoJson = Buffer.from(resposta.data.content, 'base64').toString('utf8');
        usuariosCadastrados = JSON.parse(textoJson);
        
        console.log("[GitHub Banco] Todas as contas e posições foram baixadas com sucesso!");
    } catch (erro) {
        if (erro.response && erro.response.status === 404) {
            console.log("[GitHub Banco] Arquivo usuarios.json não existe no GitHub ainda. Criando um novo do zero...");
            usuariosCadastrados = {};
        } else {
            console.error("[Erro GitHub] Falha ao conectar ou baixar os dados:", erro.message);
        }
    }
}

// --- FUNÇÃO 2: ENVIAR OS DADOS ATUALIZADOS DE VOLTA PARA O GITHUB ---
async function salvarNoGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        
        // Transforma o nosso objeto de usuários em texto limpo e depois em Base64
        const textoJson = JSON.stringify(usuariosCadastrados, null, 2);
        const conteudoBase64 = Buffer.from(textoJson).toString('base64');

        const dadosParaEnviar = {
            message: "Reduto RP: Atualizando contas e posições dos jogadores",
            content: conteudoBase64,
            sha: shaArquivo // Diz ao GitHub qual versão estamos substituindo
        };

        const resposta = await axios.put(url, dadosParaEnviar, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        // Atualiza o SHA para a próxima gravação não dar erro de conflito
        shaArquivo = resposta.data.content.sha;
        console.log("[GitHub Banco] Dados sincronizados e salvos no GitHub com sucesso!");

    } catch (erro) {
        console.error("[Erro GitHub] Não foi possível subir os dados para o GitHub:", erro.message);
    }
}

// Inicializa o servidor baixando o banco de dados do GitHub primeiro
carregarDadosDoGitHub();

let proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;
console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);

// --- LÓGICA DO WEBSOCKET MULTIPLAYER ---
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
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
                        last_pos: [0, 2, 0] // Posição inicial padrão na cidade
                    };
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                    
                    // Salva no GitHub assim que a conta é criada
                    await salvarNoGitHub();
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
                        last_pos: conta.last_pos,
                        message: "Bem-vindo de volta!"
                    }));
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    
                    // Como o jogador anda toda hora, vamos salvar no GitHub. 
                    // Nota: O GitHub tem limite de atualizações por minuto, mas para testes vai funcionar bem!
                    await salvarNoGitHub();
                    console.log(`[Posição] ${username} salvo no GitHub em: ${pos}`);
                }
                return;
            }

            // --- 4. MULTIPLAYER (MOVIMENTO EM TEMPO REAL) ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Ignora mensagens fora do padrão
        }
    });
});

