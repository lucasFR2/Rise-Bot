module.exports = { sendShowUsers, sendAdminMenu, delayedLog, sendMainMenu, sendVerificarCadastro, agendarServico };
const delayTime = 6000;
const { delay } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const fs = require('fs/promises');
const path = require('path');
const menuState = {}; 
const userData = {}; 
const { salvarServico } = require('./user');


function delayedLog(message, delay) {
  setTimeout(() => {
    console.log(message);
  }, delay);
}

async function sendAdminMenu(sock, sender) {
  setTimeout(async () => {
    await sock.sendMessage(sender, {
      text: `
            *Menu Administrador*

Digite *1* para - Ver usuários         
Digite *2* para - Ver serviços agendados
Digite *3* para - Excluir usuário
      `,
    });
  }, delayTime);
}
async function sendShowUsers(sock, sender) {
  const filePath = path.join(__dirname, './../../database/usuarios.json');

  console.log("Caminho do arquivo:", filePath);
  
  try {

    const data = await fs.readFile(filePath, 'utf8');

    const usuarios = JSON.parse(data);
    
    if (usuarios.length === 0) {
      await sock.sendMessage(sender, {
        text: 'Não há usuários cadastrados.',
      });
      return;
    }

    let mensagem = '*USUÁRIOS CADASTRADOS*\n\n';
    usuarios.forEach((usuario, index) => {
      mensagem += `Usuário ${index + 1}:\n`;
      mensagem += `*Nome*: ${usuario.nome}\n`;
      mensagem += `*CPF*: ${usuario.cpf}\n`;
      mensagem += `*Endereço*: ${usuario.endereco}\n\n`;
      mensagem += `*Telefone*: ${usuario.telefone}\n\n`;
    });

    await sock.sendMessage(sender, { text: mensagem });
  } catch (error) {
    console.error('Erro ao ler ou processar o arquivo JSON:', error);
    await sock.sendMessage(sender, {
      text: 'Desculpe, houve um erro ao tentar carregar os dados.',
    });
  }
}

async function sendMainMenu(sock, sender) {
  setTimeout(async () => {
    await sock.sendMessage(sender, {
      text: `
Digite *1* para - Serviços         
Digite *2* para - Agendar serviço
Digite *3* para - Fazer cadastro
      `,
    });
  }, delayTime);
}

async function sendVerificarCadastro(sock, sender) {
  setTimeout(async () => {
    await sock.sendMessage(sender, {
      text: `Por favor, informe o seu *CPF* para verificarmos seu cadastro.`,
    });

    sock.ev.on('messages.upsert', async (msg) => {
      const message = msg.messages[0];  // Definir a mensagem recebida
      if (!message || !message.key) return; // Se não tiver chave ou mensagem, não faz nada

      const conversation = message.message.conversation ? message.message.conversation.trim() : null;

      // Verifica se o usuário quer voltar ao menu principal
      if (conversation === 'voltar') {
        setTimeout(async () => {
          menuState[sender] = 'main';  // Voltar ao menu principal
          await sendMainMenu(sock, sender);  // Envia o menu principal
        }, delayTime);
        return;
      }

      // Verificação do CPF
      if (conversation && conversation !== 'voltar') {
        const cpfRegex = /^\d{11}$/; // Verifica se o CPF tem 11 dígitos
        if (!cpfRegex.test(conversation)) {
          await sock.sendMessage(sender, {
            text: 'Por favor, informe um CPF válido, com 11 dígitos.',
          });
          return;
        }

        try {
          // Caminho do arquivo de usuários
          const filePath = path.resolve(__dirname, './../../database/usuarios.json');
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const usuarios = JSON.parse(fileContent);

          // Verifica se o CPF existe no banco de dados
          const usuario = usuarios.find(u => u.cpf === conversation);

          if (usuario) {
            const nomeCapitalizado = usuario.nome.charAt(0).toUpperCase() + usuario.nome.slice(1).toLowerCase();
            setTimeout(async () => {
              await sock.sendMessage(sender, {
                text: `Olá, *${nomeCapitalizado}*! Encontramos seu cadastro. Agora podemos continuar com o agendamento de serviços.`,
              });
            }, delayTime);
            await agendarServico(sock, sender, menuState, userData);
          } else {
            // CPF não encontrado
            await sock.sendMessage(sender, {
              text: 'Não encontramos seu cadastro. Digite *voltar* para acessar o menu de cadastro.',
            });
          }
        } catch (error) {
          console.error('Erro ao verificar o CPF:', error);
          await sock.sendMessage(sender, {
            text: 'Desculpe, ocorreu um erro ao verificar seu CPF. Tente novamente.',
          });
        }
      }
    });
    
  }, delayTime);
}

async function agendarServico(sock, sender, menuState, userData) {
    const text = (
      message.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
      message.message?.extendedTextMessage?.text ||
      message.message?.conversation ||
      ""
    ).toLowerCase();

  menuState[sender] = 'agendar_servico';
  setTimeout(async () => {
    await sock.sendMessage(sender, {
      text: `Primeiro precisamos saber qual o problema que consta em seu veículo.

Informe detalhadamente o problema que você está enfrentando e informe o seu veículo com modelo, ano.`,
    });
  }, delayTime);
  if (menuState[sender] === 'agendar_servico' && text !== 'primeiro precisamos saber qual o problema que consta em seu veículo. informe detalhadamente o problema que você está enfrentando e informe o seu veículo com modelo, ano.') {
    console.log(`Recebido: ${text} de ${sender}`);
    userData[sender].servico = text;
    await sock.sendMessage(sender, {
      text: `Entendi! Agora, precisamos que você informe o horário e a data que deseja agendar o serviço.`,
    }, delayTime);
    menuState[sender] = 'agendar_data';
  } else if (menuState[sender] === 'agendar_data' && text !== "entendi! agora, precisamos que você informe o horário e a data que deseja agendar o serviço.") {
    console.log(`Recebido: ${text} de ${sender}`);
    userData[sender].data = text;

    salvarServico(userData[sender]);

    setTimeout(async () => {
      await sock.sendMessage(sender, {
        text: `Informações recebidas com sucesso!`,
      });
    }, delayTime);
    setTimeout(async () => {
      await sock.sendMessage(sender, {
        text: "*Armazenando informações...*"
      });
    }, delayTime * 2);
    setTimeout(async () => {
      await sock.sendMessage(sender, {
        text: "*Pronto! Serviço agendado com sucesso.*"
      });
    }, delayTime * 3);
  }
}
//tentar fazer funcionar depois
/*async function processarCadastro(sock, sender, text, menuState, userData) {
  console.log(`Recebido: ${text} de ${sender}`);
  
  // Processo de envio inicial do menu de cadastro
  if (text === '3' && !userData[sender]) {
    console.log("Iniciando cadastro...");
    console.log("Enviando mensagem para: ", sender);
    console.log("Menu de cadastro de usuário sendo enviado...");
    userData[sender] = { nome: "", cpf: "", endereco: "", telefone: sender };

    // Envio da primeira mensagem (nome)
    await sock.sendMessage(sender, {
      text: `Certo! Vamos começar o seu cadastro. Para começar, por favor, informe o seu nome *COMPLETO*.`,
    });
    
    menuState[sender] = 'cadastro_nome'; // Mudando o estado do menu
    return;
  }

  // Se estamos no estado de cadastro de nome
  if (menuState[sender] === 'cadastro_nome' && text !== "certo! vamos começar o seu cadastro. para começar, por favor, informe o seu nome *completo*.") {
    console.log("Nome recebido: ", text);
    userData[sender].nome = text;

    // Enviando confirmação e pedindo CPF
    await sock.sendMessage(sender, {
      text: "*Certo...*",
    });
    await sock.sendMessage(sender, {
      text: `Agora, preciso que me informe o seu *CPF*.`,
    });

    menuState[sender] = 'cadastro_cpf';
    return;
  }

  // Se estamos no estado de cadastro de CPF
  if (menuState[sender] === 'cadastro_cpf' && text !== "*certo...*" && text !== "agora, preciso que me informe o seu *cpf*.") {
    console.log("CPF recebido: ", text);
    userData[sender].cpf = text;

    // Enviando a solicitação do endereço
    await sock.sendMessage(sender, {
      text: "Estamos quase finalizando o seu cadastro! Agora, preciso que informe o seu endereço com *RUA, NÚMERO e BAIRRO*.",
    });

    menuState[sender] = 'cadastro_endereco';
    return;
  }

  // Se estamos no estado de cadastro de endereço
  if (menuState[sender] === 'cadastro_endereco' && text !== "estamos quase finalizando o seu cadastro! agora, preciso que informe o seu endereço com *rua, número e bairro*.") {
    console.log("Endereço recebido: ", text);
    userData[sender].endereco = text;

    // Salvando o usuário e enviando as mensagens finais
    salvarUsuario(userData[sender]);

    await sock.sendMessage(sender, { text: "*Só um momento...*" });
    await sock.sendMessage(sender, { text: "*Estou finalizando e enviando o seu cadastro para nosso banco de dados...*" });
    await sock.sendMessage(sender, { text: "*Pronto! Cadastro realizado com sucesso.*" });
    await sock.sendMessage(sender, { text: "Agora, para exibir as opções do menu, digite *voltar*." });

    menuState[sender] = 'wantBack'; // Estado aguardando o "voltar"
    return;
  }

  // Se estamos no estado de aguardar "voltar"
  if (menuState[sender] === 'wantBack' && text === "voltar") {
    console.log("Voltar para o menu principal...");
    menuState[sender] = 'main'; // Retorna ao menu principal
    await sock.sendMessage(sender, { text: "Menu principal" }); // Simulando a mensagem de menu principal
    return;
  }

  console.log(`Nenhuma correspondência para o texto: ${text}`);
} */


