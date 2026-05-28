const { Client } = require('pg');

// 🔑 COLE SEU LINK INTERNO DO RENDER ABAIXO:
// Substitua todo o link abaixo pelo "Internal Database URL" que você copiou lá no painel do Render!
const connectionString = "postgresql://postgres:SUA_SENHA_INTERNA@dpg-xxxxxxxxx-a:5432/postgres";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000
});

let conectadoA_Nuvem = false;

async function conectar() {
    try {
        console.log("[Nuvem Interna] Conectando ao banco de dados do próprio Render...");
        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [BANCO LOCAL] CONECTADO COM SUCESSO! 100% ONLINE!");
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
        console.log("❌ [Erro] Falha ao conectar no banco interno:", e.message);
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
