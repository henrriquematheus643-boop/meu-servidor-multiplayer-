const axios = require('axios');

// 🌐 NUVEM PÚBLICA LIVRE (JSONBin) - Sem Firewall, sem bloqueios de IP ou Certificado!
const BIN_ID = "66563db9ad19ca34f8717805"; 
const API_KEY = "$2a$10$W2k9gG4XhR8hS19pXf3Y7uK2oG5y1z9wM7vE3r4t5y6u7i8o9p0qa";

let dadosLocais = {};
let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem Livre] Conectando ao JSONBin e solicitando dados...");
        
        const resposta = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': API_KEY }
        });
        
        if (resposta.data && resposta.data.record) {
            // Se já tiver jogadores salvos lá, ele puxa para a memória do Render
            dadosLocais = resposta.data.record.players || {};
            conectadoA_Nuvem = true;
            console.log("=======================================================");
            console.log("✅ [NUVEM] TOTALMENTE ONLINE! CONEXÃO ESTÁVEL SEM FIREWALL!");
            console.log("=======================================================");
        }
    } catch (e) {
        console.log("=======================================================");
        console.log("❌ [Nuvem Erro] Erro ao conectar na API:", e.message);
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

    // Quando o jogador faz algo no Godot, o Render altera o arquivo lá na nuvem na mesma hora
    if (conectadoA_Nuvem) {
        try {
            await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, { players: dadosLocais }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': API_KEY
                }
            });
            console.log(`☁️ [Nuvem] Dados salvos e modificados para o jogador: ${username}`);
            return true;
        } catch (e) {
            console.log("❌ [Nuvem Erro] Falha ao enviar modificação:", e.message);
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
