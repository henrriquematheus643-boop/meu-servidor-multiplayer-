const { Client } = require('pg');

// 🔑 ESSA É A SUA LINHA DO SUPABASE! 
// RELEMBRE: Apague a palavra SUA_SENHA_AQUI e digite a senha que você criou no Supabase.
const connectionString = "postgresql://postgres.riqsfqhnfmerwvhidalp:SUA_SENHA_AQUI@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000,
    ssl: {
        rejectUnauthorized: false // Permite que o Render e o Supabase conversem com segurança
    }
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem Privada] Conectando à conta Supabase do Matheus...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO COM SUCESSO À SUA CONTA PRIVADA!");
        console.log("=======================================================");
        
        // Cria a tabela de players no seu banco automaticamente se não existir
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
        console.log("⚠️ [Nuvem] Modo de Emergência Ativo. Verifique a senha inserida.");
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
    } catch (e) { return null; }
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
    } catch (e) { return false; }
}

async function obtenerTodosOsUsuarios() {
    if (!conectadoA_Nuvem) return [];
    try {
        const res = await client.query('SELECT * FROM players');
        return res.rows;
    } catch (e) { return []; }
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectadoA_Nuvem 
};
