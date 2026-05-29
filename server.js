const WebSocket = require('ws');
const database = require('./database.js');

// O Railway configura a porta sozinho automaticamente
const PORTA = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORTA });

console.log(`🚀 [SERVIDOR WEBSOCKET] Reduto RP online na porta ${PORTA}`);

// Guarda todos os celulares conectados jogando no mapa agora
let clientesAtivos = new Map();

wss.on('connection', (ws) => {
    let meuIdNoServidor = null;
    let meuNomeNoServidor = null;
    
    console.log("🔌 [CONEXÃO] Um jogador se conectou via WebSocket!");

    ws.on('message', async (mensagem) => {
        try {
            const dados = JSON.parse(mensagem);
            
            // 📝 1. COMANDO DE REGISTRAR CONTA (TELA INICIAL)
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
                        last_pos: [0, 2, 0] // Nasce um pouco acima do chão
                    };
                    await database.salvarUsuarioNaNuvem(novoJogador);
                    
                    // Envia a resposta de sucesso para a Godot disparar o login automático
                    ws.send(JSON.stringify({ status: "registrado_com_sucesso" }));
                    console.log(`✅ [BANCO] Nova conta criada para: ${dados.username}`);
                }
                return;
            }

            // 🔑 2. COMANDO DE LOGAR CONTA (TELA INICIAL)
            if (dados.comando === "logar") {
                const resultadoBanco = await database.buscarUsuarioNaNuvem(dados.username);
                
                // Converte os dados brutos do PostgreSQL para um objeto limpo
                const jogador = resultadoBanco ? { ...resultadoBanco } : null;
                
                if (jogador && String(jogador.password) === String(dados.password)) {
                    meuIdNoServidor = String(jogador.id);
                    // Garante que o nome não venha como uma lista/array
                    meuNomeNoServidor = Array.isArray(jogador.username) ? parseInt(jogador.username[0]) : jogador.username;
                    
                    ws.send(JSON.stringify({ 
                        status: "logado_com_sucesso", 
                        id_oficial: meuIdNoServidor,
                        nome_oficial: meuNomeNoServidor,
                        posicao: jogador.last_pos 
                    }));
                    console.log(`🔓 [BANCO] Login aprovado via WebSocket: ${dados.username} [ID: ${meuIdNoServidor}]`);
                } else {
                    ws.send(JSON.stringify({ status: "erro", msg: "Senha incorreta ou usuario nao existe!" }));
                    console.log(`❌ [BANCO] Erro de login para: ${dados.username}`);
                }
                return;
            }

            // 🌐 3. CONEXÃO MULTIPLAYER (ENTRADA DO BONECO NO MAPA 3D)
            if (dados.action === "login") {
                meuIdNoServidor = String(dados.id);
                meuNomeNoServidor = dados.username;
                
                // Salva o WebSocket do jogador na lista de rede ativa
                clientesAtivos.set(meuIdNoServidor, ws);
                
                // Avisa todos os outros jogadores criarem seu boneco na tela deles
                transmitirParaTodos({
                    action: "login",
                    id: meuIdNoServidor,
                    username: meuNomeNoServidor
                });
                console.log(`🎮 [MULTIPLAYER] ${meuNomeNoServidor} entrou no mundo 3D.`);
                return;
            }

            // 📍 4. MOVIMENTO EM TEMPO REAL (POSIÇÃO E ROTAÇÃO)
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
            // Evita que o servidor caia se receber dados mal formatados
        }
    });

    // ❌ SE O JOGADOR FECHAR O JOGO OU PERDER A INTERNET
    ws.on('close', () => {
        if (meuIdNoServidor) {
            clientesAtivos.delete(meuIdNoServidor);
            // Avisa os outros celulares a deletarem o boneco desse jogador da tela
            transmitirParaTodos({
                action: "sair",
                id: meuIdNoServidor
            });
            console.log(`❌ [MULTIPLAYER] Cidadão ID ${meuIdNoServidor} desconectou.`);
        }
    });
});

// Envia pacotes de dados para todos os conectados ao mesmo tempo
function transmitirParaTodos(dados) {
    const message = JSON.stringify(dados);
    clientesAtivos.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(message);
        }
    });
}
