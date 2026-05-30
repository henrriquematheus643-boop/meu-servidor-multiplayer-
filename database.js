const { Client } = require('pg');

const linkBanco = process.env.DATABASE_URL;

const db = new Client({
    connectionString: linkBanco,
    ssl: {
        rejectUnauthorized: false
    }
});

async function conectarBanco() {
    if (!linkBanco) {
        console.error("❌ [Database] ERRO: DATABASE_URL está vazia no Render!");
        return;
    }
    
    try {
        await db.connect();
        console.log("💾 [Database] Conexão com o Supabase estabelecida!");
        
        // Garante que a tabela use tipos REAL para as posições do mapa 3D
        await db.query(`
            CREATE TABLE IF NOT EXISTS jogadores (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(50) NOT NULL,
                id_oficial VARCHAR(50) NOT NULL,
                pos_x REAL DEFAULT 0,
                pos_y REAL DEFAULT 0,
                pos_z REAL DEFAULT 0
            );
        `);
        console.log("📊 [Database] Tabela 'jogadores' verificada com sucesso.");
    } catch (erro) {
        console.error("❌ [Database] Erro na inicialização das tabelas:", erro.message);
        throw erro;
    }
}

async function registrarJogador(username, password) {
    const id_oficial = 'ID_' + Math.floor(1000 + Math.random() * 9000);
    // Insere o jogador com a posição zerada padrão para evitar que venha nulo no primeiro login
    const comandoSQL = 'INSERT INTO jogadores(username, password, id_oficial, pos_x, pos_y, pos_z) VALUES($1, $2, $3, 0.0, 0.0, 0.0)';
    await db.query(comandoSQL, [username, password, id_oficial]);
    return { sucesso: true };
}

async function buscarJogador(username) {
    const comandoSQL = 'SELECT username, password, id_oficial, pos_x, pos_y, pos_z FROM jogadores WHERE username = $1';
    const resultado = await db.query(comandoSQL, [username]);
    return resultado.rows[0]; // Se não achar nada, retorna undefined de forma limpa
}

async function salvarPosicaoJogador(username, posicao) {
    try {
        const comandoSQL = 'UPDATE jogadores SET pos_x = $1, pos_y = $2, pos_z = $3 WHERE username = $4';
        await db.query(comandoSQL, [posicao[0], posicao[1], posicao[2], username]);
    } catch (err) {
        console.error("⚠️ Não foi possível salvar a posição de " + username);
    }
}

module.exports = {
    conectarBanco,
    registrarJogador,
    buscarJogador,
    salvarPosicaoJogador
};
