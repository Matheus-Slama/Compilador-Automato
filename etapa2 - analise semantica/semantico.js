const fs = require('fs');
const path = require('path');

const CAMINHO_TS_ENTRADA = path.join(__dirname, '..', 'etapa1 - reconhecimento sintatico', 'saidas', 'tabela_simbolos.json');
const CAMINHO_RESULTADO_SINTATICO = path.join(__dirname, '..', 'etapa1 - reconhecimento sintatico', 'saidas', 'resultado_sintatico.json');
const CAMINHO_SAIDAS = path.join(__dirname, 'saidas');
const CAMINHO_TS_SEMANTICA = path.join(CAMINHO_SAIDAS, 'tabela_simbolos_semantica.json');
const CAMINHO_RESULTADO = path.join(CAMINHO_SAIDAS, 'resultado_semantico.json');

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

// Agrupa a tabela de simbolos em comandos sintaticos para a analise semantica.
function classificarComandos(tabelaSimbolos) {
  const comandos = [];
  let indice = 0;

  while (indice < tabelaSimbolos.length) {
    const atual = tabelaSimbolos[indice];

    if (atual.terminalParser === 'se') {
      comandos.push({
        indice: comandos.length + 1,
        regra: 'COMANDO ::= se ID ACAO',
        tipo: 'condicional',
        inicio: indice,
        fim: indice + 2,
        identificador: tabelaSimbolos[indice + 1],
        acao: tabelaSimbolos[indice + 2],
      });
      indice += 3;
      continue;
    }

    if (atual.terminalParser === 'sai' || atual.terminalParser === 'foi') {
      comandos.push({
        indice: comandos.length + 1,
        regra: `COMANDO ::= ${atual.terminalParser} ID`,
        tipo: 'acao_direta',
        inicio: indice,
        fim: indice + 1,
        identificador: tabelaSimbolos[indice + 1],
        acao: atual,
      });
      indice += 2;
      continue;
    }

    comandos.push({
      indice: comandos.length + 1,
      regra: 'COMANDO ::= ID',
      tipo: 'declaracao_simples',
      inicio: indice,
      fim: indice,
      identificador: atual,
      acao: null,
    });
    indice += 1;
  }

  return comandos;
}

// Adiciona informacoes semanticas nos simbolos usados pelos comandos.
function enriquecerTabelaSimbolos(tabelaSimbolos, comandos) {
  const enriquecida = tabelaSimbolos.map((entrada) => ({
    ...entrada,
    categoriaSemantica: entrada.terminalParser === 'ID' ? 'identificador' : 'palavra_reservada',
    papelSemantico: null,
    comandoSemantico: null,
    simboloSemantico: entrada.terminalParser === 'ID' ? criarSimboloSemantico(entrada.lexema) : null,
    semanticamenteValido: true,
    observacoesSemanticas: [],
  }));

  for (const comando of comandos) {
    for (let indice = comando.inicio; indice <= comando.fim; indice += 1) {
      enriquecida[indice].comandoSemantico = comando.indice;
    }

    if (comando.tipo === 'condicional') {
      enriquecida[comando.inicio].papelSemantico = 'inicio_condicional';
      enriquecida[comando.inicio + 1].papelSemantico = 'condicao';
      enriquecida[comando.inicio + 2].papelSemantico = 'acao_condicional';
    }

    if (comando.tipo === 'acao_direta') {
      enriquecida[comando.inicio].papelSemantico = 'acao_direta';
      enriquecida[comando.inicio + 1].papelSemantico = 'alvo_acao';
    }

    if (comando.tipo === 'declaracao_simples') {
      enriquecida[comando.inicio].papelSemantico = 'declaracao_simples';
    }
  }

  return enriquecida;
}

// Valida a regra semantica escolhida: identificadores nao podem se repetir.
function validarIdentificadoresUnicos(tabelaSimbolos) {
  const erros = [];
  const ocorrencias = new Map();

  for (const entrada of tabelaSimbolos.filter((item) => item.terminalParser === 'ID')) {
    if (!ocorrencias.has(entrada.lexema)) {
      ocorrencias.set(entrada.lexema, []);
    }

    ocorrencias.get(entrada.lexema).push(entrada.indiceFita);
  }

  for (const [lexema, indices] of ocorrencias.entries()) {
    if (indices.length > 1) {
      erros.push({
        lexema,
        indicesFita: indices,
        mensagem: `Identificador '${lexema}' apareceu mais de uma vez na entrada.`,
      });
    }
  }

  return erros;
}

// Marca na tabela de simbolos quais entradas falharam na validacao semantica.
function aplicarErrosNaTabela(tabelaSimbolos, erros) {
  const lexemasComErro = new Set(erros.map((erro) => erro.lexema));

  return tabelaSimbolos.map((entrada) => {
    if (entrada.terminalParser !== 'ID' || !lexemasComErro.has(entrada.lexema)) {
      return entrada;
    }

    return {
      ...entrada,
      semanticamenteValido: false,
      observacoesSemanticas: [
        ...entrada.observacoesSemanticas,
        'Identificador duplicado.',
      ],
    };
  });
}

// 1 - Le o resultado sintatico e a tabela de simbolos.
// 2 - Valida a regra semantica e enriquece a tabela de simbolos.
// 3 - Salva o resultado semantico e a tabela enriquecida em JSON.
function executar() {
  garantirDiretorioSaidas();

  // #1
  const resultadoSintatico = lerJson(CAMINHO_RESULTADO_SINTATICO);
  if (!resultadoSintatico.aceito) {
    throw new Error('A Etapa 2 depende de uma entrada aceita pelo analisador sintatico.');
  }

  const tabelaSimbolos = lerJson(CAMINHO_TS_ENTRADA);

  // #2
  const comandos = classificarComandos(tabelaSimbolos);
  const erros = validarIdentificadoresUnicos(tabelaSimbolos);
  const tabelaEnriquecida = aplicarErrosNaTabela(
    enriquecerTabelaSimbolos(tabelaSimbolos, comandos),
    erros,
  );

  const resultado = {
    aceito: erros.length === 0,
    caracteristicaSemantica: 'Os identificadores da entrada devem ser unicos.',
    comandosReconhecidos: comandos.map((comando) => ({
      indice: comando.indice,
      regra: comando.regra,
      tipo: comando.tipo,
      identificador: comando.identificador?.lexema ?? null,
      acao: comando.acao?.terminalParser ?? null,
    })),
    erros,
  };

  // #3
  fs.writeFileSync(CAMINHO_TS_SEMANTICA, JSON.stringify(tabelaEnriquecida, null, 2));
  fs.writeFileSync(CAMINHO_RESULTADO, JSON.stringify(resultado, null, 2));

  console.log(`Caracteristica: ${resultado.caracteristicaSemantica}`);
  console.log(`Resultado: ${resultado.aceito ? 'ACEITE' : 'ERRO SEMANTICO'}`);

  if (erros.length > 0) {
    console.table(erros);
  }

  console.log('Arquivos gerados em etapa2 - analise semantica/saidas/.');
  return resultado.aceito;
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar a Etapa 2:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
