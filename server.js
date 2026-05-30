const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Simulação de Banco de Dados (Substitua pela conexão real com o seu DB, ex: Mongoose ou pg)
let bancoDeDadosUsuarios = {}; 

wss.on('connection', (ws) => {
    console.log("Novo jogador conectado ao Railway.");

    ws.on('message', (data) => {
        const mensagem = JSON.parse(data);
        
        switch (mensagem.comando) {
            case 'registrar':
                if (!bancoDeDadosUsuarios[mensagem.username]) {
                    bancoDeDadosUsuarios[mensagem.username] = { 
                        password: mensagem.password, 
                        posicao: [0, 1, 0] 
                    };
                    ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                } else {
                    ws.send(JSON.stringify({ status: "erro", msg: "Usuário já existe!" }));
                }
                break;

            case 'logar':
                const user = bancoDeDadosUsuarios[mensagem.username];
                if (user && user.password === mensagem.password) {
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        nome_oficial: mensagem.username,
                        posicao: user.posicao 
                    }));
                } else {
                    ws.send(JSON.stringify({ status: "erro", msg: "Login ou senha incorretos!" }));
                }
                break;

            case 'salvar_posicao':
                if (bancoDeDadosUsuarios[mensagem.username]) {
                    bancoDeDadosUsuarios[mensagem.username].posicao = mensagem.posicao;
                    console.log(`Posição salva para ${mensagem.username}: ${mensagem.posicao}`);
                }
                break;
        }
    });
});
