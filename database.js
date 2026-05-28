const { MongoClient } = require('mongodb');

// Rota direta e atualizada para a nova nuvem estável do Reduto RP
const uri = "mongodb://redutorp:rp123@cluster0-shard-00-00.v8k3m.mongodb.net:27017,cluster0-shard-00-01.v8k3m.mongodb.net:27017,cluster0-shard-00-02.v8k3m.mongodb.net:27017/reduto_rp?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);
let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando ao novo banco de dados seguro do Reduto RP...");
        await client.connect();
        db = client.db("reduto_rp");
        colecao = db.collection("servidor_dados");
        console.log("[Nuvem] CONECTADO COM SUCESSO! Sistema online.");
    } catch (e) {
        console.error("[Nuvem Erro] Falha na conexão direta:", e.message);
    }
}
conectar();

async function carregarTodosOsUsuarios() {
    try {
        if (!colecao) return {};
        const documento = await colecao.findOne({ tipo: "backup_contas" });
        if (documento && documento.dados) {
            return documento.dados;
        }
        return {};
    } catch (e) {
        return {};
    }
}

async function salvarListaCompleta(lista) {
    try {
        if (!colecao) return;
        await colecao.updateOne(
            { tipo: "backup_contas" },
            { $set: { tipo: "backup_contas", dados: lista } },
            { upsert: true }
        );
    } catch (e) {
        console.error("[Nuvem Erro] Falha ao sincronizar dados na nuvem.");
    }
}

module.exports = { carregarTodosOsUsuarios, salvarListaCompleta };
