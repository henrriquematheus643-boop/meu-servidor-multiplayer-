const { MongoClient } = require('mongodb');

// ROTA COM IPS NUMÉRICOS REAIS: Pula 100% o sistema de nomes do Render
// Conecta direto nas portas certas da sua nova nuvem sem usar o mongodb+srv
const uri = "mongodb://redutorpnovo:rp123456@18.230.74.205:27017,54.94.133.52:27017,54.233.170.218:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri, {
    useUnifiedTopology: true,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000
});

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando via IPs numéricos diretos (Burlou o Render)...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] ✅ CONECTADO COM SUCESSO! A nuvem está ativa e travada.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha crítica na rota de IPs:", e.message);
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
