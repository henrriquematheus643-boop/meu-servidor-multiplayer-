const mysql = require('mysql2/promise');

// 🔑 CONFIGURAÇÃO DO SEU CELULAR BANCO DE DADOS:
// Substitua o IP_DO_SEU_CELULAR pelo IP real do seu Wi-Fi (Ex: 192.168.1.15)
const dbConfig = {
    host: 'IP_DO_SEU_CELULAR', 
    port: 3306,
    user: 'root',
    password: '', // Deixamos sem senha para facilitar no Termux
    database: 'redutorp',
    connectTimeout: 15000
};

let pool = null;
let conectadoAoCelular = false;

async function conectar() {
    try {
        console.log("[Celular DB] Tentando conectar ao banco de dados no celular do Matheus...");
        pool = mysql.createPool(dbConfig);
        
        // Testa a conexão
        const [rows] = await pool.query('SELECT 1');
        conectadoAoCelular = true;
        
        console.log("=======================================================");
        console.log("✅ [SISTEMA PRIVADO] CONECTADO AO BANCO DO SEU CELULAR!");
        console.log("=======================================================");
    } catch (e) {
        console.log("=======================================================");
        console.log("❌ [Erro] Não foi possível alcançar o seu celular:", e.message);
        console.log("DICA: Certifique-se de que o Termux está aberto e o comando mysqld_safe rodando.");
        console.log("=======================================================");
        conectadoAoCelular = false;
    }
}
conectar();

async function buscarUsuarioNaNuvem(nome) {
    if (!conectadoAoCelular) return null;
    try {
        const username = String(nome).trim().toLowerCase();
        const [rows] = await pool.query('SELECT * FROM players WHERE username = ?', [username]);
        if (rows.length > 0) {
            const p = rows[0];
            // Converte a posição de texto de volta para array
            return { username: p.username, password: p.password, id: p.id, last_pos: JSON.parse(p.last_pos || '[]') };
        }
        return null;
    } catch (e) { return null; }
}

async function salvarUsuarioNaNuvem(dadosJogador) {
    if (!conectadoAoCelular) return false;
    try {
        const username = String(dadosJogador.username).trim().toLowerCase();
        const posTexto = JSON.stringify(dadosJogador.last_pos || []);
        
        await pool.query(`
            INSERT INTO players (username, password, id, last_pos) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE password = ?, id = ?, last_pos = ?
        `, [username, dadosJogador.password, dadosJogador.id, posTexto, dadosJogador.password, dadosJogador.id, posTexto]);
        return true;
    } catch (e) { return false; }
}

async function obterTodosOsUsuarios() {
    if (!conectadoAoCelular) return [];
    try {
        const [rows] = await pool.query('SELECT * FROM players');
        return rows.map(p => ({ username: p.username, password: p.password, id: p.id, last_pos: JSON.parse(p.last_pos || '[]') }));
    } catch (e) { return []; }
}

module.exports = { 
    buscarUsuarioNaNuvem, 
    salvarUsuarioNaNuvem, 
    obterTodosOsUsuarios, 
    isNuvemOnline: () => conectadoAoCelular 
};
