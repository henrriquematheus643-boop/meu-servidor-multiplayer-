const WebSocket = require('ws');
const { Client } = require('pg');

const PORT = process.env.PORT || 8080;
// O Render vai injetar o link do Supabase aqui automaticamente através da variável DATABASE_URL
const connectionString = process.env.DATABASE_URL; 

const db = new Client({ connectionString });
db.connect()
    .then(() => {
        console.log("💾 [Armazenamento] Conectado com sucesso ao banco do Supabase!");
    })
    .catch(err => console.error("❌ [Erro] Falha ao conectar no armazenamento:", err));

const server = new WebSocket.Server({ port: PORT });
console.log(`🚀 [Game Rubi] Servidor Multiplayer rodando na porta ${PORT}`);

server.on('connection', (socket) => {
    console.log('🔌 [Conexão] Um jogador entrou no servidor!');

    socket.on('message', async (data) => {
        try {
            const mensagem = JSON.parse(data);
            const { comando, username, password, posicao } = mensagem;

            // 📝 CRIAR CONTA (Salva direto no Supabase)
            if (comando === 'registrar') {
                if (!username || !password) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Dados inválidos!' }));
                    return;
                }
                try {
                    const id_oficial = '_' + Math.random().toString(36).substr(2, 9);
                    await db.query(
                        'INSERT INTO jogadores (username, password, id_oficial) VALUES ($1, $2, $3)',
                        [username, password, id_oficial]
                    );
                    console.log(`✅ [Armazenamento] Conta de ${username} salva permanentemente.`);
                    socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                } catch (err) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Essa conta já existe, zagueirão!' }));
                }
            }

            // 🔑 LOGAR (Busca direto no Supabase)
            else if (comando === 'logar') {
                const res = await db.query('SELECT * FROM jogadores WHERE username = $1', [username]);
                const conta = res.rows[0];

                if (conta && conta.password === password) {
                    console.log(`🔓 [Login] Acesso liberado para: ${username}`);
                    // Devolve os dados salvos para o Game Rubi
                    socket.send(JSON.stringify({
                        status: 'logado_com_sucesso',
                        id_oficial: conta.id_oficial,
                        nome_oficial: conta.username,
                        posicao: [conta.pos_x, conta.pos_y, conta.pos_z]
                    }));
                } else {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha incorretos!' }));
                }
            }

            // 📍 SALVAR POSIÇÃO DO MAPA MULTIPLAYER
            else if (comando === 'salvar_posicao') {
                if (posicao && posicao.length === 3) {
                    await db.query(
                        'UPDATE jogadores SET pos_x = $1, pos_y = $2, pos_z = $3 WHERE username = $4',
                        [posicao[0], posicao[1], posicao[2], username]
                    );
                }
            }

        } catch (erro) {
            console.error('❌ Erro no processamento:', erro);
        }
    });
});
