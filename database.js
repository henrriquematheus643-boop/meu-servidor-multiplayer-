const fs = require('fs');
const path = require('path');

// Cria um arquivo de texto seguro para as contas dentro do próprio servidor
const arquivoBanco = path.join(__dirname, 'usuarios_redutorp.json');

console.log("[Banco Local] Inicializando sistema de armazenamento interno...");

// Garante que o arquivo exista se for a primeira vez rodando
if (!fs.existsSync(arquivoBanco)) {
    fs.writeFileSync(arquivoBanco, JSON.stringify({}, null, 2));
}

// Carrega todos os usuários do arquivo interno
async function buscarUsuarioNaNuvem(nome) {
    try {
        const dadosRaw = fs.readFileSync(arquivoBanco, 'utf8');
        const usuarios = JSON.parse(dadosRaw);
        return usuarios[String(nome).trim()] || null;
    } catch (e) {
        return null;
    }
}

// Salva ou atualiza um jogador de forma permanente no arquivo
async function salvarUsuarioNaNuvem(dadosJogador) {
    try {
        const dadosRaw = fs.readFileSync(arquivoBanco, 'utf8');
        const usuarios = JSON.parse(dadosRaw);
        
        const nome = String(dadosJogador.username).trim();
        usuarios[nome] = dadosJogador;
        
        fs.writeFileSync(arquivoBanco, JSON.stringify(usuarios, null, 2));
        console.log(`[Banco Local] Dados de ${nome} cravados com sucesso!`);
    } catch (e) {
        console.error("[Banco Local Erro] Falha ao salvar jogador:", e.message);
    }
}

// Função para o painel ler todas as contas de uma vez
async function obterTodosOsUsuarios() {
    try {
        const dadosRaw = fs.readFileSync(arquivoBanco, 'utf8');
        const usuarios = JSON.parse(dadosRaw);
        return Object.values(usuarios);
    } catch (e) {
        return [];
    }
}

module.exports = { buscarUsuarioNaNuvem, salvarUsuarioNaNuvem, obterTodosOsUsuarios };
