const { MongoClient } = require('mongodb');

// Link permanente do MongoDB do Reduto RP
const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let db, colecao;

async function conectar() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        colecao = db.collection("servidor_dados");
        console.log("[MongoDB Nuvem] Banco de dados conectado com sucesso!");
    } catch (e) {
        console.error("[MongoDB Nuvem Erro] Falha na conexão:", e.message);
    }
}
conectar();

// Puxa todas as contas salvas para entregar ao servidor quando ele ligar
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

// Salva e atualiza a lista inteira de forma sólida
async function salvarListaCompleta(lista) {
    try {
        if (!colecao) return;
        await colecao.updateOne(
            { tipo: "backup_contas" },
            { $set: { tipo: "backup_contas", dados: lista } },
            { upsert: true }
        );
    } catch (e) {
        console.error("[MongoDB Nuvem Erro] Erro ao sincronizar dados.");
    }
}

module.exports = { carregarTodosOsUsuarios, salvarListaCompleta };
