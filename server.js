const WebSocket = require('ws');

// Porta padrão que o Railway usa dinamicamente
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Servidor Multiplayer rodando na porta ${PORT}`);

wss.on('connection', (ws) => {
    console.log("🌐 Um jogador se conectou ao servidor!");

    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            console.log("📡 Comando recebido:", dados.comando);

            if (dados.comando === "registrar") {
                console.log(`📝 Criando conta para: ${dados.username}`);
                
                // 🔥 RESPOSTA EXATA PARA A GODOT:
                const resposta = { status: "registrado_com_sucesso" };
                ws.send(JSON.stringify(resposta));
            }

            if (dados.comando === "logar") {
                console.log(`🔐 Logando usuário: ${dados.username}`);
                
                // 🔥 RESPOSTA EXATA COM POSIÇÃO SALVA DE EXEMPLO:
                const resposta = {
                    status: "logado_com_sucesso",
                    id_oficial: "10",
                    nome_oficial: dados.username,
                    posicao: [0, 2, 0] // Nasce aqui
                };
                ws.send(JSON.stringify(resposta));
            }

            if (dados.comando === "salvar_posicao") {
                console.log(`💾 Posição de ${dados.username} atualizada para:`, dados.posicao);
            }

        } catch (e) {
            console.log("❌ Erro ao processar dados recebidos do cliente:", e.message);
        }
    });

    ws.on('close', () => {
        console.log("📴 Um jogador se desconectou.");
    });
});
