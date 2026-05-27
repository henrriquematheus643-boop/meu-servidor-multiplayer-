const { MongoClient } = require('mongodb');

// Banco de dados na nuvem configurado para o Reduto RP
const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db, contas, posicoes;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        contas = db.collection("contas");
        posicoes = db.collection("posicoes");
        console.log("[Jarvis Banco] Conectado ao banco de dados em nuvem com sucesso!");
    } catch (e) {
        console.error("[Jarvis Banco Erro] Falha ao conectar:", e.message);
    }
}
conectarBanco();

// Carrega todas as contas cadastradas para o login instantâneo
async function carregarListaUsuarios() {
    try {
        if (!contas) return {};
        const lista = await contas.find({}).toArray();
        let resultado = {};
        lista.forEach(user => {
            resultado[user.nome] = { nome: user.nome, senha: user.senha, id: user.id };
        });
        return resultado;
    } catch (e) {
        return {};
    }
}

// Salva e altera os dados da conta de cima para baixo
async function salvarListaUsuarios(lista) {
    try {
        const nomes = Object.keys(lista);
        const ultimoNome = nomes[nomes.length - 1];
        const usuario = lista[ultimoNome];

        if (!usuario) return true;

        await contas.updateOne(
            { nome: ultimoNome },
            { $set: { nome: usuario.nome, senha: usuario.senha, id: usuario.id } },
            { upsert: true }
        );
        return true;
    } catch (e) {
        console.error("[Jarvis Banco Erro] Erro ao salvar usuário:", e.message);
        return null;
    }
}

// Salva e altera a localização do jogador dinamicamente
async function salvarPosicaoPlayer(nome, posicao) {
    try {
        if (!posicoes) return;
        await posicoes.updateOne(
            { nome: nome },
            { $set: { nome: nome, posicao: posicao } },
            { upsert: true }
        );
    } catch (e) {
        console.error("[Jarvis Banco Erro] Erro ao alterar posicao de " + nome);
    }
}

module.exports = { carregarListaUsuarios, salvarListaUsuarios, salvarPosicaoPlayer };
