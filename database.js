const { Client } = require('pg');

// 🌐 NUVEM ULTRA-CONECTADA (Sem Firewall, Sem Bloqueios, Conexão Direta e Eterna!)
const connectionString = "postgresql://redutorp_user:M4th3us_RP_2026@ep-cool-snowflake-a45k9z3m.sa-east-1.aws.neon.tech/redutorp?sslmode=require";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false } // 🔓 Desativa qualquer trava de certificado ou Firewall!
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem] Conectando ao banco totalmente aberto e sem Firewall...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [NUVEM] CONECTADO COM SUCESSO! STATUS: 100% ONLINE!");
        console.log("=======================================================");
        
        // Cria a tabela na nuvem na hora, sem erro!
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
        console.log("❌ [Nuvem Erro] Falha ao acessar o banco:", e.message);
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
    } catch (e) { return null; }
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
    } catch (e) { return false; }
}

async function obterTodosOsUsuarios() {
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
