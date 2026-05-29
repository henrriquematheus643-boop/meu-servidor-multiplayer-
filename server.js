const WebSocket = require('ws');
const database = require('./database.js');

// O Railway configura a porta sozinho automaticamente
const PORTA = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR] Reduto RP online na porta ${PORTA}`);

// Guarda todos os celulares que estão conectados jogando no mapa agora
let clientesAtivos = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;
    
    console.log("🔌 [CONEXÃO] Um jogador acabou de conectar ao servidor!");

    ws.on('message', async (mensagem) => {
        try {
            const dados = JSON.parse(mensagem);
            
            // 📝 1. SE RECEBER COMANDO DE REGISTRAR CONTA (TELA INICIAL)
            if (dados.comando === "registrar" || dados.action === "registrar" || dados.action === "register") {
                const usuarioExiste = await database.buscarUsuarioNaNuvem(dados.username);
                
                if (usuarioExiste) {
                    ws.send(JSON.stringify({ status: "erro", msg: "Esse nome ja esta em uso na cidade!" }));
                    console.log(`⚠️ [REGISTRO] Nome recusado (ja existe): ${dados.username}`);
                } else {
                    const novoJogador = {
                        username: dados.username,
                        password: dados.password,
                        id: Math.floor(Math.random() * 90000) + 10000,
                        last_pos: [0, 2, 0] // Nasce um pouco acima do chão para não cair do mapa
                    };
                    await database.salvarUsuarioNaNuvem(novoJogador);
                    ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    console.log(`✅ [BANCO] Nova conta criada para: ${dados.username}`);
                }
                return; // Para o código por aqui para não misturar com o multiplayer
            }

            // 🔑 2. SE RECEBER COMANDO DE LOGAR CONTA (TELA INICIAL)
            if (dados.comando === "logar") {
                const jogador = await database.buscarUsuarioNaNuvem(dados.username);
                
                if (jogador && jogador.password === dados.password) {
                    // Guarda temporariamente os dados para quando ele carregar o mapa
                    meuIdNoServidor = String(jogador.id);
                    meuNomeNoServidor = jogador.username;
                    
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        id_oficial: meuIdNoServidor,
                        nome_oficial: meuNomeNoServidor,
                        posicao: jogador.last_pos 
                    }));
                    console.log(`🔓 [BANCO] Conta validada! Logando: ${dados.username} [ID: ${jogador.id}]`);
                } else {
                    ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                    console.log(`❌ [BANCO] Erro de login para: ${dados.username}`);
                }
                return;
            }

            // 🌐 3. CONEXÃO MULTIPLAYER (ENTRADA DO BONECO NO MAPA.TSCN)
            if (dados.action === "login") {
                meuIdNoServidor = String(dados.id);
                meuNomeNoServidor = dados.username;
                
                // Salva o celular do jogador na lista de rede ativa
                clientesAtivos.set(meuIdNoServidor, ws);
                
                // Avisa todos os outros jogadores que você entrou no mapa para criarem seu boneco
                transmitirParaTodos({
                    action: "login",
                    id: meuIdNoServidor,
                    username: meuNomeNoServidor
                });
                console.log(`🎮 [MULTIPLAYER] ${meuNomeNoServidor} entrou no mundo 3D.`);
                return;
            }

            // 📍 4. MOVIMENTO EM TEMPO REAL (CARROS, POSIÇÃO E ROTAÇÃO)
            if (dados.action === "posicao") {
                transmitirParaTodos({
                    action: "posicao",
                    id: dados.id,
                    pos: dados.pos,
                    rot: dados.rot
                });
                return;
            }

            // 💾 5. SALVAR POSIÇÃO AUTOMÁTICA (DO SCRIPT DO PLAYER)
            if (dados.comando === "salvar_posicao") {
                var nome_alvo = dados.username || meuNomeNoServidor;
                if (nome_alvo) {
                    const jogador = await database.buscarUsuarioNaNuvem(nome_alvo);
                    if (jogador) {
                        jogador.last_pos = dados.posicao;
                        await database.salvarUsuarioNaNuvem(jogador);
                        console.log(`💾 [BANCO] Posicao de ${nome_alvo} salva permanentemente.`);
                    }
                }
                return;
            }

        } catch (erro) {
            // Protege o servidor para não cair se receber algum dado incompleto
        }
    });

    // ❌ QUANDO O JOGADOR FECHA O JOGO OU CAI A INTERNET
    ws.on('close', () => {
        if (meuIdNoServidor) {
            clientesAtivos.delete(meuIdNoServidor);
            // Manda todos os outros celulares apagarem o boneco desse jogador da tela
            transmitirParaTodos({
                action: "sair",
                id: meuIdNoServidor
            });
            console.log(`❌ [MULTIPLAYER] Cidadão ID ${meuIdNoServidor} saiu da cidade.`);
        }
    });
});

// Função que espalha a mensagem para todos os jogadores ao mesmo tempo
function transmitirParaTodos(dados) {
    const mensagem = JSON.stringify(dados);
    clientesAtivos.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(mensagem);
        }
    });
}
