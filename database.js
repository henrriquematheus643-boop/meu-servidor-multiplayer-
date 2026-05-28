const { MongoClient, ServerApiVersion } = require('mongodb');

// Link oficial SRM (mongodb+srv) com as configurações de segurança exigidas pelo seu novo banco
const uri = "mongodb+srv://redutorpnovo:rp123456@clusterreduto.v8k3m.mongodb.net/?retryWrites=true&w=majority&appName=ClusterReduto";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Força o driver a insistir na conexão se o Render oscilar
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000
});

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Conectando ao cluster seguro...");
        await client.connect();
        
        // Define o banco de dados e a tabela correta
        db = client.db("reduto_data");
        colecao = db.collection("players");
        
        console.log("[Nuvem MongoDB] ✅ CONECTADO COM SUCESSO! Banco de dados pronto para gravar.");
    } catch (e) {
        console.error("[Nuvem MongoDB Erro] Falha na conexão de segurança:", e.message);
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
        if (!colecao) return false;
        const nome = String(dadosJogador.username).trim().toLowerCase();
        
        // Força o salvamento e espera a confirmação da nuvem
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        return true;
    } catch (e) {
        console.error("[Nuvem Erro] O banco rejeitou a gravação:", e.message);
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
