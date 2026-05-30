const WebSocket = require('ws');
const { Client } = require('pg');

const PORT = process.env.PORT || 8080;
// O link do Supabase você vai colar lá nas variáveis do Render com o nome DATABASE_URL
const connectionString = process.env.DATABASE_URL; 

const db = new Client({ connectionString });

db.connect()
    .then(() => console.log("💾 [Armazenamento] Conectado com sucesso ao Supabase!"))
    .catch(err => console.error("❌ [Erro] Falha ao conectar no armazenamento:", err));

const server = new WebSocket.Server({ port: PORT });
console.log(`🚀 [Reduto RP] Servidor Multiplayer ativo na porta ${PORT}`);

// Lista para controlar os jogadores que estão online no mapa agora
const jogadoresOnline = {};

server.on('connection', (socket) => {
    console.log('🔌 Um novo cidadão conectou ao servidor!');

    socket.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            const { comando, username, password, posicao } = msg;

            // 📝 COMANDO DE REGISTRAR CONTA
            if (comando === 'registrar') {
                if (!username || !password) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Dados inválidos!' }));
                    return;
                }
                try {
                    // Cria o ID único que vai aparecer na HUD do jogador
                    const id_oficial = 'ID_' + Math.floor(1000 + Math.random() * 9000);
                    
                    await db.query(
                        'INSERT INTO jogadores (username, password, id_oficial, pos_x, pos_y, pos_z) VALUES ($1, $2, $3, 0, 0, 0)',
                        [username, password, id_oficial]
                    );
                    
                    console.log(`✅ [Cadastro] ${username} salvo no banco de dados!`);
                    socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                } catch (err) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Essa conta já existe, zagueirão!' }));
                }
            }

            // 🔑 COMANDO DE LOGAR NA CONTA
            else if (comando === 'logar') {
                const res = await db.query('SELECT * FROM jogadores WHERE username = $1', [username]);
                const conta = res.rows[0];

                if (conta && conta.password === password) {
                    console.log(`🔓 [Login] ${username} entrou na cidade.`);
                    
                    // Guarda o socket do jogador para o sistema multiplayer saber quem ele é
                    socket.username = username;
                    jogadoresOnline[username] = socket;

                    // Devolve o ID Único, o Nome e a Posição Salva para a Godot
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

            // 📍 COMANDO MULTIPLAYER: SALVAR POSIÇÃO EM TEMPO REAL
            else if (comando === 'salvar_posicao') {
                if (posicao && posicao.length === 3 && username) {
                    // Atualiza as coordenadas [X, Y, Z] direto no site de armazenamento
                    await db.query(
                        'UPDATE jogadores SET pos_x = $1, pos_y = $2, pos_z = $3 WHERE username = $4',
                        [posicao[0], posicao[1], posicao[2], username]
                    );
                }
            }

        } catch (erro) {
            console.error('❌ Erro ao processar dados:', erro);
        }
    });

    socket.on('close', () => {
        if (socket.username && jogadoresOnline[socket.username]) {
            delete jogadoresOnline[socket.username];
            console.log(`❌ Cidadão ${socket.username} desconectou.`);
        }
    });
});
