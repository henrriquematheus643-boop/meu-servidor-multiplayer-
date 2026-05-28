const { MongoClient } = require('mongodb');

// ROTA DIRETA CONVERTIDA: Substitui o 'mongodb+srv' por conexões diretas nos servidores do Atlas
// Isso mata o erro ENOTFOUND de uma vez por todas no Render!
const uri = "mongodb://redutorpnovo:rp123456@clusterreduto-shard-00-00.v8k3m.mongodb.net:27017,clusterreduto-shard-00-01.v8k3m.mongodb.net:27017,clusterreduto-shard-00-02.v8k3m.mongodb.net:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando via ROTA DIRETA DE IPs para burlar o bloqueio do Render...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! Sistema totalmente online.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha crítica na rota direta:", e.message);
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    try {
        if (!colecao) return null;
        return await colecao.findOne({ username: String(nome).trim().toLowerCase() });
    } catch (e) {
        console.error("[Nuvem Erro] Falha ao buscar usuário:", e.message);
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) throw new Error("Coleção MongoDB não inicializada");
        const nome = String(dadosJogador.username).trim().toLowerCase();
        
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        
        return true;
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha real ao gravar dados:", e.message);
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
