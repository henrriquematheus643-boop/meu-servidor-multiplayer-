const { MongoClient } = require('mongodb');

// URI oficial configurada para o seu novo Cluster do Reduto RP
const uri = "mongodb+srv://redutorpnovo:rp123456@clusterreduto.v8k3m.mongodb.net/reduto_data?retryWrites=true&w=majority";

const client = new MongoClient(uri);
let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando ao cluster...");
        await client.connect();
        db = client.db("reduto_data");
        colecao = db.collection("players");
        console.log("[Nuvem MongoDB] CONECTADO COM SUCESSO!");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha ao conectar:", e.message);
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
        
        // O await aqui garante que o Node espere o MongoDB salvar de verdade
        const resultado = await colecao.updateOne(
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

async function obtenerTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obtenerTodosOsUsuarios };
