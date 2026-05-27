const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let db;
let contas;

async function conectar() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        contas = db.collection("usuarios_permanentes");
        console.log("[Nuvem] Conexão estabelecida com sucesso!");
    } catch (e) {
        console.error("[Nuvem] Erro ao conectar:", e);
    }
}
conectar();

async function buscarUsuarioUnico(nome) {
    try {
        if (!contas) return null;
        // Busca ignorando se é maiúscula ou minúscula para evitar bugs
        return await contas.findOne({ username: { $regex: new RegExp("^" + nome + "$", "i") } });
    } catch (e) { return null; }
}

async function salvarUsuarioDireto(dados) {
    try {
        if (!contas) return;
        await contas.updateOne({ username: dados.username }, { $set: dados }, { upsert: true });
    } catch (e) {}
}

async function salvarPosicaoPlayer(nome, posicao) {
    try {
        if (!contas) return;
        await contas.updateOne({ username: nome }, { $set: { last_pos: posicao } });
    } catch (e) {}
}

module.exports = { buscarUsuarioUnico, salvarUsuarioDireto, salvarPosicaoPlayer };
