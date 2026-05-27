const https = require('https');

// --- CONFIGURAÇÕES DO REPOSITÓRIO ---
// Verifique se o nome do seu repositório termina com o traço "-" no GitHub. Se não terminar, apague o traço da linha abaixo!
const GITHUB_REPO = "henrriquematheus643-boop/meu-servidor-multiplayer";
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

async function carregarListaUsuarios() {
    try {
        const resultado = await requisicaoGitHub('GET', 'usuarios.json');
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        const dados = JSON.parse(textoJson);
        dados._sha = resultado.sha; 
        return dados;
    } catch (e) {
        return { _sha: null }; 
    }
}

async function salvarListaUsuarios(lista) {
    try {
        let shaAtual = lista._sha;
        try {6
            const check = await requisicaoGitHub('GET', 'usuarios.json');
            shaAtual = check.sha;
        } catch(e){}

        const dadosSalvar = { ...lista };
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { message: "Sincronizando usuarios.json", content: conteudo };
        if (shaAtual) corpo.sha = shaAtual;

        const res = await requisicaoGitHub('PUT', 'usuarios.json', corpo);
        return res.content.sha;
    } catch (e) {
        console.error("[Erro] Falha ao salvar no usuarios.json");
        return null;
    }
}

async function salvarPosicaoPlayer(nome, posicao) {
    try {
        const caminho = `players/${nome}/dados.json`;
        let shaExistente = null;

        try {
            const info = await requisicaoGitHub('GET', caminho);
            shaExistente = info.sha;
        } catch (e) {}

        const dadosPosicao = { nome: nome, posicao: posicao };
        const conteudo = Buffer.from(JSON.stringify(dadosPosicao, null, 2)).toString('base64');
        const corpo = { message: `Localizacao de ${nome}`, content: conteudo };
        if (shaExistente) corpo.sha = shaExistente;

        await requisicaoGitHub('PUT', caminho, corpo);
    } catch (e) {
        console.error(`[Erro] Falha ao criar pasta de posicao para ${nome}`);
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
