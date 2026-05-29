const WebSocket = require('ws');
const database = require('./database.js');

// 🛠️ PORTA CORRETA PARA O SEU SERVIDOR
const PORTA = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR WEBSOCKET] Reduto RP online na porta ${PORTA}`);

// Guarda todos os jogadores ativos no mapa em tempo real
let clientesAtivos = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;
    
    console.log("🔌 [CONEXÃO] Um jogador se conectou via WebSocket!");

    ws.on('message', async (mensagem) => {
        try {
            const dados = JSON.parse(mensagem);
            
            // 📝 1. COMANDO DE REGISTRAR CONTA (BLINDADO CONTRA TRAVAMENTOS)
            if (dados.comando === "registrar") {
                console.log(`🔄 [REGISTRO] Tentando verificar nome no banco: ${dados.username}`);
                
                try {
                    const usuarioExiste = await database.buscarUsuarioNaNuvem(dados.username);
                    
                    if (usuarioExiste) {
                        ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso na cidade!" }));
                        console.log(`⚠️ [REGISTRO] Nome recusado (ja existe): ${dados.username}`);
                    } else {
                        const novoJogador = {
                            username: dados.username,
                            password: dados.password,
                            id: Math.floor(Math.random() * 90000) + 10000,
                            last_pos: [0, 2, 0]
                        };
                        
                        const salvoComSucesso = await database.salvarUsuarioNaNuvem(novoJogador);
                        
                        if (salvoComSucesso) {
                            ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                            console.log(`✅ [BANCO] Nova conta criada para: ${dados.username}`);
                        } else {
                            ws.send(JSON.stringify({ status: "erro", msg: "Erro do PostgreSQL ao salvar dados!" }));
                            console.log(`❌ [BANCO] Falha crítica ao salvar no banco.`);
                        }
                    }
                } catch (erroBanco) {
                    console.error("❌ [CRÍTICO] O database.js falhou ou travou:", erroBanco);
                    ws.send(JSON.stringify({ status: "erro", msg: "O banco de dados nao respondeu!" }));
                }
                return;
            }

            // 🔑 2. COMANDO DE LOGAR CONTA (BLINDADO)
            if (dados.comando === "logar") {
                console.log(`🔄 [LOGIN] Verificando credenciais de: ${dados.username}`);
                try {
                    const resultadoBanco = await database.buscarUsuarioNaNuvem(dados.username);
                    
                    if (resultadoBanco && String(resultadoBanco.password) === String(dados.password)) {
                        meuIdNoServidor = String(resultadoBanco.id);
                        meuNomeNoServidor = resultadoBanco.username;
                        
                        ws.send(JSON.stringify({ 
                            status: "logado_com_sucesso", 
                            id_oficial: meuIdNoServidor,
                            nome_oficial: meuNomeNoServidor,
                            posicao: resultadoBanco.last_pos 
                        }));
                        console.log(`🔓 [BANCO] Login aprovado para: ${dados.username}`);
                    } else {
                        ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                        console.log(`❌ [BANCO] Negado ou não encontrado: ${dados.username}`);
                    }
                } catch (erroBanco) {
                    console.error("❌ [CRÍTICO] Erro ao buscar login no banco:", erroBanco);
                    ws.send(JSON.stringify({ status: "erro", msg: "Erro interno no banco de dados!" }));
                }
                return;
            }

            // 🌐 3. CONEXÃO MULTIPLAYER (ENTRADA DO BONECO NO MAPA)
            if (dados.action === "login") {
                meuIdNoServidor = String(dados.id);
                meuNomeNoServidor = dados.username;
                clientesAtivos.set(meuIdNoServidor, ws);
                
                transmitirParaTodos({
                    action: "login",
                    id: meuIdNoServidor,
                    username: meuNomeNoServidor
                });
                console.log(`... [MULTIPLAYER] ${meuNomeNoServidor} entrou no mundo 3D.`);
                return;
            }

            // 📍 4. MOVIMENTO EM TEMPO REAL
            if (dados.action === "posicao") {
                transmitirParaTodos({
                    action: "posicao",
                    id: dados.id,
                    pos: dados.pos,
                    rot: dados.rot
                });
                return;
            }

            // 💾 5. SALVAR POSIÇÃO AUTOMÁTICA
            if (dados.comando === "salvar_posicao") {
                var nome_alvo = dados.username || meuNomeNoServidor;
                if (nome_alvo) {
                    try {
                        const jogador = await database.buscarUsuarioNaNuvem(nome_alvo);
                        if (jogador) {
                            jogador.last_pos = dados.posicao;
                            await database.salvarUsuarioNaNuvem(jogador);
                            console.log(`💾 [BANCO] Posicao de ${nome_alvo} salva.`);
                        }
                    } catch (e) { }
                }
                return;
            }

        } catch (erro) {
            // Ignora pacotes inválidos
        }
    });

    ws.on('close', () => {
        if (meuIdNoServidor) {
            clientesAtivos.delete(meuIdNoServidor);
            transmitirParaTodos({ action: "sair", id: meuIdNoServidor });
            console.log(`❌ [MULTIPLAYER] Cidadao ID ${meuIdNoServidor} desconectou.`);
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

