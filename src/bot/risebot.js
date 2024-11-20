const authenticate = require('../auth/auth');
const { sendShowUsers, sendAdminMenu, sendMainMenu, sendVerificarCadastro, delayedLog, agendarServico } = require('./menu');
const { salvarUsuario } = require('./user');
const { delayTime } = require('../config/config');
const { DisconnectReason } = require('@whiskeysockets/baileys');
const generateQRCode = require('../utils/qrCodeGenerator');

const menuState = {};
const userData = {};  

async function connectToWhatsApp() {
  const sock = await authenticate();

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      generateQRCode(qr);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão fechada devido a ", lastDisconnect.error, ", reconectando ", shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      delayedLog("RiseBot | Iniciando o bot...", 1000);
      delayedLog("RiseBot | Carregando Funções...", 2000);
      delayedLog("RiseBot | Conectando ao WhatsApp...", 2300);
      delayedLog("RiseBot | Conectado com sucesso!", 2400);
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    console.log("Usuario: ", message.key.remoteJid);
    console.log("Mensagem recebida:", message);
    const sender = message.key.participant || message.key.remoteJid;
    const text = (
      message.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
      message.message?.extendedTextMessage?.text ||
      message.message?.conversation ||
      ""
    ).toLowerCase();

    if (!text) {
      console.log("Mensagem não é de texto ou está vazia.");
      return;
    }

    if (["oi", "ola", "boa tarde", "bom dia", "boa noite"].includes(text)) {
      const imagePath = './assets/logo.jpg';
      setTimeout(async () => {
        try {
          console.log(`Enviando mensagem para: ${sender}`);
          await sock.sendMessage(sender, {
            image: { url: imagePath },
            caption: "Olá, tudo bem? Somos da mecânica EninCar, a melhor de Monte Carmelo-MG!",
          });
        } catch (error) {
          console.error("Erro ao enviar mensagem:", error);
        }
      }, delayTime);

      setTimeout(async () => {
        try {
          await sock.sendMessage(sender, {
            text: "No que podemos ajudar? ()",
          });
        } catch (error) {
          console.error("Erro ao enviar mensagem:", error);
        }
      }, delayTime * 2);

      setTimeout(async () => {
        try {
          menuState[sender] = 'main';
          await sendMainMenu(sock, sender);
        } catch (error) {
          console.error("Erro ao enviar mensagem:", error);
        }
      }, delayTime * 3);
    } else if (menuState[sender] === 'main') {
      const selection = parseInt(text);

      if (!isNaN(selection)) {
        if (selection === 1) {
          setTimeout(async () => {
            await sock.sendMessage(sender, {
              text: `Você escolheu saber mais sobre serviços. Aqui estão os nossos serviços:
              
- Troca de óleo
- Alinhamento e balanceamento
- Revisão completa`,
            });
          }, delayTime);
          menuState[sender] = null;
        } else if (selection === 2) {          
            // Exemplo de menu principal
            if (menuState[sender] === 'main') {
              if (text === '2') {
                menuState[sender] = 'agendar_servico'; // Atualiza o estado
                await sendVerificarCadastro(sock, sender); // Chama a função
              }
            }
          
            // Exemplo de fluxo de resposta dentro do estado "agendar_servico"
            else if (menuState[sender] === 'agendar_servico') {
              // Aqui o CPF será processado, já implementado na função `sendVerificarCadastro`.
              // O CPF será capturado automaticamente pelo `sock.once` no código anterior.
            }

          menuState[sender] = null;
        } else if (selection === 3) {
          console.log("Enviando mensagem para: ", sender);
          console.log("Menu de cadastro de usuário sendo enviado...");
          userData[sender] = { nome: "", cpf: "", endereco: "", telefone: sender };
          setTimeout(async () => {
            await sock.sendMessage(sender, {
              text: `Certo! Vamos começar o seu cadastro. Para começar, por favor, informe o seu nome *COMPLETO*.`,
            });
          }, delayTime);

          menuState[sender] = 'cadastro_nome';
        } 
        if (selection === 1602) {
          if (message.key.remoteJid === "553488381132@s.whatsapp.net") {
            setTimeout(async () => {
              try {
                menuState[sender] = 'menuAdmin';
                await sendAdminMenu(sock, sender); // Envia o menu para o admin
              } catch (error) {
                console.error("Erro ao enviar mensagem:", error);
              }
            }, delayTime);
        
            // Configura o ouvinte de mensagem fora da função
            sock.ev.on("messages.upsert", async (msg) => {
              const message = msg.messages[0];
              if (message && message.message && message.message.conversation === '1') {
                setTimeout(async () => {
                  await sendShowUsers(sock, sender); 
                }, delayTime);
              }
              if (message.message.conversation === 'desligar') {
                console.log('Comando de desligamento recebido. Desconectando...');
                
                setTimeout(async () => {
                  await sock.sendMessage(message.key.remoteJid, { 
                    text: 'Bot desligado. Até logo!', 
                  });
                });
                
                process.exit(0);
              }
            });
          }
        }
        
      }
    } else if (menuState[sender] === 'cadastro_nome' && text !== "certo! vamos começar o seu cadastro. para começar, por favor, informe o seu nome *completo*.") {
      userData[sender].nome = text;
      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "*Certo...*",
        });
      }, delayTime);
      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: `Agora, preciso que me informe o seu *CPF*.`,
        });
      }, delayTime * 2);
      menuState[sender] = 'cadastro_cpf';
    } else if (menuState[sender] === 'cadastro_cpf'&& text !== "*certo...*" && text !== "agora, preciso que me informe o seu *cpf*.") {
      userData[sender].cpf = text;

      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "Estamos quase finalizando o seu cadastro! Agora, preciso que informe o seu endereço com *RUA, NÚMERO e BAIRRO*.",
        });  
      }, delayTime);
      
      menuState[sender] = 'cadastro_endereco';
    } else if (menuState[sender] === 'cadastro_endereco' && text !== "estamos quase finalizando o seu cadastro! agora, preciso que informe o seu endereço com *rua, número e bairro*.") {
      userData[sender].endereco = text;

      salvarUsuario(userData[sender]);

      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "*Só um momento...*",
        });
      }, delayTime);
      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "*Estou finalizando e enviando o seu cadastro para nosso banco de dados...*",
        });
      }, delayTime * 2);
      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "*Pronto! Cadastro realizado com sucesso.*",
        });
      }, delayTime * 3);
      setTimeout(async () => {
        await sock.sendMessage(sender, {
          text: "Agora, para exibir as opções do menu, digite *voltar*.",
        });
      }, delayTime * 4);
      menuState[sender] = 'wantBack';
    } else if (menuState[sender] === 'wantBack' && text === "voltar" && text !== "agora, para exibir as opções do menu, digite *voltar*.") {
      menuState[sender] = 'main';
      await sendMainMenu(sock, sender);
    }
  });
}

connectToWhatsApp();
