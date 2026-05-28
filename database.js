const { Client } = require('pg');

// 🔑 COLOQUE SUA SENHA ABAIXO:
// Substitua a palavra SUA_SENHA_AQUI pela senha que você criou lá no Supabase.
// ATENÇÃO: Se sua senha tiver símbolos como @, #, $ mude ela no site do Supabase para usar apenas letras e números!
const connectionString = "postgresql://postgres.riqsfqhnfmerwvhidalp:Matheushen135@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000, 
    ssl: { rejectUnauthorized: false }
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando diretamente ao banco Supabase...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO COM SUCESSO À SUA NUVEM REAL!");
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
        console.log("❌ [ERRO CRÍTICO DE CONEXÃO] A Nuvem recusou o servidor!");
        console.log("Motivo Real do Erro:", e.message);
        console.log("=======================================================");
        conectadoA_Nuvem = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectadoA_Nuvem) return null; // Bloqueia se não tiver nuvem
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
    if (!conectadoA_Nuvem) return false; // Bloqueia se não tiver nuvem
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
        console.log("❌ Erro ao gravar na nuvem:", e.message);
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
