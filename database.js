const { MongoClient } = require('mongodb');

// Rota direta limpa e sem opções obsoletas
const uri = "mongodb://redutorpnovo:rp123456@clusterreduto-shard-00-00.v8k3m.mongodb.net:27017,clusterreduto-shard-00-01.v8k3m.mongodb.net:27017,clusterreduto-shard-00-02.v8k3m.mongodb.net:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando via ROTA DIRETA...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! Sistema totalmente online.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha crítica na nuvem:", e.message);
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    try {
        if (!colecao) return null;
        return await colecao.findOne({ username: String(nome).trim().toLowerCase() });
    } catch (e) {
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) return false;
        const nome = String(dadosJogador.username).trim().toLowerCase();
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        return true;
    } catch (e) {
        return false;
    }
}

async function obterTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
