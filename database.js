// === REDUTO RP - SISTEMA DE PASTAS POR PLAYER (database.js) ===
const https = require('https');

const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-";
const GITHUB_TOKEN = "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"; 

// Função mestre para conversar com o GitHub
function requisicaoGitHub(metodo, caminho, dadosEnviar = null) {
    return new Promise((resolve, reject) => {
        const opcoes = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/contents/${caminho}`,
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
                    reject(new Error(res.statusCode));
                }
            });
        });

        req.on('error', (erro) => reject(erro));
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// 1. Carregar dados de um player específico
async function carregarDadosPlayer(nomePlayer) {
    try {
        const caminho = `players/${nomePlayer}/dados.json`;
        const resultado = await requisicaoGitHub('GET', caminho);
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        const dados = JSON.parse(textoJson);
        dados._sha = resultado.sha; // Guarda o código de segurança do arquivo
        return dados;
    } catch (erro) {
        return null; // Retorna null se o player não existir
    }
}

// 2. Salvar ou Criar pasta e dados do player
async function salvarDadosPlayer(nomePlayer, dados) {
    try {
        const caminho = `players/${nomePlayer}/dados.json`;
        
        // Tenta pegar o SHA se o arquivo já existir para poder atualizar
        let shaExistente = dados._sha || null;
        if (!shaExistente) {
            try {
                const info = await requisicaoGitHub('GET', caminho);
                shaExistente = info.sha;
            } catch (e) { shaExistente = null; }
        }

        const dadosParaSalvar = { ...dados };
        delete dadosParaSalvar._sha; // Remove o SHA dos dados internos

        const textoJson = JSON.stringify(dadosParaSalvar, null, 2);
        const conteudoBase64 = Buffer.from(textoJson).toString('base64');

        const corpoRequisicao = {
            message: `Reduto RP: Atualizando dados de ${nomePlayer}`,
            content: conteudoBase64
        };

        if (shaExistente) corpoRequisicao.sha = shaExistente;

        await requisicaoGitHub('PUT', caminho, corpoRequisicao);
        console.log(`[GitHub] Pasta e dados de ${nomePlayer} sincronizados!`);
    } catch (erro) {
        console.error(`[Erro] Falha ao salvar pasta de ${nomePlayer}:`, erro.message);
    }
}

module.exports = { carregarDadosPlayer, salvarDadosPlayer };
