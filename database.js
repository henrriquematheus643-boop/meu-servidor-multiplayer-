const { Client } = require('pg');

// Pega o link oficial do banco que você configurou no Environment do Render
const linkBanco = process.env.DATABASE_URL;

// Configuração travada para conectar direto e exclusivamente no Supabase externo
const db = new Client({
    connectionString: linkBanco,
    ssl: {
        rejectUnauthorized: false // Obrigatório para o Render aceitar o Supabase com segurança SSL
    }
});

// Inicializa a conexão de forma direta e sem erros locais
async function conectarBanco() {
    if (!linkBanco) {
        console.error("❌ [Database] ERRO CRÍTICO: A variável DATABASE_URL está vazia no Render!");
        console.error("👉 Vá no painel do Render -> Environment Variables e adicione DATABASE_URL com o seu link do Supabase.");
        return;
    }
    
    try {
        await db.connect();
        console.log("💾 [Database] Conexão com o Supabase estabelecida com sucesso!");
        
        // Cria a tabela oficial do Reduto RP se ela não existir com posições em REAL
        await db.query(`
            CREATE TABLE IF NOT EXISTS jogadores (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(50) NOT NULL,
                id_oficial VARCHAR(50) NOT NULL,
                pos_x REAL DEFAULT 0.0,
                pos_y REAL DEFAULT 0.0,
                pos_z REAL DEFAULT 0.0
            );
        `);
        console.log("📊 [Database] Tabela 'jogadores' verificada e pronta para o uso.");
    } catch (erro) {
        console.error("❌ [Database] Erro fatal ao estruturar as tabelas:", erro.message);
        throw erro; // Repassa o erro para o server.js saber que o banco falhou
    }
}

// Cria nova conta gerando o ID Único de RP de forma automática (Ex: ID_2841)
async function registrarJogador(username, password) {
    const id_oficial = 'ID_' + Math.floor(1000 + Math.random() * 9000);
    // Força a posição padrão 0.0 em tudo para não vir valor nulo que quebra a Godot 4
    const comandoSQL = 'INSERT INTO jogadores(username, password, id_oficial, pos_x, pos_y, pos_z) VALUES($1, $2, $3, 0.0, 0.0, 0.0)';
    await db.query(comandoSQL, [username, password, id_oficial]);
    return { sucesso: true };
}

// Busca o jogador para liberar o Login por usuário e senha
async function buscarJogador(username) {
    const comandoSQL = 'SELECT username, password, id_oficial, pos_x, pos_y, pos_z FROM jogadores WHERE username = $1';
    const resultado = await db.query(comandoSQL, [username]);
    return resultado.rows[0]; // Retorna a conta ou undefined se não existir
}

// Salva a posição 3D do jogador no mapa de forma segura
async function salvarPosicaoJogador(username, posicao) {
    try {
        const comandoSQL = 'UPDATE jogadores SET pos_x = $1, pos_y = $2, pos_z = $3 WHERE username = $4';
        await db.query(comandoSQL, [posicao[0], posicao[1], posicao[2], username]);
    } catch (err) {
        console.error("⚠️ [Database] Erro ao salvar posicao de " + username);
    }
}

// Exporta as funções limpas para o seu server.js usar
module.exports = {
    conectarBanco,
    registrarJogador,
    buscarJogador,
    salvarPosicaoJogador
};
