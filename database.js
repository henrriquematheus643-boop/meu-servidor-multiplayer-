const { MongoClient } = require('mongodb');

// Alterado o protocolo para 'mongodb://' com os nós diretos para blindar contra o ENOTFOUND do Render
const uri = "mongodb://redutorpnovo:rp123456@clusterreduto-shard-00-00.v8k3m.mongodb.net:27017,clusterreduto-shard-00-01.v8k3m.mongodb.net:27017,clusterreduto-shard-00-02.v8k3m.mongodb.net:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);
let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando ao banco de dados seguro...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! Sistema pronto para receber jogadores.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha na conexão de segurança:", e.message);
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    try {
        if (!colecao) return null;
        return await colecao.findOne({ username: String(nome).trim() });
    } catch (e) {
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) return;
        const nome = String(dadosJogador.username).trim();
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        console.log(`[Nuvem MongoDB] Dados de ${nome} salvos.`);
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Erro ao gravar dados:", e.message);
    }
}

async function obtenerTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obtenerTodosOsUsuarios };
