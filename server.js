const WebSocket = require('ws');

// O Railway define a porta automaticamente através da variável de ambiente PORT.
// Se não encontrar, ele usa a porta 8080 localmente para você testar.
const PORT = process.env.PORT || 8080;

// Inicializa o servidor WebSocket
const server = new WebSocket.Server({ port: PORT });

// Banco de dados temporário na memória para guardar as contas dos jogadores
// Nota: Em produção, o ideal é conectar com um banco como MongoDB ou PostgreSQL,
// mas esse aqui funciona direto na nuvem para o Game Rubi rodar liso de primeira!
const usuariosCadastrados = {}; 

console.log(`🚀 [Game Rubi] Servidor iniciado e rodando na porta ${PORT}`);

server.on('connection', (socket) => {
    console.log('🔌 [Conexão] Um novo jogador (Godot) acabou de se conectar!');

    socket.on('message', (data) => {
        try {
            // Transforma a mensagem de texto que veio da Godot em um objeto JavaScript
            const mensagem = JSON.parse(data);
            console.log('📥 [Comando Recebido]:', mensagem);

            const { comando, username, password, posicao } = mensagem;

            // 📝 LÓGICA DE REGISTRO / CADASTRO
            if (comando === 'registrar') {
                if (!username || !password) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha inválidos!' }));
                    return;
                }

                if (usuariosCadastrados[username]) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Essa conta já existe, zagueirão!' }));
                } else {
                    // Cria o jogador com ID único e posição inicial zerada no mapa 3D
                    usuariosCadastrados[username] = {
                        id_oficial: '_' + Math.random().toString(36).substr(2, 9),
                        nome_oficial: username,
                        password: password,
                        posicao: [0, 0, 0] // Spawn inicial [X, Y, Z]
                    };
                    console.log(`✅ [Cadastro] Conta criada para: ${username}`);
                    socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                }
            }

            // 🔑 LÓGICA DE LOGIN
            else if (comando === 'logar') {
                const conta = usuariosCadastrados[username];

                if (conta && conta.password === password) {
                    console.log(`🔓 [Login] Acesso liberado para: ${username}`);
                    socket.send(JSON.stringify({
                        status: 'logado_com_sucesso',
                        id_oficial: conta.id_oficial,
                        nome_oficial: conta.nome_oficial,
                        posicao: conta.posicao
                    }));
                } else {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Usuário ou senha incorretos!' }));
                }
            }

            // 📍 LÓGICA DE SALVAR POSIÇÃO MULTIPLAYER
            else if (comando === 'salvar_posicao') {
                if (usuariosCadastrados[username]) {
                    usuariosCadastrados[username].posicao = posicao;
                    console.log(`📍 [Posição] ${username} salvo em: [${posicao}]`);
                }
            }

        } catch (erro) {
            console.error('❌ [Erro] Falha ao processar dados enviados pela Godot:', erro);
        }
    });

    socket.on('close', () => {
        console.log('❌ [Conexão] Um jogador desconectou do servidor.');
    });
});
