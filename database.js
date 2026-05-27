const { MongoClient } = require('mongodb');

// Endereço da nuvem Reduto RP
const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let db, contas;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        contas = db.collection("usuarios_permanentes");
        console.log("[Nuvem] Conectado com sucesso ao banco de dados!");
    } catch (e) {
        console.error("[Nuvem] Erro na conexão:", e.message);
    }
}
conectarBanco();

// Busca um usuário específico na nuvem pelo nome
async function buscarUsuario(nome) {
    if (!contas) return null;
    return await contas.findOne({ username: nome });
}

// Salva ou atualiza os dados do player (não apaga nada!)
async function salvarUsuario(dados) {
    if (!contas) return;
    // O upsert:true faz com que se não existir, ele cria. Se existir, ele atualiza.
    await contas.updateOne({ username: dados.username }, { $set: dados }, { upsert: true });
}

// Atualiza apenas a posição na nuvem
async function atualizarPosicao(nome, posicao) {
    if (!contas) return;
    await contas.updateOne({ username: nome }, { $set: { last_pos: posicao } });
}

module.exports = { buscarUsuario, salvarUsuario, atualizarPosicao };
