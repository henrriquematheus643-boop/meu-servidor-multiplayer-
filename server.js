const WebSocket = require('ws');
const http = require('http');
const database = require('./database.js');

// O Railway configura a porta sozinho automaticamente
const PORTA = process.env.PORT || 10000;

// 🛠️ CRIAMOS UM SERVIDOR HTTP QUE ACEITA OS DOIS SISTEMAS JUNTOS
const server = http.createServer(async (req, res) => {
    // Permite que qualquer aplicativo (inclusive a Godot) envie dados para cá
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 📥 SE A GODOT MANDAR DADOS VIA HTTP (TELA DE LOGIN/REGISTRO)
    if (req.method === 'POST') {
        let corpo = '';
        req.on('data', chunk => { corpo += chunk.toString(); });
        req.on('end', async () => {
            try {
                const dados = JSON.parse(corpo);
                
                // 📝 1. COMANDO DE REGISTRAR CONTA
                if (dados.comando === "registrar") {
                    const usuarioExiste = await database.buscarUsuarioNaNuvem(dados.username);
                    if (usuarioExiste) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso na cidade!" }));
                        console.log(`⚠️ [REGISTRO] Nome recusado: ${dados.username}`);
                    } else {
                        const novoJogador = {
                            username: dados.username,
                            password: dados.password,
                            id: Math.floor(Math.random() * 90000) + 10000,
                            last_pos: [0, 2, 0]
                        };
                        await database.salvarUsuarioNaNuvem(novoJogador);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: "registrado_com_sucesso" }));
                        console.log(`✅ [BANCO] Nova conta criada para: ${dados.username}`);
                    }
                }
                
                // 🔑 2. COMANDO DE LOGAR CONTA
                else if (dados.comando === "logar") {
                    const resultadoBanco = await database.buscarUsuarioNaNuvem(dados.username);
                    const jogador = resultadoBanco ? { ...resultadoBanco } : null;
                    
                    if (jogador && String(jogador.password) === String(dados.password)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            status: "logado_com_sucesso", 
                            id_oficial: String(jogador.id),
                            nome_oficial: jogador.username,
                            posicao: jogador.last_pos 
                        }));
                        console.log(`🔓 [BANCO] Login aprovado via HTTP: ${dados.username}`);
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        console.log(`❌ [BANCO] Erro de senha para: ${dados.username}`);
                    }
                }
                
                // 💾 3. SALVAR POSIÇÃO VIA HTTP
                else if (dados.comando === "salvar_posicao") {
                    const jogador = await database.buscarUsuarioNaNuvem(dados.username);
                    if (jogador) {
                        jogador.last_pos = dados.posicao;
                        await database.salvarUsuarioNaNuvem(jogador);
                    }
                    res.writeHead(200);
                    res.end();
                }
            } catch (e) {
                res.writeHead(400);
                res.end("Erro ao processar JSON");
            }
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Servidor do Reduto RP rodando na Nuvem!");
    }
});

// 🌐 CONECTAMOS O WEBSOCKET NO MESMO SERVIDOR PARA O MULTIPLAYER
const wss = new WebSocket.Server({ server });
let clientesAtivos = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;

    ws.on('message', async (mensagem) => {
        try {
            const dados = JSON.parse(mensagem);

            // SINCRO MULTIPLAYER: ENTRADA NO MAPA 3D
            if (dados.action === "login") {
                meuIdNoServidor = String(dados.id);
                meuNomeNoServidor = dados.username;
                clientesAtivos.set(meuIdNoServidor, ws);
                
                transmitirParaTodos({
                    action: "login",
                    id: meuIdNoServidor,
                    username: meuNomeNoServidor
                });
                console.log(`🎮 [MULTIPLAYER] ${meuNomeNoServidor} entrou no mapa global.`);
            }

            // SINCRO MULTIPLAYER: MOVIMENTO EM TEMPO REAL
            if (dados.action === "posicao") {
                transmitirParaTodos({
                    action: "posicao",
                    id: dados.id,
                    pos: dados.pos,
                    rot: dados.rot
                });
            }
        } catch (erro) {}
    });

    ws.on('close', () => {
        if (meuIdNoServidor) {
            clientesAtivos.delete(meuIdNoServidor);
            transmitirParaTodos({ action: "sair", id: meuIdNoServidor });
            console.log(`❌ [MULTIPLAYER] Cidadão ID ${meuIdNoServidor} desconectou.`);
        }
    });
});

function transmitirParaTodos(dados) {
    const message = JSON.stringify(dados);
    clientesAtivos.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(message);
        }
    });
}

// Inicializa o servidor na porta do Railway
server.listen(PORTA, () => {
    console.log(`🚀 [SERVIDOR UNIFICADO] Online na porta ${PORTA}`);
});

