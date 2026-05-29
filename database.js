const { Client } = require('pg');

// O Railway preenche a linha abaixo sozinho com o link do banco dele!
const URL_DO_BANCO = process.env.DATABASE_URL;

const client = new Client({
    connectionString: URL_DO_BANCO
});

let conectado = false;

async function conectar() {
    try {
        await client.connect();
        conectado = true;
        console.log("=======================================================");
        console.log("✅ [RAILWAY] BANCO DE DADOS CONECTADO AUTOMATICAMENTE!");
        console.log("=======================================================");
        
        // Cria a tabela que vai guardar as contas e posições para sempre
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                username TEXT PRIMARY KEY,
                password TEXT,
                id INT,
                last_pos REAL[]
            );
        `);
    } catch (e) {
        console.log("❌ [Erro Banco Railway]:", e.message);
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectado) return null;
    const username = String(nome).trim().toLowerCase();
    try {
        const res = await client.query('SELECT * FROM players WHERE username = $1', [username]);
        if (res.rows.length > 0) return res.rows[0];
        return null;
    } catch (e) {
        return null;
    }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectado) return false;
    const username = String(dadosJogador.username).trim().toLowerCase();
    try {
        await client.query(`
            INSERT INTO players (username, password, id, last_pos) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET password = $2, id = $3, last_pos = $4;
        `, [username, dadosJogador.password, dadosJogador.id, dadosJogador.last_pos]);
        console.log(`💾 [Banco] Dados de ${username} salvos com sucesso!`);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem };
