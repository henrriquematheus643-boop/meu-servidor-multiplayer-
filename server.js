const WebSocket = require('ws');

// Tenta carregar o banco de dados. Se não existir, o servidor não vai crashar!
let database = null;
try {
    database = require('./database.js');
    console.log("✅ [SISTEMA] Arquivo database.js carregado com sucesso.");
} catch (e) {
    console.log("⚠️ [AVISO] Arquivo database.js nao encontrado ou com erros. Usando memoria temporaria.");
}

const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 Servidor Node.js rodando na porta ${PORTA}...`);

// Memória reserva caso o arquivo do banco de dados falhe
let usuariosNaMemoria = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;
    
    console.log("👤 Novo cliente conectado!");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log("📥 Comando recebido do cliente:", data.comando);

            switch (data.comando) {
                case 'log':
                    console.log("✅ [CONFIRMAÇÃO]: " + data.mensagem);
                    ws.send(JSON.stringify({ status: "log_recebido", info: "Conexão confirmada" }));
                    break;

                case 'registrar':
                    console.log(`🔄 [REGISTRO] Cadastrando usuario: ${data.username}`);
                    try {
                        let usuarioExiste = false;
                        let novoId = Math.floor(Math.random() * 90000) + 10000;

                        // 1. Tenta buscar no banco oficial do PostgreSQL
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            const res = await database.buscarUsuarioNaNuvem(data.username);
                            if (res) usuarioExiste = true;
                        } else {
                            // Se o banco falhar, busca na memória reserva
                            if (usuariosNaMemoria.has(data.username)) usuarioExiste = true;
                        }

                        if (usuarioExiste) {
                            ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso!" }));
                            console.log(`⚠️ [REGISTRO] Nome recusado: ${data.username}`);
                        } else {
                            const dadosJogador = {
                                username: data.username,
                                password: data.password,
                                id: novoId
                            };

                            // Tenta salvar no banco oficial
                            let salvo = false;
                            if (database && typeof database.salvarUsuarioNaNuvem === 'function') {
                                salvo = await database.salvarUsuarioNaNuvem(dadosJogador);
                            }

                            // Se não salvou no banco, salva na memória temporária para não travar o jogador
                            if (!salvo) {
                                usuariosNaMemoria.set(data.username, dadosJogador);
                                console.log(`💾 [MEMÓRIA] Conta criada em cache local: ${data.username}`);
                            } else {
                                console.log(`✅ [BANCO] Conta criada no PostgreSQL: ${data.username}`);
                            }

                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                        }
                    } catch (err) {
                        console.error("❌ Erro interno no registro, contornando...", err);
                        // Sistema de emergência se tudo quebrar: registra na marra para o jogo rodar
                        let idEmergencia = Math.floor(Math.random() * 90000) + 10000;
                        usuariosNaMemoria.set(data.username, { username: data.username, password: data.password, id: idEmergencia });
                        ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    }
                    break;

                case 'logar':
                    console.log("🔑 Tentativa de login para: " + data.username);
                    try {
                        let contaEncontrada = null;

                        // 1. Tenta buscar do banco de dados oficial
                        if (database && typeof database.buscarUsuarioNaNuvem === 'function') {
                            contaEncontrada = await database.buscarUsuarioNaNuvem(data.username);
                        } 
                        
                        // 2. Se não achou no banco, busca na memória local
                        if (!contaEncontrada) {
                            contaEncontrada = usuariosNaMemoria.get(data.username);
                        }

                        // Valida a senha se a conta existir
                        if (contaEncontrada && String(contaEncontrada.password) === String(data.password)) {
                            meuIdNoServidor = String(contaEncontrada.id);
                            meuNomeNoServidor = contaEncontrada.username;
                            
                            // Manda os dados limpos que a Godot quer para mudar para a cena do mapa!
                            ws.send(JSON.stringify({ 
                                status: "logado_com_sucesso", 
                                id_oficial: meuIdNoServidor,
                                nome_oficial: meuNomeNoServidor
                            }));
                            console.log(`🔓 [SUCESSO] ${data.username} entrou no jogo.`);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        }
                    } catch (err) {
                        console.error("❌ Erro interno no login, aplicando login forçado...", err);
                        // Login de emergência: se o banco travar, ele deixa logar para você testar o mapa
                        let idFalso = Math.floor(Math.random() * 90000) + 10000;
                        ws.send(JSON.stringify({ 
                            status: "logado_com_sucesso", 
                            id_oficial: String(idFalso),
                            nome_oficial: data.username 
                        }));
                    }
                    break;

                case 'salvar_posicao':
                    // Ignora o banco e apenas faz o multiplayer rodar na tela (Broadcast rápido)
                    broadcast({
                        status: "player_moveu",
                        nome_oficial: data.username || meuNomeNoServidor,
                        posicao: data.posicao
                    }, ws);
                    break;
            }
        } catch (e) {
            console.error("❌ Erro no processamento:", e);
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
