const WebSocket = require('ws');
const mongoose = require('mongoose');

// 🌐 CONFIGURAÇÃO DO PORTAL DA NUVEM
const PORT = process.env.PORT || 8080;

// 🔑 LINK DO BANCO DE DADOS: O Railway vai puxar isso de forma segura das variáveis de ambiente!
// Se não tiver na nuvem, ele tenta conectar em um banco local para testes.
const MONGO_URI = process.env.MONGO_URL || "SUA_URL_DO_MONGODB_AQUI";

// --- 💾 CONEXÃO COM O BANCO DE DADOS (MONGODB) ---
mongoose.connect(MONGO_URI)
  .then(() => console.log("💾 [Banco de Dados] Conectado com sucesso na nuvem do MongoDB Atlas!"))
  .catch((erro) => console.error("❌ [Banco de Dados] Erro ao conectar no MongoDB:", erro));

// Criando a estrutura (Schema) de como a conta do player vai ser salva no banco
const PlayerSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    id_oficial: { type: String, required: true },
    posicao: { type: [Number], default: [0, 0, 0] } // [X, Y, Z]
});

const Player = mongoose.model('Player', PlayerSchema);

// --- 🚀 INICIALIZAÇÃO DO SERVIDOR WEBSOCKET ---
const server = new WebSocket.Server({ port: PORT });
console.log(`🚀 [Game Rubi] Servidor WebSocket rodando na porta ${PORT}`);

server.on('connection', (socket) => {
    console.log('🔌 [Conexão] Um novo jogador da Godot se conectou!');

    socket.on('message', async (data) => {
        try {
            const mensagem = JSON.parse(data);
            console.log('📥 [Comando Recebido]:', mensagem);

            const { comando, username, password, posicao } = mensagem;

            // 📝 REGISTRO SALVANDO DIRETO NO BANCO DE DADOS
            if (comando === 'registrar') {
                if (!username || !password) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha inválidos!' }));
                    return;
                }

                // Procura no banco se já existe alguém com esse nome
                const usuarioExiste = await Player.findOne({ username: username });

                if (usuarioExiste) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Essa conta já existe, zagueirão!' }));
                } else {
                    // Cria o novo jogador para salvar permanentemente no banco de dados do site
                    const novoPlayer = new Player({
                        id_oficial: '_' + Math.random().toString(36).substr(2, 9),
                        username: username,
                        password: password,
                        posicao: [0, 0, 0]
                    });

                    await novoPlayer.save(); // Salva no site do banco de dados
                    console.log(`✅ [Banco de Dados] Nova conta gravada permanentemente: ${username}`);
                    socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                }
            }

            // 🔑 LOGIN BUSCANDO DIRETO NO BANCO DE DADOS
            else if (comando === 'logar') {
                // Busca o player no banco do site
                const conta = await Player.findOne({ username: username });

                if (conta && conta.password === password) {
                    console.log(`🔓 [Login] Acesso liberado via Banco: ${username}`);
                    socket.send(JSON.stringify({
                        status: 'logado_com_sucesso',
                        id_oficial: conta.id_oficial,
                        nome_oficial: conta.username,
                        posicao: conta.posicao
                    }));
                } else {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha incorretos!' }));
                }
            }

            // 📍 SALVAR POSIÇÃO ATUALIZANDO O BANCO DE DADOS
            else if (comando === 'salvar_posicao') {
                // Atualiza as coordenadas [X, Y, Z] do player no banco de dados
                await Player.updateOne({ username: username }, { $set: { posicao: posicao } });
                console.log(`📍 [Banco de Dados] Posição de ${username} atualizada para: [${posicao}]`);
            }

        } catch (erro) {
            console.error('❌ [Erro] Falha ao processar comandos:', erro);
        }
    });

    socket.on('close', () => {
        console.log('❌ [Conexão] Um jogador desconectou.');
    });
});
