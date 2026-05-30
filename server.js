const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log("🚀 Servidor Node.js rodando na porta 8080...");

wss.on('connection', (ws) => {
    console.log("👤 Novo cliente conectado!");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido do cliente:", data.comando);

            switch (data.comando) {
                case 'log':
                    // CONFIRMAÇÃO DO APERTO DE MÃO
                    console.log("✅ [CONFIRMAÇÃO]: " + data.mensagem);
                    ws.send(JSON.stringify({ status: "log_recebido", info: "Conexão confirmada" }));
                    break;

                case 'logar':
                    // Lógica de Login
                    console.log("🔑 Tentativa de login para: " + data.username);
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        nome_oficial: data.username 
                    }));
                    break;

                case 'salvar_posicao':
                    // Reenvia para os outros clientes (sistema de broadcast)
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: data.username,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro ao processar mensagem:", e);
        }
    });
});

// Função para enviar para todos, menos para quem enviou
function broadcast(data, senderWs) {
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
