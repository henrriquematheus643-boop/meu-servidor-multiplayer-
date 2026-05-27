const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db, contas, posicoes;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        contas = db.collection("contas");
        posicoes = db.collection("posicoes");
    } catch (e) {}
}
conectarBanco();

async function carregarListaUsuarios() {
    try {
        if (!contas) return {};
        const lista = await contas.find({}).toArray();
        let resultado = {};
        lista.forEach(user => {
            resultado[user.username] = { password: user.password, id: user.id, last_pos: user.last_pos };
        });
        return resultado;
    } catch (e) { return {}; }
}

async function salvarListaUsuarios(lista) {
    try {
        const nomes = Object.keys(lista);
        const ultimoNome = nomes[nomes.length - 1];
        const usuario = lista[ultimoNome];
        if (!usuario) return true;

        await contas.updateOne(
            { username: ultimoNome },
            { $set: { username: ultimoNome, password: usuario.password, id: usuario.id, last_pos: usuario.last_pos } },
            { upsert: true }
        );
        return true;
    } catch (e) { return null; }
}

async function salvarPosicaoPlayer(nome, posicao) {
    try {
        if (!posicoes) return;
        await posicoes.updateOne(
            { username: nome },
            { $set: { username: nome, last_pos: posicao } },
            { upsert: true }
        );
    } catch (e) {}
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
