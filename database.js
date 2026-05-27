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

// Carrega a lista geral de usuários do arquivo usuarios.json
async function carregarListaUsuarios() {
    try {
        const resultado = await requisicaoGitHub('GET', 'usuarios.json');
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        const dados = JSON.parse(textoJson);
        dados._sha = resultado.sha; // Guarda o SHA para atualizar depois
        return dados;
    } catch (e) {
        return { _sha: null }; // Se não existir, começa do zero
    }
}

// Salva a lista geral de usuários no usuarios.json (Nome, Senha e ID)
async function salvarListaUsuarios(lista) {
    try {
        const dadosSalvar = { ...lista };
        const sha = dadosSalvar._sha;
        delete dadosSalvar._sha;

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { message: "Update lista usuarios.json", content: conteudo };
        if (sha) corpo.sha = sha;

        const res = await requisicaoGitHub('PUT', 'usuarios.json', corpo);
        return res.content.sha;
    } catch (e) {
        console.error("[Erro] Não foi possível salvar no usuarios.json");
        return null;
    }
}

// Salva APENAS a posição do player na pasta física dele
async function salvarPosicaoPlayer(nome, posicao) {
    try {
        const caminho = `players/${nome}/dados.json`;
        let shaExistente = null;

        // Tenta pegar o SHA do arquivo de posição se ele já existir
        try {
            const info = await requisicaoGitHub('GET', caminho);
            shaExistente = info.sha;
        } catch (e) {}

        const dadosPosicao = { nome: nome, posicao: posicao };
        const conteudo = Buffer.from(JSON.stringify(dadosPosicao, null, 2)).toString('base64');
        const corpo = { message: `Update posicao de ${nome}`, content: conteudo };
        if (shaExistente) corpo.sha = shaExistente;

        await requisicaoGitHub('PUT', caminho, corpo);
    } catch (e) {
        console.error(`[Erro] Falha ao salvar pasta física de posição para ${nome}`);
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
