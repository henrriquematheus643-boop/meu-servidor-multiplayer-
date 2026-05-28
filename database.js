const axios = require('axios');

// 🌐 NUVEM ULTRA RÁPIDA (KVBin) - Sem Firewall, sem bloqueios e ativa na hora!
const BUCKET_ID = "redutorp_matheus_db";
let dadosLocais = {};
let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando ao servidor seguro da KVBin...");
        
        // Tenta puxar os dados dos jogadores salvos
        const resposta = await axios.get(`https://kvbin.com/api/v1/storage/${BUCKET_ID}`);
        
        if (resposta.data) {
            dadosLocais = resposta.data.players || {};
        }
        conectadoA_Nuvem = true;
        console.log("=======================================================");
        console.log("✅ [NUVEM KV] CONECTADO COM SUCESSO! STATUS: 100% ONLINE!");
        console.log("=======================================================");
    } catch (e) {
        // Se a gaveta estiver vazia porque é a primeira vez, ele considera online e cria os dados
        if (e.response && (e.response.status === 404 || e.response.status === 422)) {
            dadosLocais = {};
            conectadoA_Nuvem = true;
            console.log("=======================================================");
            console.log("✅ [NUVEM KV] BANCO INICIALIZADO COM SUCESSO! ONLINE!");
            console.log("=======================================================");
        } else {
            console.log("=======================================================");
            console.log("❌ [Nuvem Erro] Falha ao acessar KVBin:", e.message);
            console.log("=======================================================");
            conectadoA_Nuvem = false;
        }
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
            // Salva e atualiza na nuvem instantaneamente
            await axios.post(`https://kvbin.com/api/v1/storage/${BUCKET_ID}`, { players: dadosLocais });
            console.log(`☁️ [Nuvem] Dados salvos para o jogador: ${username}`);
            return true;
        } catch (e) {
            console.log("❌ [Nuvem Erro] Erro ao sincronizar:", e.message);
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
