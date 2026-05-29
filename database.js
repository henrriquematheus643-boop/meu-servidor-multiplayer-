const { Pool } = require('pg');

// 🚀 CONFIGURAÇÃO OFICIAL COMPATÍVEL COM O BANCO DE DADOS DO RENDER
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        // O Render exige essa configuração para aceitar conexões externas de banco de dados
        rejectUnauthorized: false
    }
});

// Força a criação da tabela correta se ela não existir no seu banco do Render
const inicializarBanco = async () => {
    const queryTabela = `
        CREATE TABLE IF NOT EXISTS usuarios_galaxy (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            last_pos TEXT DEFAULT '[0, 2, 0]'
        );
    `;
    try {
        await pool.query(queryTabela);
        console.log("💾 [RENDER-POSTGRES] Tabela 'usuarios_galaxy' verificada e ativa!");
    } catch (erro) {
        console.error("❌ [RENDER-POSTGRES] Erro ao criar ou ler a tabela:", erro);
    }
};

// Ativa o banco assim que o Render liga o seu script
inicializarBanco();

// 🔍 BUSCAR JOGADOR (Login e Registro)
const buscarUsuarioNaNuvem = async (username) => {
    if (!username) return null;
    try {
        const nomeLimpo = String(username).trim();
        const resultado = await pool.query(
            "SELECT id, username, password, last_pos FROM usuarios_galaxy WHERE LOWER(username) = LOWER($1);",
            [nomeLimpo]
        );
        
        if (resultado.rows.length > 0) {
            const usuario = resultado.rows[0];
            
            let posicaoArray = [0, 2, 0];
            try {
                if (usuario.last_pos) {
                    posicaoArray = typeof usuario.last_pos === 'string' ? JSON.parse(usuario.last_pos) : usuario.last_pos;
                }
            } catch (e) {
                posicaoArray = [0, 2, 0];
            }

            return {
                id: String(usuario.id),
                username: String(usuario.username),
                password: String(usuario.password),
                last_pos: posicaoArray
            };
        }
        return null;
    } catch (erro) {
        console.error(`❌ [RENDER-BANCO] Erro ao buscar usuario (${username}):`, erro);
        return null;
    }
};

// 💾 SALVAR JOGADOR (Registro e Salvar Posição)
const salvarUsuarioNaNuvem = async (jogador) => {
    if (!jogador || !jogador.username) return false;
    try {
        const idLimpo = String(jogador.id).trim();
        const nomeLimpo = String(jogador.username).trim();
        const senhaLimpa = String(jogador.password).trim();
        const posicaoTexto = JSON.stringify(jogador.last_pos || [0, 2, 0]);

        const queryUpsert = `
            INSERT INTO usuarios_galaxy (id, username, password, last_pos)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET last_pos = EXCLUDED.last_pos;
        `;

        await pool.query(queryUpsert, [idLimpo, nomeLimpo, senhaLimpa, posicaoTexto]);
        return true;
    } catch (erro) {
        console.error(`❌ [RENDER-BANCO] Erro ao salvar dados de ${jogador.username}:`, erro);
        return false;
    }
};

module.exports = {
    buscarUsuarioNaNuvem,
    salvarUsuarioNaNuvem
};
