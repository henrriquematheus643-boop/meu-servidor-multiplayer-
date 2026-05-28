const { MongoClient } = require('mongodb');

// Convertido para a Rota de IPs Diretos (Standard Connection String)
// Isso pula o resolvedor de DNS do Render e impede o erro ENOTFOUND
const uri = "mongodb://redutorpnovo:rp123456@clusterreduto-shard-00-00.v8k3m.mongodb.net:27017,clusterreduto-shard-00-01.v8k3m.mongodb.net:27017,clusterreduto-shard-00-02.v8k3m.mongodb.net:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Tentando conexão via rota de IPs diretos...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! A rota direta funcionou.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha crítica na rota direta:", e.message);
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

// Grava ou atualiza os dados do jogador de forma isolada na nuvem
async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) return;
        const nome = String(dadosJogador.username).trim();
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        console.log(`[Nuvem MongoDB] Dados de ${nome} sincronizados com sucesso.`);
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Erro ao gravar dados:", e.message);
    }
}

// Puxa a lista completa para o painel do Render ler
async function obtenerTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
