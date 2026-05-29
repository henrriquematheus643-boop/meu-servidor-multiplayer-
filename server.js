const WebSocket = require('ws');
const database = require('./database.js');

// O Railway escolhe a porta automaticamente pelo sistema dele
const PORTA = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Reduto RP online na porta ${PORTA}`);

// Guarda todos os jogadores que estão jogando na cidade agora
let clientesAtivos = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    console.log("🔌 [CONEXÃO] Um novo celular se conectou ao servidor!");

    ws.on('message', async (mensagem) => {
        try {
            const dados = JSON.parse(mensagem);
            
            // 📝 CÓDIGO DE REGISTRAR CONTA
            if (dados.comando === "registrar") {
                const usuarioExiste = await database.buscarUsuarioNaNuvem(dados.username);
                
                if (usuarioExiste) {
                    ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso na cidade!" }));
                    console.log(`⚠️ [REGISTRO] Nome recusado (ja existe): ${dados.username}`);
                } else {
                    const novoJogador = {
                        username: dados.username,
                        password: dados.password,
                        id: Math.floor(Math.random() * 90000) + 10000,
                        last_pos: [0, 2, 0] // Posição padrão de nascimento
                    };
                    await database.salvarUsuarioNaNuvem(novoJogador);
                    ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    console.log(`✅ [NUVEM] Nova conta criada permanentemente para: ${dados.username}`);
                }
            }

            // 🔑 CÓDIGO DE LOGAR CONTA
            if (dados.comando === "logar") {
                const jogador = await database.buscarUsuarioNaNuvem(dados.username);
                
                if (jogador && { ...jogador }.password === dados.password) {
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        id_oficial: String(jogador.id),
                        nome_oficial: jogador.username,
                        posicao: jogador.last_pos 
                    }));
                    console.log(`🔓 [LOGIN] Jogador entrou na cidade: ${dados.username} [ID: ${jogador.id}]`);
                } else {
                    ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                    console.log(`❌ [LOGIN] Tentativa de login errada para: ${dados.username}`);
                }
            }

            // 🚗 SINCRO MULTIPLAYER: ENTRADA NA SALA DO MAPA
            if (dados.action === "login") {
                meuIdNoServidor = String(dados.id);
                clientesAtivos.set(meuIdNoServidor, ws);
                
                // Avisa todo mundo que você entrou no mapa
                transmitirParaTodos({
                    action: "login",
                    id: meuIdNoServidor,
                    username: dados.username
                });
                console.log(`🌐 [MULTIPLAYER] ${dados.username} entrou no mapa global.`);
            }

            // 📍 SINCRO MULTIPLAYER: MOVIMENTO EM TEMPO REAL
            if (dados.action === "posicao") {
                transmitirParaTodos({
                    action: "posicao",
                    id: dados.id,
                    pos: dados.pos,
                    rot: dados.rot
                });
            }

            // 💾 SALVAR POSIÇÃO ENVIADA PELO BONECO A CADA 5 SEG
            if (dados.comando === "salvar_posicao") {
                if (dados.username) {
                    const jogador = await database.buscarUsuarioNaNuvem(dados.username);
                    if (jogador) {
                        jogador.last_pos = dados.posicao;
                        await database.salvarUsuarioNaNuvem(jogador);
                    }
                }
            }

        } catch (erro) {
            // Ignora dados corrompidos ou erros de leitura de pacotes rápidos
        }
    });

    ws.on('close', () => {
        if (meuIdNoServidor) {
            clientesAtivos.delete(meuIdNoServidor);
            // Avisa os outros celulares para sumirem com o boneco desse player do mapa
            transmitirParaTodos({
                action: "sair",
                id: meuIdNoServidor
            });
            console.log(`❌ [CONEXÃO] Cidadão ID ${meuIdNoServidor} saiu do jogo.`);
        }
    });
});

// Envia os dados para todos os celulares conectados ao mesmo tempo
function transmitirParaTodos(dados) {
    const mensagem = JSON.stringify(dados);
    clientesAtivos.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(mensagem);
        }
    });
}
