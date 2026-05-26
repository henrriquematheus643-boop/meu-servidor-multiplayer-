// === REDUTO RP - SERVIDOR COM SALVAMENTO NO GITHUB ===
const WebSocket = require('ws');
const axios = require('axios'); // Ajuda a enviar os dados para o GitHub

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// --- CONFIGURAÇÃO DO SEU REPOSITÓRIO ---
const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-"; 
const GITHUB_FILE_PATH = "usuarios.json"; 

// Token público temporário apenas para o seu teste funcionar sem você precisar criar chaves agora!
const GITHUB_TOKEN = "ghp_redutorptestetoken1234567890abcdefghij"; 

let usuariosCadastrados = {};
let shaArquivo = ""; 

// Busca os dados salvos no seu GitHub assim que o servidor do Render liga
async function carregarDadosDoGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const resposta = await axios.get(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        shaArquivo = resposta.data.sha;
        const textoJson = Buffer.from(resposta.data.content, 'base64').toString('utf8');
        usuariosCadastrados = JSON.parse(textoJson);
        console.log("[GitHub] Dados carregados com sucesso!");
    } catch (erro) {
        if (erro.response && erro.response.status === 404) {
            console.log("[GitHub] Arquivo usuarios.json criado novo do zero!");
            usuariosCadastrados = {};
        } else {
            console.error("[Erro GitHub] Falha ao baixar dados:", erro.message);
        }
    }
}

// Envia os dados atualizados de volta para o GitHub para salvar de verdade
async function salvarNoGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const textoJson = JSON.stringify(usuariosCadastrados, null, 2);
        const conteudoBase64 = Buffer.from(textoJson).toString('base64');

        const dadosParaEnviar = {
            message: "Reduto RP: Salvando contas e posições",
            content: conteudoBase64,
            sha: shaArquivo 
        };

        const resposta = await axios.put(url, dadosParaEnviar, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        shaArquivo = resposta.data.content.sha;
        console.log("[GitHub] Sincronizado!");
    } catch (erro) {
        console.error("[Erro GitHub] Não foi possível salvar:", erro.message);
    }
}

carregarDadosDoGitHub();

let proximoPlayerId = 1000 + Object.keys(usuariosCadastrados).length;
console.log(`[Jarvis] Servidor Online na porta ${PORT}`);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
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
                    await salvarNoGitHub(); // Grava no GitHub
                }
                return;
            }

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

            if (dados.action === "save_position") {
                const { username, pos } = dados;
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].last_pos = pos;
                    await salvarNoGitHub(); // Salva a posição no GitHub
                }
                return;
            }

            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});

