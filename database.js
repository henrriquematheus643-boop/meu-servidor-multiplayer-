const { Client } = require('pg');

// Link da nuvem Supabase do Reduto RP
const connectionString = "postgresql://postgres.v8k3m.supabase.co:5432/postgres?user=postgres.v8k3m&password=RedutoRP123456";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000,
    // 🔒 CHAVE DO SEGREDO: Força o uso de SSL/Criptografia exigido pelo Render para conectar na nuvem externa
    ssl: {
        rejectUnauthorized: false
    }
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando ao Supabase com protocolo SSL Ativado...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO TOTALMENTE COM SUCESSO À NUVEM!");
        console.log("=======================================================");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                username TEXT PRIMARY KEY,
                password TEXT,
                id INT,
                last_pos REAL[]
            );
        `);
    } catch (e) {
        console.log("=======================================================");
        console.log("⚠️ [AVISO DA NUVEM] Modo de Emergência Ativo.");
        console.log("Motivo:", e.message);
        console.log("=======================================================");
        conectadoA_Nuvem = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectadoA_Nuvem) return null;
    try {
        const res = await client.query('SELECT * FROM players WHERE username = $1', [String(nome).trim().toLowerCase()]);
        if (res.rows.length > 0) {
            const p = res.rows[0];
            return { username: p.username, password: p.password, id: p.id, last_pos: p.last_pos };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectadoA_Nuvem) return false;
    try {
        const nome = String(dadosJogador.username).trim().toLowerCase();
        await client.query(`
            INSERT INTO players (username, password, id, last_pos) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET password = $2, id = $3, last_pos = $4;
        `, [nome, dadosJogador.password, dadosJogador.id, dadosJogador.last_pos]);
        return true;
    } catch (e) {
        console.error("[Nuvem] Erro ao espelhar dados:", e.message);
        return false;
    }
}

async function obterTodosOsUsuarios() {
    if (!conectadoA_Nuvem) return [];
    try {
        const res = await client.query('SELECT * FROM players');
        return res.rows;
    } catch (e) {
        return [];
    }
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectadoA_Nuvem 
};
