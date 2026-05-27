const { MongoClient } = require('mongodb');

// Endereço oficial da nuvem do Reduto RP
const uri = "mongodb+srv://redutorp:rp123@cluster0.v8k3m.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db = null;
let contas = null;

// Função que liga o servidor à nuvem
async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("reduto_rp");
        contas = db.collection("usuarios_permanentes");
        console.log("[Jarvis Nuvem] CONECTADO COM SUCESSO! O banco está pronto.");
    } catch (e) {
        console.error("[Jarvis Nuvem Erro] Falha crítica ao conectar na nuvem:", e.message);
    }
}
// Executa a conexão assim que o script é puxado
conectarBanco();

// Busca um usuário na nuvem de forma segura
async function buscarUsuario(nome) {
    try {
        // Se a nuvem ainda estiver conectando, espera 1 segundo e tenta de novo
        if (!contas) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!contas) return null;
        return await contas.findOne({ username: String(nome).trim() });
    } catch (e) {
        return null;
    }
}

// Salva a conta na nuvem (Formato permanente)
async function salvarUsuario(dados) {
    try {
        if (!contas) return;
        await contas.updateOne(
            { username: dados.username }, 
            { $set: dados }, 
            { upsert: true }
        );
        console.log(`[Jarvis Nuvem] Dados de ${dados.username} sincronizados na nuvem.`);
    } catch (e) {
        console.error("[Jarvis Nuvem Erro] Erro ao salvar conta:", e.message);
    }
}

// Salva e altera a localização do jogador a todo momento
async function atualizarPosicao(nome, posicao) {
    try {
        if (!contas) return;
        await contas.updateOne(
            { username: nome }, 
            { $set: { last_pos: posicao } },
            { upsert: true }
        );
    } catch (e) {}
}

module.exports = { buscarUsuario, salvarUsuario, atualizarPosicao };
