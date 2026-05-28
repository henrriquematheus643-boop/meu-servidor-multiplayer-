const { MongoClient } = require('mongodb');

// Rota direta e estável do Reduto RP
const uri = "mongodb://redutorp:rp123@cluster0-shard-00-00.v8k3m.mongodb.net:27017,cluster0-shard-00-01.v8k3m.mongodb.net:27017,cluster0-shard-00-02.v8k3m.mongodb.net:27017/reduto_rp?ssl=true&replicaSet=atlas-v8k3m-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);
let db = null;
let colecao = null;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando ao banco de dados seguro do Reduto RP...");
        await client.connect();
        db = client.db("reduto_rp");
        
        // MUDADO AQUI: Aponta exatamente para a pasta onde os dados de ontem foram gravados!
        colecao = db.collection("usuarios_permanentes");
        
        console.log("[Nuvem] CONECTADO COM SUCESSO! Pasta de contas sincronizada.");
    } catch (e) {
        console.error("[Nuvem Erro] Falha na conexão direta:", e.message);
    }
}
conectar();

async function carregarTodosOsUsuarios() {
    try {
        if (!colecao) return {};
        // Busca o documento de backup geral na pasta certa
        const documento = await colecao.findOne({ tipo: "backup_contas" });
        if (documento && documento.dados) {
            console.log("[Nuvem] Backup de contas encontrado e enviado para o Render!");
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
        // Salva e atualiza o arquivo geral na pasta certa sem remover nada
        await colecao.updateOne(
            { tipo: "backup_contas" },
            { $set: { tipo: "backup_contas", dados: lista } },
            { upsert: true }
        );
        console.log("[Nuvem] Posições e contas salvas com sucesso!");
    } catch (e) {
        console.error("[Nuvem Erro] Falha ao sincronizar dados na nuvem.");
    }
}

module.exports = { carregarTodosOsUsuarios, salvarListaCompleta };
