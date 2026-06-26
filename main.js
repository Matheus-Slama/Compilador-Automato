const { executar: executarLexico } = require('./etapa0 - analisador lexico/afd');
const { executar: executarSintatico } = require('./etapa1 - reconhecimento sintatico/parser_slr');
const { executar: executarSemantico } = require('./etapa2 - analise semantica/semantico');
const { executar: executarGeradorIntermediario } = require('./etapa3 - codigo intermediario/gerador_intermediario');
const { executar: executarOtimizador } = require('./etapa4 - otimizacao/otimizador');

function executar() {
  console.log('=== ETAPA 0 - ANALISADOR LEXICO ===');
  executarLexico();

  console.log('\n=== ETAPA 1 - RECONHECIMENTO SINTATICO ===');
  executarSintatico();

  console.log('\n=== ETAPA 2 - ANALISE SEMANTICA ===');
  executarSemantico();

  console.log('\n=== ETAPA 3 - CODIGO INTERMEDIARIO ===');
  executarGeradorIntermediario();

  console.log('\n=== ETAPA 4 - OTIMIZACAO ===');
  executarOtimizador();
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar o projeto:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
