const WebSocket = require('ws');
const banco = require('./database.js');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// O CACHE DO RENDER: Aqui ficam as contas salvas direto no servidor do Render!
let dadosLocaisDoRender = {};

console.log("[Game Rubi] Servidor Reduto RP - Sistema de Memória Local Híbrida Ativado!");

// Função que sincroniza a nuvem para dentro do Render quando o servidor liga
async function puxarDadosDaNuvemParaORender() {
    console.log("[Sistema] Sincronizando banco de dados com a memória do Render...");
    const contasNuvem = await banco.obterTodosOsUsuarios();
    
    contasNuvem.forEach(p => {
        dadosLocaisDoRender[p.username.toLowerCase()] = {
            username: p.username.toLowerCase(),
            password: p.password,
            id: p.id,
            last_pos: p.last_pos || [0, 2, 0]
        };
    });
    console.log(`[Sistema] Sincronização concluída! ${Object.keys(dadosLocaisDoRender).length} contas carregadas no Render.`);
    mostrarPainelNoRender();
}

function mostrarPainelNoRender() {
    const chaves = Object.keys(dadosLocaisDoRender);
    console.log("\n=======================================================");
    console.log(`📊 [MEMÓRIA LIVE DO RENDER] CONTAS ATIVAS NO JOGO (${chaves.length})`);
    console.log(`🌐 STATUS DA NUVEM BACKUP: ${banco.isNuvemOnline() ? "✅ ONLINE" : "⚠️ OFFLINE (Modo de Emergência Ativo)"}`);
    console.log("=======================================================");
    chaves.forEach((key, index) => {
        const player = dadosLocaisDoRender[key];
        console.log(`${index + 1}. 👤 ${player.username.toUpperCase()} | 🔑 ${player.password} | 🆔 ID: ${player.id} | 📍 POS: [${player.last_pos.join(', ')}]`);
    });
    console.log("=======================================================\n");
}

// Espera 4 segundos para o banco conectar e puxa os dados
setTimeout(puxarDadosDaNuvemParaORender, 4000);

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const dados = JSON.parse(message);
            
            // --- 1. REGISTRAR (SALVA NO RENDER PRIMEIRO, DEPOIS EMPURRA PRA NUVEM) ---
            if (dados.action === "register") {
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                if (!username || !password) {
                    return ws.send(JSON.stringify({ success: false, message: "Campos inválidos!" }));
                }

                // Checa na memória ultra rápida do Render se já existe
                if (dadosLocaisDoRender[username]) {
                    console.log(`[Registro] Negado: ${username} já existe na memória.`);
                    return ws.send(JSON.stringify({ success: false, message: "Esta conta já existe!" }));
                }

                // Cria o player direto na memória do Render
                const novoPlayer = {
                    username: username,
                    password: password,
                    id: 1000 + Math.floor(Math.random() * 9000),
                    last_pos: [0, 2, 0]
                };

                dadosLocaisDoRender[username] = novoPlayer;
                console.log(`\n🚀 [RENDER MEMÓRIA] Conta '${username.toUpperCase()}' criada com sucesso no servidor!`);
                
                // Envia resposta imediata para o Godot (Sem travar o jogador!)
                ws.send(JSON.stringify({ success: true, message: "Conta criada!" }));
                mostrarPainelNoRender();

                // Em segundo plano, tenta mandar para a nuvem se ela estiver viva
                banco.salvarUsuarioNaNuvem(novoPlayer).then(salvou => {
                    if (salvou) console.log(`☁️ [Nuvem Backup] Conta de '${username}' espelhada na nuvem.`);
                });
                return;
            }

            // --- 2. LOGIN (CONECTA DIRETO PELA MEMÓRIA DO RENDER - INSTANTÂNEO) ---
            if (dados.action === "login") {
                const username = String(dados.username).trim().toLowerCase();
                const password = String(dados.password).trim();

                const conta = dadosLocaisDoRender[username];

                if (conta && conta.password === password) {
                    console.log(`✅ [Reduto RP] Login bem-sucedido na memória: ${username}`);
                    ws.send(JSON.stringify({
                        success: true,
                        player_id: String(conta.id),
                        last_pos: conta.last_pos,
                        message: "Bem-vindo ao Reduto RP!"
                    }));
                } else {
                    console.log(`❌ [Reduto RP] Falha de login para o usuário: ${username}`);
                    ws.send(JSON.stringify({ success: false, message: "Usuário ou Senha incorreta!" }));
                }
                return;
            }

            // --- 3. SALVAR POSIÇÃO ---
            if (dados.action === "save_position") {
                const username = String(dados.username).trim().toLowerCase();
                if (username && dados.pos && dadosLocaisDoRender[username]) {
                    dadosLocaisDoRender[username].last_pos = dados.pos;
                    
                    // Salva na nuvem em segundo plano
                    banco.salvarUsuarioNaNuvem(dadosLocaisDoRender[username]);
                }
                return;
            }

            // --- 4. MULTIPLAYER EM TEMPO REAL ---
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (erro) {}
    });
});

process.on('uncaughtException', (err) => {
    console.log('[Segurança] Erro interceptado:', err.message);
});
