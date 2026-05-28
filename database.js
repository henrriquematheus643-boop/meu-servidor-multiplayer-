const { MongoClient } = require('mongodb');

// Link da NOVA nuvem estável e configurada que criei para o Reduto RP
const uri = "mongodb+srv://redutorpnovo:rp123456@clusterreduto.v8k3m.mongodb.net/reduto_data?retryWrites=true&w=majority";

const client = new MongoClient(uri);
let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando ao novo cluster de segurança...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! A nuvem está ativa e vitalícia.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha crítica de conexão:", e.message);
    }
}
conectar();

// Busca o jogador na nova nuvem pelo nome
async function buscarUsuarioNaNuvem(nome) {
    try {
        if (!colecao) return null;
        return await colecao.findOne({ username: String(nome).trim() });
    } catch (e) {
        return null;
    }
}

// Grava ou atualiza o jogador de forma isolada na nuvem (Não apaga nunca)
async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) return;
        const nome = String(dadosJogador.username).trim();
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        console.log(`[Nuvem MongoDB] Posição e dados de ${nome} cravados na nuvem!`);
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Erro ao gravar dados:", e.message);
    }
}

// Puxa a lista completa para o painel do Render ler
async function obterTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
