const fs = require('fs');
const path = require('path');

const CAMINHO_RESULTADO_SEMANTICO = path.join(__dirname, '..', 'etapa2 - analise semantica', 'saidas', 'resultado_semantico.json');
const CAMINHO_SAIDAS = path.join(__dirname, 'saidas');
const CAMINHO_CODIGO_JSON = path.join(CAMINHO_SAIDAS, 'codigo_intermediario.json');
const CAMINHO_RESULTADO = path.join(CAMINHO_SAIDAS, 'resultado_geracao.json');

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

function criarSimboloSemantico(lexema) {
  return `id_${lexema}`;
}

// Converte os comandos reconhecidos em instrucoes intermediarias simples.
function gerarLinhas(comandos) {
  const linhas = [];

  for (const comando of comandos) {
    const simbolo = comando.identificador ? criarSimboloSemantico(comando.identificador) : null;

    if (comando.tipo === 'condicional') {
      linhas.push({
        comando: comando.indice,
        regra: comando.regra,
        codigo: `IF ${simbolo} THEN ${comando.acao}`,
      });
      linhas.push({
        comando: comando.indice,
        regra: comando.regra,
        codigo: 'NOP',
      });
      continue;
    }

    if (comando.tipo === 'acao_direta') {
      linhas.push({
        comando: comando.indice,
        regra: comando.regra,
        codigo: `${comando.acao.toUpperCase()} ${simbolo}`,
      });
      linhas.push({
        comando: comando.indice,
        regra: comando.regra,
        codigo: 'NOP',
      });
      continue;
    }

    linhas.push({
      comando: comando.indice,
      regra: comando.regra,
      codigo: `DECL ${simbolo}`,
    });
    linhas.push({
      comando: comando.indice,
      regra: comando.regra,
      codigo: `${simbolo} = ${simbolo}`,
    });
  }

  return linhas;
}

// 1 - Le os comandos aceitos pela analise semantica.
// 2 - Transforma cada comando em instrucoes intermediarias simples.
// 3 - Salva o resultado em codigo_intermediario.json.
function executar() {
  garantirDiretorioSaidas();

  // #1
  const resultadoSemantico = lerJson(CAMINHO_RESULTADO_SEMANTICO);
  if (!resultadoSemantico.aceito) {
    throw new Error('A Etapa 3 depende de uma entrada aceita pela analise semantica.');
  }

  // #2
  const linhas = gerarLinhas(resultadoSemantico.comandosReconhecidos);
  const resultado = {
    gerado: true,
    regraDemonstrada: 'COMANDO',
    totalLinhas: linhas.length,
    arquivos: [
      'codigo_intermediario.json',
    ],
  };

  // #3
  fs.writeFileSync(CAMINHO_CODIGO_JSON, JSON.stringify(linhas, null, 2));
  fs.writeFileSync(CAMINHO_RESULTADO, JSON.stringify(resultado, null, 2));

  console.log(linhas.map((linha) => linha.codigo).join('\n'));
  console.log('Arquivos gerados em etapa3 - codigo intermediario/saidas/.');
  return true;
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar a Etapa 3:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
