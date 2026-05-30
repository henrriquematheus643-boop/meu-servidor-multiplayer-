const { Client } = require('pg');

// Pega o link oficial do banco que você colocou no painel do Render
const linkBanco = process.env.DATABASE_URL;

// Cria o cliente apontando ÚNICA e EXCLUSIVAMENTE para o link da nuvem
const db = new Client({
    connectionString: linkBanco,
    ssl: {
        rejectUnauthorized: false // Obrigatório para o Render aceitar o Supabase com segurança
    }
});

// Inicializa a conexão de forma direta
async function conectarBanco() {
    if (!linkBanco) {
        console.error("❌ [Database] ERRO: A variável DATABASE_URL está vazia no Render!");
        return;
    }
    
    try {
        await db.connect();
        console.log("💾 [Database] Conectado com sucesso ao banco de dados externo!");
        
        // Cria a tabela oficial do Reduto RP se ela não existir
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
        console.log("📊 [Database] Tabela 'jogadores' pronta para o uso.");
    } catch (erro) {
        console.error("❌ [Database] Erro fatal na conexão:", erro.message);
    }
}

// Salva nova conta com ID único de RP
async function registrarJogador(username, password) {
    const id_oficial = 'ID_' + Math.floor(1000 + Math.random() * 9000);
    const comandoSQL = 'INSERT INTO jogadores(username, password, id_oficial) VALUES($1, $2, $3)';
    await db.query(comandoSQL, [username, password, id_oficial]);
    return { sucesso: true };
}

// Busca jogador para fazer o Login
async function buscarJogador(username) {
    const comandoSQL = 'SELECT * FROM jogadores WHERE username = $1';
    const resultado = await db.query(comandoSQL, [username]);
    return resultado.rows[0];
}

// Salva a posição 3D do boneco no mapa do jogo
async function salvarPosicaoJogador(username, posicao) {
    const comandoSQL = 'UPDATE jogadores SET pos_x = $1, pos_y = $2, pos_z = $3 WHERE username = $4';
    await db.query(comandoSQL, [posicao[0], posicao[1], posicao[2], username]);
}

// Exporta o sistema limpo
module.exports = {
    conectarBanco,
    registrarJogador,
    buscarJogador,
    salvarPosicaoJogador
};
