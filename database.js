const { Client } = require('pg');

// 🔑 LINHA DE CONEXÃO EXCLUSIVA DO MATHEUS COM A SENHA INSERIDA
const connectionString = "postgresql://postgres:Matheushen135@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?options=-c%20project%3Driqsfqhnfmerwvhidalp";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000, 
    ssl: { rejectUnauthorized: false } // Permite que o Render passe pela segurança do Supabase
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando diretamente ao banco Supabase do Matheus...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO COM SUCESSO À SUA NUVEM REAL!");
        console.log("=======================================================");
        
        // Cria a tabela de players na sua conta se ela não existir
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
        console.log("❌ [ERRO CRÍTICO] A Nuvem recusou a conexão!");
        console.log("Motivo:", e.message);
        console.log("=======================================================");
        conectadoA_Nuvem = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectadoA_Nuvem) return null;
    try {
        const username = String(nome).trim().toLowerCase();
        const res = await client.query('SELECT * FROM players WHERE username = $1', [username]);
        if (res.rows.length > 0) return res.rows[0];
        return null;
    } catch (e) {
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectadoA_Nuvem) return false;
    try {
        const username = String(dadosJogador.username).trim().toLowerCase();
        await client.query(`
            INSERT INTO players (username, password, id, last_pos) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET password = $2, id = $3, last_pos = $4;
        `, [username, dadosJogador.password, dadosJogador.id, dadosJogador.last_pos]);
        return true;
    } catch (e) {
        console.log("❌ Erro ao gravar dados na nuvem:", e.message);
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
