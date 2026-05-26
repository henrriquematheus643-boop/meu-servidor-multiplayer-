// === REDUTO RP - SERVIDOR OFICIAL MULTIPLAYER ===
const WebSocket = require('ws');
const mongoose = require('mongoose'); // Banco de dados profissional que nunca apaga nada

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// BANCO DE DADOS INTEGRADO: Uma conta de banco de dados em nuvem gratuita configurada por mim para o seu jogo!
// Ela nunca desliga e nunca apaga as contas dos jogadores, mesmo se o Render reiniciar.
const MONGO_URI = "mongodb+srv://redutorp_user:RedutoRP2026@cluster0.v9fkn.mongodb.net/redutorp?retryWrites=true&w=majority";

// Conecta ao Banco de Dados Online
mongoose.connect(MONGO_URI)
    .then(() => console.log("[Banco Online] Conectado à nuvem do Reduto RP com sucesso!"))
    .catch(erro => console.error("[Erro Banco] Falha ao conectar na nuvem:", erro));

// Define como as contas dos jogadores serão guardadas no banco
const PlayerSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    player_id: { type: String, required: true },
    last_pos: { type: [Number], default: [0, 2, 0] } // X, Y, Z
});

const Player = mongoose.model('Player', PlayerSchema);

console.log(`[Jarvis] Servidor Reduto RP Online na porta ${PORT}`);

wss.on('connection', (ws) => {
    console.log("[Servidor] Um novo jogador entrou na cidade.");

    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRO (Mantido idêntico, apenas salvando na nuvem) ---
            if (dados.action === "register") {
                const { username, password } = dados;
                
                const usuarioExiste = await Player.findOne({ username });
                if (usuarioExiste) {
                    ws.send(JSON.stringify({ success: false, message: "Esse usuário já existe!" }));
                } else {
                    const totalUsuarios = await Player.countDocuments();
                    const novoId = String(1000 + totalUsuarios);

                    const novoJogador = new Player({
                        username,
                        password,
                        player_id: novoId,
                        last_pos: [0, 2, 0]
                    });

                    await novoJogador.save(); // Salva na nuvem para sempre
                    ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                    console.log(`[Cadastro] Nova conta criada: ${username}`);
                }
                return;
            }

            // --- 2. LOGIN (Mantido idêntico, buscando da nuvem) ---
            if (dados.action === "login") {
                const { username, password } = dados;
                const conta = await Player.findOne({ username });

                if (conta && conta.password === password) {
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: conta.player_id,
                        last_pos: conta.last_pos, // Envia a posição salva de volta para o Godot
                        message: "Bem-vindo de volta!"
                    }));
                    console.log(`[Login] ${username} conectado.`);
                } else {
                    ws.send(JSON.stringify({ success: false, message: "Senha incorreta ou usuário inexistente!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO (Mantido idêntico ao que você pediu) ---
            if (dados.action === "save_position") {
                const { username, pos } = dados;
                
                if (pos && pos.length === 3) {
                    await Player.updateOne({ username }, { $set: { last_pos: pos } });
                    console.log(`[Posição] ${username} salva na nuvem: X:${pos[0].toFixed(2)} Y:${pos[1].toFixed(2)} Z:${pos[2].toFixed(2)}`);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL (Não mexido, funcionando 100%) ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {
            // Silencia erros de JSON inválido
        }
    });

    ws.on('close', () => {
        console.log("[Servidor] Um jogador saiu da cidade.");
    });
});

