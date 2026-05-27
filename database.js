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

async function carregarTodosOsPlayers() {
    try {
        const lista = await requisicaoGitHub('GET', 'players');
        let todosDados = {};
        // Se a lista for um array, significa que a pasta existe
        if (Array.isArray(lista)) {
            for (let item of lista) {
                try {
                    const det = await requisicaoGitHub('GET', `players/${item.name}/dados.json`);
                    const texto = Buffer.from(det.content, 'base64').toString('utf8');
                    todosDados[item.name] = JSON.parse(texto);
                    todosDados[item.name]._sha = det.sha;
                } catch (e) { console.log(`Pulando ${item.name}, arquivo não encontrado.`); }
            }
        }
        return todosDados;
    } catch (e) {
        console.log("[Jarvis] Pasta 'players' ainda não existe. Será criada no primeiro registro.");
        return {}; // Retorna vazio para o servidor começar limpo
    }
}

async function salvarPlayer(nome, dados) {
    try {
        const caminho = `players/${nome}/dados.json`;
        const dadosSalvar = { ...dados };
        const sha = dadosSalvar._sha;
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { message: `Update ${nome}`, content: conteudo };
        if (sha) corpo.sha = sha;

        const res = await requisicaoGitHub('PUT', caminho, corpo);
        console.log(`[GitHub] Dados de ${nome} salvos com sucesso!`);
        return res.content.sha;
    } catch (e) {
        console.error(`[Erro GitHub] Erro ao salvar ${nome}: Status ${e.message}`);
        return null;
    }
}

module.exports = { carregarTodosOsPlayers, salvarPlayer };
