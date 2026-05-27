const https = require('https');

const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer-";
const GITHUB_TOKEN = "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"; 

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
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(corpo));
                else reject(new Error(res.statusCode));
            });
        });
        req.on('error', (e) => reject(e));
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// Essa função varre o GitHub para achar as pastas físicas
async function carregarTodosOsPlayers() {
    try {
        const lista = await requisicaoGitHub('GET', 'players');
        let todosDados = {};
        if (Array.isArray(lista)) {
            for (let item of lista) {
                if (item.type === 'dir') { // Se for uma pasta
                    try {
                        const det = await requisicaoGitHub('GET', `players/${item.name}/dados.json`);
                        const texto = Buffer.from(det.content, 'base64').toString('utf8');
                        todosDados[item.name] = JSON.parse(texto);
                        todosDados[item.name]._sha = det.sha;
                    } catch (e) {}
                }
            }
        }
        return todosDados;
    } catch (e) {
        return {}; 
    }
}

async function salvarNoGitHub(nome, dados) {
    try {
        // O segredo está aqui: o caminho cria as pastas fisicamente
        const caminho = `players/${nome}/dados.json`;
        const dadosSalvar = { ...dados };
        const sha = dadosSalvar._sha;
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { 
            message: `Criando/Atualizando pasta do jogador: ${nome}`, 
            content: conteudo 
        };
        
        if (sha) corpo.sha = sha;

        const res = await requisicaoGitHub('PUT', caminho, corpo);
        return res.content.sha;
    } catch (e) {
        console.error(`Erro ao criar pasta física de ${nome}`);
        return null;
    }
}

module.exports = { carregarTodosOsPlayers, salvarNoGitHub };
