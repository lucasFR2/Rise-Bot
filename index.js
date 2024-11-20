const fs = require("fs");
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
} = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const pairingCode = false;
const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    qrTimeout: 180000,
    logger: pino({ level: "silent" }),
    browser: ["Chrome (Linux)", "", ""],
    msgRetryCounterCache,
    connectTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!message?.interactiveMessage;
      if (requiresPatch) {
        message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
              },
              ...message,
            },
          },
        };
      }
      return message;
    },
  });

  const chalk = require('chalk');
  const delayTime = 6000;

  function delayedLog(message, delay) {
    setTimeout(() => {
      console.log(message);
    }, delay);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (!pairingCode && qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "conexão fechada devido a ",
        lastDisconnect.error,
        ", reconectando ",
        shouldReconnect
      );
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      delayedLog(chalk.bold("RiseBot | Iniciando o bot..."), 1000);
      delayedLog(chalk.bold("RiseBot | Carregando Funções..."), 2000);
      delayedLog(chalk.bold("RiseBot | Conectando ao WhatsApp..."), 2300);
      delayedLog(chalk.bold("RiseBot | Conectado com sucesso!"), 2400);
    }
  });

  // Estado do menu e coleta de dados do usuário
  const menuState = {};
  const userData = {};

  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    console.log("Mensagem recebida:", message);

    const remoteJid = message.key.remoteJid;
    const sender = message.key.participant || remoteJid;

    console.log("Sender:", sender);

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

    if (
      text === "oi" ||
      text === "ola" ||
      text === "boa tarde" ||
      text === "bom dia" ||
      text === "boa noite"
    ) {
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
          await sock.sendMessage(sender, {
            text: `
[*1*] - Serviços         
[*2*] - Agendar serviço
[*3*] - Fazer cadastro
            `,
          });
        } catch (error) {
          console.error("Erro ao enviar mensagem:", error);
        }
      }, delayTime * 3);
    } else if (menuState[sender] === 'main') {
      const selection = parseInt(text);

      if (!isNaN(selection)) {
        if (selection === 1 || selection === 'servicos') {
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
          setTimeout(async () => {
            await sock.sendMessage(sender, {
              text: "Você escolheu agendar um serviço. Por favor, forneça os detalhes do serviço que deseja agendar.",
            });
          }, delayTime);
          menuState[sender] = null;
        } else if (selection === 3) {
          userData[sender] = { nome: "", cpf: "", endereco: "", telefone: sender };
          setTimeout(async () => {
            await sock.sendMessage(sender, {
              text: "Qual é o seu nome?",
            });
          }, delayTime);

          menuState[sender] = 'cadastro_nome';
        } else {
          setTimeout(async () => {
            await sock.sendMessage(sender, {
              text: "Seleção inválida. Por favor, escolha 1 ou 2.",
            });
          }, delayTime);
        }
      }
    } else if (menuState[sender] === 'cadastro_nome' && text !== "qual é o seu nome?") {
      userData[sender].nome = text;
      await sock.sendMessage(sender, {
        text: "Por favor, informe o seu CPF.",
      });
      menuState[sender] = 'cadastro_cpf';
    } else if (menuState[sender] === 'cadastro_cpf' && text !== "por favor, informe o seu cpf.") {
      userData[sender].cpf = text;
      await sock.sendMessage(sender, {
        text: "Por favor, informe o seu endereço.",
      });
      menuState[sender] = 'cadastro_endereco';
    } else if (menuState[sender] === 'cadastro_endereco' && text !== "por favor, informe o seu endereço.") {
      userData[sender].endereco = text;

      salvarUsuario(userData[sender]);

      await sock.sendMessage(sender, {
        text: "Cadastro realizado com sucesso!",
      });

      menuState[sender] = null;
    }
  });

  function salvarUsuario(data) {
    const filePath = './database/usuarios.json';

    fs.readFile(filePath, 'utf8', (err, fileData) => {
      let usuarios = [];

      if (!err) {
        usuarios = JSON.parse(fileData || '[]');
      }

      usuarios.push(data);

      fs.writeFile(filePath, JSON.stringify(usuarios, null, 2), (err) => {
        if (err) console.error('Erro ao salvar dados:', err);
        else console.log('Dados salvos com sucesso!');
      });
    });
  }

  sock.ev.on("creds.update", saveCreds);
}

connectToWhatsApp();