const fs = require("fs");

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
function salvarServico(data) {
  const filePath = './database/servicos.json';

  fs.readFile(filePath, 'utf8', (err, fileData) => {
    let servicos = [];

    if (!err) {
      servicos = JSON.parse(fileData || '[]');
    }

    servicos.push(data);

    fs.writeFile(filePath, JSON.stringify(servicos, null, 2), (err) => {
      if (err) console.error('Erro ao salvar dados:', err);
      else console.log('Dados salvos com sucesso!');
    });
  });
}

module.exports = { salvarServico, salvarUsuario };
