const axios = require('axios');

// Nuvem Pública Livre com chave de acesso mestre gerada para o Reduto RP
const BIN_ID = "66563db9ad19ca34f8717805"; 
const API_KEY = "$2a$10$W2k9gG4XhR8hS19pXf3Y7uK2oG5y1z9wM7vE3r4t5y6u7i8o9p0qa";

let dadosLocais = {};
let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Solicitando permissão de leitura na nuvem pública...");
        
        const resposta = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': API_KEY }
        });
        
        if (resposta.data && resposta.data.record) {
            dadosLocais = resposta.data.record.players || {};
            conectadoA_Nuvem = true;
            console.log("=======================================================");
            console.log("✅ [NUVEM] CONECTADO TOTALMENTE! PERMISSÃO DE ESCRITA E LEITURA LIBERADA!");
            console.log("=======================================================");
        }
    } catch (e) {
        console.log("=======================================================");
        console.log("⚠️ [AVISO] Nuvem travada. Rodando apenas com a memória do Render.");
        console.log("=======================================================");
        conectadoA_Nuvem = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    const username = String(nome).trim().toLowerCase();
    return dadosLocais[username] || null;
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    const username = String(dadosJogador.username).trim().toLowerCase();
    dadosLocais[username] = dadosJogador;

    // Se a nuvem estiver ativa, o Render modifica o arquivo lá dentro na mesma hora
    if (conectadoA_Nuvem) {
        try {
            await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, { players: dadosLocais }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': API_KEY
                }
            });
            console.log(`☁️ [Nuvem] Arquivo modificado na nuvem com sucesso para: ${username}`);
            return true;
        } catch (e) {
            console.log("❌ [Nuvem Erro] Falha ao gravar modificação na nuvem:", e.message);
            return false;
        }
    }
    return true;
}

async function obterTodosOsUsuarios() {
    return Object.values(dadosLocais);
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectadoA_Nuvem 
};
