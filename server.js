const WebSocket = require('ws');

// O Render define a porta automaticamente.
const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

// Banco de dados em memória (Enquanto você não configura o Supabase, este guarda os dados)
// Se o Render reiniciar, os dados resetam aqui. 
const usuarios = {}; 

console.log(`🚀 Servidor Game Rubi ativo na porta ${PORT}`);

server.on('connection', (socket) => {
    console.log('🔌 Novo jogador conectado!');

    socket.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            const { comando, username, password, posicao } = msg;

            if (comando === 'registrar') {
                if (usuarios[username]) {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Conta já existe!' }));
                } else {
                    usuarios[username] = { 
                        password, 
                        id_oficial: 'ID_' + Math.floor(Math.random() * 1000),
                        posicao: [0, 0, 0] 
                    };
                    socket.send(JSON.stringify({ status: 'registrado_com_sucesso' }));
                    console.log(`📝 Usuário registrado: ${username}`);
                }
            }

            else if (comando === 'logar') {
                const user = usuarios[username];
                if (user && user.password === password) {
                    socket.send(JSON.stringify({
                        status: 'logado_com_sucesso',
                        id_oficial: user.id_oficial,
                        nome_oficial: username,
                        posicao: user.posicao
                    }));
                    console.log(`🔓 Login realizado: ${username}`);
                } else {
                    socket.send(JSON.stringify({ status: 'erro', msg: 'Senha ou usuário incorretos!' }));
                }
            }

            else if (comando === 'salvar_posicao') {
                if (usuarios[username]) {
                    usuarios[username].posicao = posicao;
                }
            }
        } catch (e) {
            console.log("Erro ao processar mensagem");
        }
    });
});
