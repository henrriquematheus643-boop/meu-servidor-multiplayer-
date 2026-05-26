// === REDUTO RP - SISTEMA DE ARMAZENAMENTO NO GITHUB (database.js) ===
const https = require('https');

// --- CONFIGURAÇÕES DO REPOSITÓRIO ---
const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-";
const GITHUB_FILE_PATH = "usuarios.json"; // Arquivo onde as contas e posições serão escritas

// COLOQUE SEU TOKEN AQUI: Lembre-se de gerar o Token (classic) com permissão 'repo' e colar aqui
const GITHUB_TOKEN = "COLE_AQUI_O_SEU_TOKEN_DO_GITHUB"; 

let usuariosCadastrados = {};
let shaArquivo = "";

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
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// Baixa os dados do GitHub
async function carregarDados() {
    try {
        console.log("[Banco] Conectando ao GitHub para buscar registros...");
        const resultado = await requisicaoGitHub('GET');
        shaArquivo = resultado.sha;
        
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        usuariosCadastrados = JSON.parse(textoJson);
        console.log("[Banco] Sucesso! Contas e posições carregadas.");
        return usuariosCadastrados;
    } catch (erro) {
        if (erro.message.includes('404')) {
            console.log("[Banco] Arquivo usuarios.json não existe no GitHub. Criando um novo...");
            usuariosCadastrados = {};
            return usuariosCadastrados;
        } else {
            console.error("[Banco Error] Token incorreto ou inválido:", erro.message);
            return {};
        }
    }
}

// Envia os dados de volta para o GitHub
async function salvarDados(novosDados) {
    try {
        usuariosCadastrados = novosDados;
        const textoJson = JSON.stringify(usuariosCadastrados, null, 2);
        const conteudoBase64 = Buffer.from(textoJson).toString('base64');

        const dadosParaEnviar = {
            message: "Reduto RP: Sincronizando contas e posições",
            content: conteudoBase64,
            sha: shaArquivo
        };

        const resultado = await requisicaoGitHub('PUT', dadosParaEnviar);
        shaArquivo = resultado.content.sha;
        console.log("[Banco] Sincronizado com o GitHub com sucesso!");
    } catch (erro) {
        console.error("[Banco Error] Erro ao enviar dados para o GitHub:", erro.message);
    }
}

// Exporta as funções para o server.js conseguir usar
module.exports = { carregarDados, salvarDados };

