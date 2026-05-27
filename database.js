const https = require('https');

// Configurações do seu GitHub público
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
                    reject(new Error(res.statusCode));
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (dadosEnviar) req.write(JSON.stringify(dadosEnviar));
        req.end();
    });
}

// Carrega as contas direto do arquivo do GitHub
async function carregarListaUsuarios() {
    try {
        const resultado = await requisicaoGitHub('GET', 'usuarios.json');
        const textoJson = Buffer.from(resultado.content, 'base64').toString('utf8');
        const dados = JSON.parse(textoJson);
        dados._sha = resultado.sha; // Guarda a chave de segurança do arquivo
        return dados;
    } catch (e) {
        // Se o arquivo não existir ainda, cria um do zero limpo
        return { _sha: null }; 
    }
}

// Salva a lista atualizada direto no GitHub de cima para baixo
async function salvarListaUsuarios(lista) {
    try {
        let shaAtual = lista._sha;
        try {
            const check = await requisicaoGitHub('GET', 'usuarios.json');
            shaAtual = check.sha;
        } catch(e){}

        const dadosSalvar = { ...lista };
        delete dadosSalvar._sha; // Remove a chave temporária antes de salvar

        const conteudo = Buffer.from(JSON.stringify(dadosSalvar, null, 2)).toString('base64');
        const corpo = { 
            message: "Sincronizando contas do Reduto RP", 
            content: conteudo 
        };
        
        if (shaAtual) corpo.sha = shaAtual;

        const res = await requisicaoGitHub('PUT', 'usuarios.json', corpo);
        return true;
    } catch (e) {
        console.error("[Erro GitHub] Falha ao salvar arquivo de contas.");
        return null;
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios };
