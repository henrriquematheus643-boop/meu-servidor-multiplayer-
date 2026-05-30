const WebSocket = require('ws');

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 Servidor Node.js rodando na porta ${PORTA}...`);

wss.on('connection', (ws) => {
    let meuNomeNoServidor = null;
    
    console.log("👤 Novo cliente conectado!");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido do cliente:", data.comando);

            switch (data.comando) {
                case 'log':
                    console.log("✅ [CONFIRMAÇÃO]: " + data.mensagem);
                    ws.send(JSON.stringify({ status: "log_recebido", info: "Conexão confirmada" }));
                    break;

                case 'logar':
                    console.log("🔑 Tentativa de login para: " + data.username);
                    meuNomeNoServidor = data.username;

                    // 1. Envia autorização imediata para a Godot mudar de cena
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        nome_oficial: data.username 
                    }));

                    // 2. Transmite para todos os outros players que você entrou no mundo (Multiplayer)
                    broadcast({
                        status: "player_nasceu",
                        username: data.username
                    }, ws);
                    break;

                case 'salvar_posicao':
                    // Sistema de broadcast em tempo real para sincronizar o movimento no mapa
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: data.username || meuNomeNoServidor,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro ao processar mensagem:", e);
        }
    });
});

function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
