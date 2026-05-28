const { MongoClient } = require('mongodb');

// Link oficial simplificado com travas de segurança para o Render não se perder
const uri = "mongodb+srv://redutorpnovo:rp123456@clusterreduto.v8k3m.mongodb.net/reduto_data?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
    connectTimeoutMS: 10000, // Espera até 10 segundos para conectar sem derrubar o servidor
    socketTimeoutMS: 45000,
});

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando ao banco de dados...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO! Sistema pronto.");
    } catch (e) {
        // Se der erro, avisa no log, mas NÃO derruba o servidor!
        console.error("[Nuvem MongoDB Erro] Não foi possível conectar agora, operando em modo de espera:", e.message);
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
