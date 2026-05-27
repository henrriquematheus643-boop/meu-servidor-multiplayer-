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

// Busca TODAS as contas do banco e organiza em um objeto para o servidor ler fácil
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

// Salva UM único usuário por vez de forma organizada e segura
async function salvarNovoUsuario(nome, senha, id) {
    try {
        if (!contas) return null;
        // O upsert garante que ele salve na vaga certa do player
        const res = await contas.updateOne(
            { nome: nome },
            { $set: { nome: nome, senha: senha, id: id } },
            { upsert: true }
        );
        return true;
    } catch (e) {
        console.error("[Jarvis Banco Erro] Erro ao salvar usuario:", e.message);
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

module.exports = { carregarListaUsuarios, salvarNovoUsuario, salvarPosicaoPlayer };
