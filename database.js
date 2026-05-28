const { Client } = require('pg');

// 🔑 ADICIONE SUA SENHA ABAIXO:
// Substitua a palavra SUA_SENHA_AQUI pela senha que você criou lá no Supabase.
// DICA: Use apenas letras e números na senha para evitar erros no link!
const connectionString = "postgresql://postgres.riqsfqhnfmerwvhidalp:Matheushen135@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

let client = null;
let conectadoA_Nuvem = false;

// Memória de segurança do Render (Caso a senha esteja errada ou a nuvem caia, o jogo NÃO para!)
let memoriaEmergenciaRender = {}; 

async function conectar() {
    try {
        console.log("[Nuvem] Iniciando tentativa de conexão com o Supabase...");
        
        client = new Client({
            connectionString: connectionString,
            connectionTimeoutMillis: 5000, // Se o banco não responder em 5 segundos, pula para a emergência
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();
        conectadoA_Nuvem = true;
        
        console.log("=======================================================");
        console.log("✅ [SUPABASE] CONECTADO TOTALMENTE COM SUCESSO À NUVEM!");
        console.log("=======================================================");
        
        // Cria a tabela de contas se ela não existir
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
        console.log("⚠️ [MODO DE EMERGÊNCIA ATIVADO] O Servidor ligou com sucesso!");
        console.log("O Render não conseguiulogar no Supabase pelo motivo:", e.message);
        console.log("Fique tranquilo: O jogo vai funcionar direto pela memória do Render.");
        console.log("=======================================================");
        conectadoA_Nuvem = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    const username = String(nome).trim().toLowerCase();
    
    if (conectadoA_Nuvem) {
        try {
            const res = await client.query('SELECT * FROM players WHERE username = $1', [username]);
            if (res.rows.length > 0) return res.rows[0];
        } catch (e) {
            return memoriaEmergenciaRender[username] || null;
        }
    }
    return memoriaEmergenciaRender[username] || null;
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    const username = String(dadosJogador.username).trim().toLowerCase();
    memoriaEmergenciaRender[username] = dadosJogador; // Salva na emergência primeiro

    if (conectadoA_Nuvem) {
        try {
            await client.query(`
                INSERT INTO players (username, password, id, last_pos) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) 
                DO UPDATE SET password = $2, id = $3, last_pos = $4;
            `, [username, dadosJogador.password, dadosJogador.id, dadosJogador.last_pos]);
            return true;
        } catch (e) {
            console.log("[Nuvem Aviso] Falha ao espelhar na nuvem, mantido em memória.");
            return false;
        }
    }
    return true;
}

async function obterTodosOsUsuarios() {
    if (conectadoA_Nuvem) {
        try {
            const res = await client.query('SELECT * FROM players');
            return res.rows;
        } catch (e) {
            return Object.values(memoriaEmergenciaRender);
        }
    }
    return Object.values(memoriaEmergenciaRender);
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectadoA_Nuvem 
};
