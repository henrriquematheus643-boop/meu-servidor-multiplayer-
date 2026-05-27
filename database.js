const https = require('https');

// --- CONFIGURAÇÕES DO REPOSITÓRIO ---
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
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(corpo));
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${corpo}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// Carrega os usuarios do arquivo usuarios.json
async function carregarListaUsuarios() {
    try {
        const resultado = await requisicaoGitHub('GET', 'usuarios.json');
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        const dados = JSON.parse(textoJson);
        dados._sha = resultado.sha; 
        return dados;
    } catch (e) {
        console.log("[Banco] Criando estrutura inicial vazia...");
        return { _sha: null }; 
    }
}

// Salva a lista geral no usuarios.json
async function salvarListaUsuarios(lista) {
    try {
        const dadosSalvar = { ...lista };
        const sha = dadosSalvar._sha;
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { message: "Sincronizando lista", content: conteudo };
        if (sha) corpo.sha = sha;

        const res = await requisicaoGitHub('PUT', 'usuarios.json', corpo);
        return res.content.sha;
    } catch (e) {
        console.error("[Banco Erro] Erro ao salvar no usuarios.json");
        return null;
    }
}

// Salva a posicao na pasta do player
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
        const corpo = { message: `Pasta de ${nome}`, content: conteudo };
        if (shaExistente) corpo.sha = shaExistente;

        await requisicaoGitHub('PUT', caminho, corpo);
    } catch (e) {
        console.error("[Banco Erro] Erro ao criar pasta do player");
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
