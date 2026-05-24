// Servidor de suporte Multiplayer para Godot 4 (WebSockets)
const WebSocket = require('ws');

// O Render define a porta automaticamente através do 'process.env.PORT'
// Se não encontrar, ele usa a porta 8080 como padrão
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`Servidor de suporte multiplayer rodando na porta ${PORT}...`);

// Lista para guardar todos os jogadores que estão conectados na sala
const clientes = new Set();

wss.on('connection', (ws) => {
    // Adiciona o novo jogador que acabou de entrar na lista
    clientes.add(ws);
    console.log(`Novo jogador conectado! Total de players: ${clientes.size}`);

    // Fica ouvindo as mensagens que o Godot envia (posição, rotação, animação)
    ws.on('message', (message) => {
        // Pega os dados desse player e envia para todos os OUTROS jogadores da sala
        for (let cliente of clientes) {
            if (cliente !== ws && cliente.readyState === WebSocket.OPEN) {
                cliente.send(message);
            }
        }
    });

    // Se o jogador fechar o jogo ou perder a internet, remove ele da lista
    ws.on('close', () => {
        clientes.delete(ws);
        console.log(`Um jogador saiu. Restam: ${clientes.size}`);
    });
});
