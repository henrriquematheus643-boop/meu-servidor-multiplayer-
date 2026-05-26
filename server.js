// === REDUTO RP - SERVIDOR COM SALVAMENTO DIRETO NO GITHUB ===
const WebSocket = require('ws');
const https = require('https'); // Usando o módulo nativo do Node para NUNCA dar erro ao iniciar!

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// --- CONFIGURAÇÃO OBRIGATÓRIA DO SEU GITHUB ---
// TODO: Cole aqui dentro das aspas o seu Token do GitHub (aquele que começa com ghp_)
const GITHUB_TOKEN = "COLE_AQUI_O_SEU_TOKEN_DO_GITHUB"; 

const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-";
const GITHUB_FILE_PATH = "usuarios.json";

let usuariosCadastrados = {};
let shaArquivo = ""; // Código que o GitHub exige para atualizar o arquivo

// --- FUNÇÃO PARA CONVERSAR COM A API DO GITHUB (BAIXAR E SALVAR) ---
function requisicaoGitHub(metodo, dadosEnviar = null) {
    return new Promise((resolve, reject) => {
        const opcoes = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            method: metodo,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'NodeJS-Server',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(opcoes, (res) => {
            let corpo = '';
            res.on('data', (chunk) => corpo += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(corpo));
                } else {
                    reject(new Error(`Erro GitHub (Status ${res.statusCode}): ${corpo}`));
                }
            });
        });

        req.on('error', (erro) => reject(erro));

        if (dadosEnviar) {
            req.write(JSON.stringify(dadosEnviar));
        }
        req.end();
    });
}

// --- 1. BAIXA OS DADOS DO REPOSITÓRIO ASSIM QUE O SERVIDOR LIGA ---
async function carregarDadosDoGitHub() {
    try {
        console.log("[GitHub] Conectando ao repositório para baixar as contas...");
        const resultado = await requisicaoGitHub('GET');
        shaArquivo = resultado.sha;
        
        // Decodifica o arquivo do GitHub (que vem em Base64) para texto normal
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        usuariosCadastrados = JSON.parse(textoJson);
        console.log("[GitHub] Sucesso! Todas as contas e posições foram carregadas.");
    } catch (erro) {
        if (erro.message.includes('404')) {
            console.log("[GitHub] Arquivo usuarios.json não existe ainda. Criando um novo...");
            usuariosCadastrados = {};
        } else {
            console.error("[Erro Crítico GitHub] Verifique se o seu Token está correto:", erro.message);
        }
    }
}

// --- 2. ENVIA O ARQUIVO ATUALIZADO DE VOLTA PARA O GITHUB ---
async function salvarNoGitHub() {
    try {
        const textoJson = JSON.stringify(usuariosCadastrados, null, 2);
        const conteudoBase64 = Buffer.from(textoJson).toString('base64');

        const dadosParaEnviar = {
            message: "Reduto RP: Sincronizando contas e posições",
            content: conteudoBase64,
            sha: shaArquivo // Avisa o GitHub qual versão estamos atualizando
        };

        const resultado = await requisicaoGitHub('PUT', dadosParaEnviar);
        shaArquivo = resultado.content.sha; // Atualiza o ID da versão para o próximo salvamento
        console.log("[GitHub] Banco de dados atualizado e salvo no seu repositório!");
    } catch (erro) {
        console.error("[Erro GitHub] Não foi possível enviar os dados:", erro.message);
    }
}

// Inicializa o banco de dados puxando do GitHub
carregarDadosDoGitHub();

let proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;
console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);

// --- O SEU SISTEMA MULTIPLAYER INTEGRADO (NÃO MEXIDO) ---
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // REGISTRO
            if (dados.action === "register") {
                const { username, password } = dados;
                if (usuariosCadastrados[username]) {
                    ws.send(JSON.stringify({ success: false, message: "Usuário já existe!" }));
                } else {
                    usuariosCadastrados[username] = {
                        password: password,
                        id: proximoPlayerId++,
                        last_pos: [0, 2, 0]
                    };
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                    await salvarNoGitHub(); // Envia a nova conta para o GitHub imediatamente
                }
                return;
            }

            // LOGIN
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

            // SALVAR POSIÇÃO
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    await salvarNoGitHub(); // Atualiza a posição atual do Player lá no GitHub
                    console.log(`[Posição] ${username} salva no GitHub: ${pos}`);
                }
                return;
            }

            // REPASSE MULTIPLAYER
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});

