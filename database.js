const { Pool } = require('pg');

// O Railway conecta automaticamente usando a variável de ambiente abaixo
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Obrigatório para a segurança do Railway
    }
});

// Cria a tabela correta de forma simples e direta se ela não existir
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
        console.log("💾 [POSTGRESQL] Tabela 'usuarios_galaxy' pronta para uso!");
    } catch (erro) {
        console.error("❌ [POSTGRESQL] Erro crítico ao criar a tabela:", erro);
    }
};

// Liga a verificação assim que o servidor inicia
inicializarBanco();

// 🔍 FUNÇÃO 1: Busca o jogador pelo nome (Para Login e Registro)
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
            
            // Converte o texto da posição de volta para uma lista de números [x, y, z] de forma segura
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
        console.error(`❌ [BANCO] Erro ao buscar usuario (${username}):`, erro);
        return null;
    }
};

// 💾 FUNÇÃO 2: Salva ou Atualiza o jogador (Para Registro e Salvar Posição)
const salvarUsuarioNaNuvem = async (jogador) => {
    if (!jogador || !jogador.username) return false;
    try {
        const idLimpo = String(jogador.id).trim();
        const nomeLimpo = String(jogador.username).trim();
        const senhaLimpa = String(jogador.password).trim();
        
        // Salva a lista de coordenadas [x, y, z] como um texto limpo, evitando bugs do tipo JSONB
        const posicaoTexto = JSON.stringify(jogador.last_pos || [0, 2, 0]);

        // Executa o comando UPSERT: Se a conta não existir, ele cria. Se já existir, ele atualiza a última posição!
        const queryUpsert = `
            INSERT INTO usuarios_galaxy (id, username, password, last_pos)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username) 
            DO UPDATE SET last_pos = EXCLUDED.last_pos;
        `;

        await pool.query(queryUpsert, [idLimpo, nomeLimpo, senhaLimpa, posicaoTexto]);
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
