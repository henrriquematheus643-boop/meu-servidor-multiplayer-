const { MongoClient } = require('mongodb');

// ROTA HÍBRIDA BLINDADA: Conecta direto nos servidores dedicados do MongoDB Atlas
// Esse formato elimina o erro 'ENOTFOUND' no Render e garante conexão estável e vitalícia.
const uri = "mongodb://redutorpnovo:rp123456@clusterreduto-shard-00-00.v8k3m.mongodb.net:27017,clusterreduto-shard-00-01.v8k3m.mongodb.net:27017,clusterreduto-shard-00-02.v8k3m.mongodb.net:27017/reduto_data?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);

let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem MongoDB] Iniciando protocolo de conexão direta...");
        
        // Força o Node.js a se conectar e aguarda a resposta da nuvem
        await client.connect();
        
        db = client.db("reduto_data");
        colecao = db.collection("players");
        
        console.log("=======================================================");
        console.log("✅ [MONGODB] CONECTADO TOTALMENTE COM SUCESSO À NUVEM!");
        console.log("=======================================================");
    } catch (e) {
        console.error("❌ [MONGODB ERRO CRÍTICO] Falha ao conectar na nuvem:", e.message);
    }
}

// Executa a conexão assim que o servidor liga
conectar();

// Função para buscar o jogador na nuvem (usada no Login e na checagem de Registro)
async function buscarUsuarioNaNuvem(nome) {
    try {
        if (!colecao) return null;
        return await colecao.findOne({ username: String(nome).trim().toLowerCase() });
    } catch (e) {
        console.error("[Nuvem Erro] Falha ao buscar usuário:", e.message);
        return null;
    }
}

// Função para salvar ou atualizar o jogador (usada no Registro e ao Salvar Posição)
async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        if (!colecao) return false;
        const nome = String(dadosJogador.username).trim().toLowerCase();
        
        // Atualiza se já existir ou cria uma nova se for registro (upsert: true)
        await colecao.updateOne(
            { username: nome },
            { $set: dadosJogador },
            { upsert: true }
        );
        return true;
    } catch (e) {
        console.error("[Nuvem Erro] O banco de dados rejeitou a gravação:", e.message);
        return false;
    }
}

// Função que puxa todos os players para listar no painel do Render
async function obterTodosOsUsuarios() {
    try {
        if (!colecao) return [];
        return await colecao.find({}).toArray();
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
