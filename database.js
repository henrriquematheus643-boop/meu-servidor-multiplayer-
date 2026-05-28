const axios = require('axios');

// 🌐 NOVA NUVEM ATUALIZADA EXCLUSIVA PARA O MATHEUS (Sem Firewall e sem Erro 404!)
const BIN_ID = "67e70ec4ad19ca34f8151f11"; 
const API_KEY = "$2a$10$W2k9gG4XhR8hS19pXf3Y7uK2oG5y1z9wM7vE3r4t5y6u7i8o9p0qa";

let dadosLocais = {};
let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando à nova rota do JSONBin...");
        
        const resposta = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': API_KEY }
        });
        
        if (resposta.data && resposta.data.record) {
            // Puxa as contas salvas na nuvem para a memória do Render
            dadosLocais = resposta.data.record.players || {};
            conectadoA_Nuvem = true;
            console.log("=======================================================");
            console.log("✅ [NUVEM] CONECTADO COM SUCESSO! STATUS: 100% ONLINE!");
            console.log("=======================================================");
        }
    } catch (e) {
        console.log("=======================================================");
        console.log("❌ [Nuvem Erro] Falha crítica ao acessar a API:", e.message);
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

    if (conectadoA_Nuvem) {
        try {
            // Salva e atualiza o arquivo lá na nuvem na mesma hora
            await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, { players: dadosLocais }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': API_KEY
                }
            });
            console.log(`☁️ [Nuvem] Dados sincronizados para o jogador: ${username}`);
            return true;
        } catch (e) {
            console.log("❌ [Nuvem Erro] Erro ao salvar dados:", e.message);
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
