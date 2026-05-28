const { Client } = require('pg');

// Link da NOVA nuvem Supabase configurada exclusivamente para o Reduto RP
const connectionString = "postgresql://postgres.v8k3m.supabase.co:5432/postgres?user=postgres.v8k3m&password=RedutoRP123456";

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000
});

let conectado = false;

async function conectar() {
    try {
        console.log("[Nuvem Supabase] Conectando ao banco de dados estável...");
        await client.connect();
        conectado = true;
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO TOTALMENTE COM SUCESSO À NUVEM!");
        console.log("=======================================================");
        
        // Cria a tabela de jogadores automaticamente se ela não existir
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                username TEXT PRIMARY KEY,
                password TEXT,
                id INT,
                last_pos REAL[]
            );
        `);
    } catch (e) {
        console.error("❌ [SUPABASE ERRO CRÍTICO] Falha ao conectar na nuvem:", e.message);
    }
}
conectar();

// Busca o jogador pelo nome na nova nuvem
async function buscarUsuarioNaNuvem(nome) {
    if (!conectado) return null;
    try {
        const res = await client.query('SELECT * FROM players WHERE username = $1', [String(nome).trim().toLowerCase()]);
        if (res.rows.length > 0) {
            const p = res.rows[0];
            return { username: p.username, password: p.password, id: p.id, last_pos: p.last_pos };
        }
        return null;
    } catch (e) {
        console.error("[Supabase Erro] Falha ao buscar:", e.message);
        return null;
    }
}

// Grava ou atualiza o jogador na nuvem (Insere ou Atualiza se já existir)
async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectado) return false;
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
        console.error("[Supabase Erro] Falha real ao gravar dados:", e.message);
        return false;
    }
}

// Puxa a lista completa para o painel do Render ler
async function obterTodosOsUsuarios() {
    if (!conectado) return [];
    try {
        const res = await client.query('SELECT * FROM players');
        return res.rows;
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
