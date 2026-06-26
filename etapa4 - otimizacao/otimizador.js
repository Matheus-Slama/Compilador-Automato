const fs = require('fs');
const path = require('path');

const CAMINHO_CODIGO_ENTRADA = path.join(__dirname, '..', 'etapa3 - codigo intermediario', 'saidas', 'codigo_intermediario.json');
const CAMINHO_SAIDAS = path.join(__dirname, 'saidas');
const CAMINHO_CODIGO_JSON = path.join(CAMINHO_SAIDAS, 'codigo_otimizado.json');
const CAMINHO_RESULTADO = path.join(CAMINHO_SAIDAS, 'resultado_otimizacao.json');

function lerJson(caminho) {
  if (!fs.existsSync(caminho)) {
    throw new Error(`Arquivo nao encontrado: ${path.basename(caminho)}`);
  }

  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

function garantirDiretorioSaidas() {
  if (!fs.existsSync(CAMINHO_SAIDAS)) {
    fs.mkdirSync(CAMINHO_SAIDAS, { recursive: true });
  }
}

// Verifica atribuicoes sem efeito, como "id_x = id_x".
function ehAtribuicaoRedundante(codigo) {
  const partes = codigo.split('=').map((parte) => parte.trim());
  return partes.length === 2 && partes[0] === partes[1];
}

// Otimiza removendo NOP e atribuicoes redundantes, mantendo apenas instrucoes uteis.
function otimizar(linhas) {
  const removidas = [];
  const otimizadas = [];

  for (const linha of linhas) {
    if (linha.codigo === 'NOP') {
      removidas.push({
        ...linha,
        motivo: 'Instrucao NOP removida.',
      });
      continue;
    }

    if (ehAtribuicaoRedundante(linha.codigo)) {
      removidas.push({
        ...linha,
        motivo: 'Atribuicao redundante removida.',
      });
      continue;
    }

    otimizadas.push(linha);
  }

  return { otimizadas, removidas };
}

// 1 - Le o codigo intermediario gerado na Etapa 3.
// 2 - Remove instrucoes sem efeito do codigo intermediario.
// 3 - Salva o codigo otimizado e o resumo da otimizacao em JSON.
function executar() {
  garantirDiretorioSaidas();

  // #1
  const codigoIntermediario = lerJson(CAMINHO_CODIGO_ENTRADA);

  // #2
  const { otimizadas, removidas } = otimizar(codigoIntermediario);
  const resultado = {
    estrategia: 'Remocao de NOP e de atribuicoes redundantes do tipo x = x.',
    linhasAntes: codigoIntermediario.length,
    linhasDepois: otimizadas.length,
    linhasRemovidas: removidas.length,
    removidas,
  };

  // #3
  fs.writeFileSync(CAMINHO_CODIGO_JSON, JSON.stringify(otimizadas, null, 2));
  fs.writeFileSync(CAMINHO_RESULTADO, JSON.stringify(resultado, null, 2));

  console.log(`Estrategia: ${resultado.estrategia}`);
  console.log(`Linhas antes: ${resultado.linhasAntes}`);
  console.log(`Linhas depois: ${resultado.linhasDepois}`);
  console.log('Arquivos gerados em etapa4 - otimizacao/saidas/.');
  return true;
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar a Etapa 4:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
