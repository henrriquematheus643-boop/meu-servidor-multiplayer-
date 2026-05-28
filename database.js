const { Client } = require('pg');

// 🌐 BANCO DE DADOS DEFINITIVO E PERMANENTE (Sem aplicativos e sem expirar!)
const connectionString = "postgresql://postgres.uzvbybofgqfscvjclpxt:RedutoRP_Suporte_2026@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 15000
});

let conectado = false;

async function conectar() {
    try {
        console.log("[Banco de Dados] Conectando à base de dados definitiva...");
        await client.connect();
        conectado = true;
        
        console.log("=======================================================");
        console.log("✅ [SISTEMA] BANCO DE DADOS CONECTADO E 100% ONLINE!");
        console.log("=======================================================");
        
        // Cria a tabela dos jogadores automaticamente se ela não existir
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
        console.log("❌ [Erro] Falha ao conectar na base de dados:", e.message);
        console.log("=======================================================");
        conectado = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectado) return null;
    try {
        const username = String(nome).trim().toLowerCase();
        const res = await client.query('SELECT * FROM players WHERE username = $1', [username]);
        if (res.rows.length > 0) return res.rows[0];
        return null;
    } catch (e) { return null; }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectado) return false;
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
    if (!conectado) return [];
    try {
        const res = await client.query('SELECT * FROM players');
        return res.rows;
    } catch (e) { return []; }
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectado 
};
