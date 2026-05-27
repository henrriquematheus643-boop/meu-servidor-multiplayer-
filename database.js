const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let contas;

async function conectar() {
    try {
        await client.connect();
        const db = client.db("reduto_rp");
        contas = db.collection("usuarios_permanentes");
        console.log("Nuvem conectada!");
    } catch (e) { console.log("Erro nuvem:", e); }
}
conectar();

async function buscarUsuarioUnico(nome) {
    if (!contas) return null;
    return await contas.findOne({ username: nome });
}

async function salvarUsuarioDireto(dados) {
    if (!contas) return;
    await contas.updateOne({ username: dados.username }, { $set: dados }, { upsert: true });
}

async function salvarPosicaoPlayer(nome, posicao) {
    if (!contas) return;
    await contas.updateOne({ username: nome }, { $set: { last_pos: posicao } });
}

module.exports = { buscarUsuarioUnico, salvarUsuarioDireto, salvarPosicaoPlayer };
