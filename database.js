const { Pool } = require('pg');

// O Railway preenche a variável DATABASE_URL automaticamente na nuvem
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Permite a conexão segura exigida pelo Railway
    }
});

// Força a criação da tabela correta se ela não existir no PostgreSQL
const inicializarBanco = async () => {
    const queryTabela = `
        CREATE TABLE IF NOT EXISTS usuarios_galaxy (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            last_pos JSONB DEFAULT '[0, 2, 0]'::jsonb
        );
    `;
    try {
        await pool.query(queryTabela);
        console.log("💾 [POSTGRESQL] Tabela de cidadãos verificada/criada com sucesso!");
    } catch (erro) {
        console.error("❌ [POSTGRESQL] Erro ao criar tabela no banco:", erro);
    }
};

// Executa a verificação da tabela assim que o servidor liga
inicializarBanco();

// 🔍 FUNÇÃO 1: Busca o jogador pelo nome (para Login e Registro)
const buscarUsuarioNaNuvem = async (username) => {
    try {
        const nomeLimpo = String(username).trim();
        const resultado = await pool.query(
            "SELECT id, username, password, last_pos FROM usuarios_galaxy WHERE LOWER(username) = LOWER($1);",
            [nomeLimpo]
        );
        
        if (resultado.rows.length > 0) {
            // Retorna o jogador formatado corretamente para o server.js
            const usuario = resultado.rows[0];
            return {
                id: String(usuario.id),
                username: String(usuario.username),
                password: String(usuario.password),
                last_pos: Array.isArray(usuario.last_pos) ? usuario.last_pos : JSON.parse(JSON.stringify(usuario.last_pos))
            };
        }
        return null;
    } catch (erro) {
        console.error(`❌ [BANCO] Erro ao buscar usuário (${username}):`, erro);
        return null;
    }
};

// 💾 FUNÇÃO 2: Salva ou Atualiza o jogador (para Registro e Posição)
const salvarUsuarioNaNuvem = async (jogador) => {
    try {
        const idLimpo = String(jogador.id).trim();
        const nomeLimpo = String(jogador.username).trim();
        const senhaLimpa = String(jogador.password).trim();
        
        // Converte a posição [x, y, z] para formato JSON aceito pelo PostgreSQL
        const posicaoJson = JSON.stringify(jogador.last_pos || [0, 2, 0]);

        // Se o usuário já existir, atualiza a posição dele. Se não existir, insere um novo conta.
        const queryUpsert = `
            INSERT INTO usuarios_galaxy (id, username, password, last_pos)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET last_pos = EXCLUDED.last_pos;
        `;

        await pool.query(queryUpsert, [idLimpo, nomeLimpo, senhaLimpa, posicaoJson]);
        return true;
    } catch (erro) {
        console.error(`❌ [BANCO] Erro ao salvar dados de ${jogador.username}:`, erro);
        return false;
    }
};

module.exports = {
    buscarUsuarioNaNuvem,
    salvarUsuarioNaNuvem
};
