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
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// Carrega a lista do usuarios.json pegando o SHA mais atualizado
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

// Salva a lista de contas de cima para baixo
async function salvarListaUsuarios(lista) {
    try {
        // Pega o SHA mais recente direto do GitHub antes de salvar para não dar erro de conflito
        let shaAtual = lista._sha;
        try {
            const check = await requisicaoGitHub('GET', 'usuarios.json');
            shaAtual = check.sha;
        } catch(e){}

        const dadosSalvar = { ...lista };
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { message: "Sincronizando usuarios.json", content: conteudo };
        if (shaAtual) corpo.sha = shaAtual;

        const res = await requisicaoGitHub('PUT', 'usuarios.json', corpo);
        console.log("[Banco] Lista usuarios.json atualizada no GitHub!");
        return res.content.sha;
    } catch (e) {
        console.error("[Banco Erro] Falha ao salvar no usuarios.json:", e.message);
        return null;
    }
}

// Salva a localização na pasta física do player (players/Nome/dados.json)
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
        console.log(`[Banco] Localização de ${nome} salva na pasta física!`);
    } catch (e) {
        console.error(`[Banco Erro] Erro ao criar/atualizar pasta de ${nome}:`, e.message);
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
