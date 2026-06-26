const fs = require('fs');
const path = require('path');

const CAMINHO_RAIZ = path.join(__dirname, '..');
const CAMINHO_TOKENS = path.join(__dirname, 'tokens.txt');
const CAMINHO_ENTRADA = path.join(__dirname, 'main_entrada.txt');
const CAMINHO_SAIDAS = path.join(CAMINHO_RAIZ, 'etapa1 - reconhecimento sintatico', 'saidas');
const CAMINHO_FITA_JSON = path.join(CAMINHO_SAIDAS, 'fita_saida_lexica.json');
const CAMINHO_TS_JSON = path.join(CAMINHO_SAIDAS, 'tabela_simbolos.json');

const ESTADO_INICIAL = 'S';
const ESTADO_ERRO = 'X';

let ALFABETO = [];
let PRODUCOES = {};
let TOKENS_LITERAIS = [];

let ESTADOS_AFND = new Map();
let ORDEM_ESTADOS_AFND = [];

let ESTADOS_AFD = [];
let MAPA_ESTADOS_AFD = new Map();

let FITA_SAIDA = [];
let FITA_PARSER = [];
let TABELA_DE_SIMBOLOS = [];

let NOMES_BASE_ESTADOS = [];
let MAPA_NAO_TERMINAIS = new Map();

function resetarEstruturas() {
  ALFABETO = [];
  PRODUCOES = {};
  TOKENS_LITERAIS = [];

  ESTADOS_AFND = new Map();
  ORDEM_ESTADOS_AFND = [];

  ESTADOS_AFD = [];
  MAPA_ESTADOS_AFD = new Map();

  FITA_SAIDA = [];
  FITA_PARSER = [];
  TABELA_DE_SIMBOLOS = [];

  NOMES_BASE_ESTADOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .filter((letra) => letra !== ESTADO_INICIAL && letra !== ESTADO_ERRO);

  MAPA_NAO_TERMINAIS = new Map();
}

// Parte 1 - Funcoes auxiliares para gerenciar estados do AFND/AFD.
function reservarNomeEstado(nome) {
  NOMES_BASE_ESTADOS = NOMES_BASE_ESTADOS.filter((letra) => letra !== nome);
}

function nomeJaFoiUsado(nome) {
  return ESTADOS_AFND.has(nome);
}

function proximoNomeEstado() {
  while (NOMES_BASE_ESTADOS.length > 0) {
    const proximoNome = NOMES_BASE_ESTADOS.shift();

    if (!nomeJaFoiUsado(proximoNome)) {
      return proximoNome;
    }
  }

  throw new Error('Não há nomes de estados AFND disponíveis.');
}

function addSimboloAlfabeto(simbolo) {
  if (!ALFABETO.includes(simbolo)) {
    ALFABETO.push(simbolo);
  }
}

function indiceEstadoNaOrdem(nomeEstado) {
  const indice = ORDEM_ESTADOS_AFND.indexOf(nomeEstado);
  return indice === -1 ? Number.MAX_SAFE_INTEGER : indice;
}

function ordenarEstadosNaOrdem(nomesEstados) {
  return [...nomesEstados].sort((nomeA, nomeB) => {
    const indiceA = indiceEstadoNaOrdem(nomeA);
    const indiceB = indiceEstadoNaOrdem(nomeB);

    if (indiceA !== indiceB) {
      return indiceA - indiceB;
    }

    return nomeA.localeCompare(nomeB);
  });
}

function nomeEstadoComposto(conjunto) {
  const estadosNaOrdem = ordenarEstadosNaOrdem([...conjunto]);

  if (estadosNaOrdem.length === 1) {
    return estadosNaOrdem[0];
  }

  return `[${estadosNaOrdem.join('')}]`;
}

function nomeExibicaoEstado(nomeEstado, ehFinal) {
  const ehInicial = nomeEstado === ESTADO_INICIAL;
  const temAsterisco = ehFinal || nomeEstado === ESTADO_ERRO;

  return `${ehInicial ? '->' : ''}${temAsterisco ? '*' : ''}${nomeEstado}`;
}

function marcarEstadoFinalAFND(nomeEstado, rotulo, prioridade) {
  const estado = criarEstadoAFND(nomeEstado);

  if (!estado.final || prioridade < estado.prioridade) {
    estado.final = true;
    estado.rotulo = rotulo;
    estado.prioridade = prioridade;
  }
}

function conjuntoEhFinal(conjuntoEstados) {
  for (const nomeEstado of conjuntoEstados) {
    const estado = ESTADOS_AFND.get(nomeEstado);

    if (estado && estado.final) {
      return true;
    }
  }

  return false;
}

function ehEstadoFinalAFD(nomeEstado) {
  const estado = MAPA_ESTADOS_AFD.get(nomeEstado);
  return Boolean(estado && estado.final);
}

function criarEstadoAFND(nomeEstado) {
  if (!ESTADOS_AFND.has(nomeEstado)) {
    ESTADOS_AFND.set(nomeEstado, {
      nome: nomeEstado,
      transicoes: {},
      final: false,
      rotulo: null,
      prioridade: Number.MAX_SAFE_INTEGER,
    });

    ORDEM_ESTADOS_AFND.push(nomeEstado);
    reservarNomeEstado(nomeEstado);
  }

  return ESTADOS_AFND.get(nomeEstado);
}

function proximoEstadoAFD(nomeEstadoAtual, simbolo) {
  const estado = MAPA_ESTADOS_AFD.get(nomeEstadoAtual);

  if (!estado) {
    return ESTADO_ERRO;
  }

  if (!ALFABETO.includes(simbolo)) {
    return ESTADO_ERRO;
  }

  return estado.transicoes[simbolo] ?? ESTADO_ERRO;
}

function addEstadoErroNoAFD() {
  const estadoErro = {
    nome: ESTADO_ERRO,
    conjunto: new Set(),
    final: false,
    rotulo: 'ERROR',
    transicoes: {},
  };

  for (const simbolo of ALFABETO) {
    estadoErro.transicoes[simbolo] = ESTADO_ERRO;
  }

  ESTADOS_AFD.push(estadoErro);
  MAPA_ESTADOS_AFD.set(ESTADO_ERRO, estadoErro);

  for (const estado of ESTADOS_AFD) {
    for (const simbolo of ALFABETO) {
      if (estado.transicoes[simbolo] === undefined) {
        estado.transicoes[simbolo] = ESTADO_ERRO;
      }
    }
  }
}

// Parte 2 - Funcoes de texto e normalizacao dos tokens usados pelo parser.
function ehSeparador(caractere) {
  return /\s/.test(caractere);
}

function ehMinuscula(caractere) {
  return /^[a-z]$/.test(caractere);
}

function ehMaiuscula(caractere) {
  return /^[A-Z]$/.test(caractere);
}

function normalizarRotuloParaTerminal(rotulo) {
  if (rotulo === 'ID') {
    return 'ID';
  }

  if (TOKENS_LITERAIS.includes(rotulo)) {
    return rotulo;
  }

  if (rotulo === 'ERROR') {
    return 'ERROR';
  }

  return rotulo;
}

function obterEstadoDoNaoTerminal(naoTerminal) {
  if (naoTerminal === ESTADO_INICIAL) {
    MAPA_NAO_TERMINAIS.set(naoTerminal, ESTADO_INICIAL);
    criarEstadoAFND(ESTADO_INICIAL);
    return ESTADO_INICIAL;
  }

  if (MAPA_NAO_TERMINAIS.has(naoTerminal)) {
    return MAPA_NAO_TERMINAIS.get(naoTerminal);
  }

  const novoEstado = proximoNomeEstado();
  MAPA_NAO_TERMINAIS.set(naoTerminal, novoEstado);
  criarEstadoAFND(novoEstado);

  return novoEstado;
}

function addTransicaoAFND(origem, simbolo, destino) {
  const estadoOrigem = criarEstadoAFND(origem);
  criarEstadoAFND(destino);

  addSimboloAlfabeto(simbolo);

  if (!estadoOrigem.transicoes[simbolo]) {
    estadoOrigem.transicoes[simbolo] = new Set();
  }

  estadoOrigem.transicoes[simbolo].add(destino);
}

// Parte 3 - Carregamento dos tokens e construcao do AFND.
// Le o arquivo tokens.txt e separa palavras literais das regras do ID.
function carregaTokens(caminhoTokens = CAMINHO_TOKENS) {
  if (!fs.existsSync(caminhoTokens)) {
    throw new Error('Arquivo tokens.txt não encontrado.');
  }

  const conteudo = fs.readFileSync(caminhoTokens, 'utf8').replace(/\r/g, '');
  const linhas = conteudo
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  if (linhas.length === 0) {
    throw new Error('O arquivo tokens.txt está vazio.');
  }

  for (const linhaOriginal of linhas) {
    if (linhaOriginal.includes('::=')) {
      const linhaSemEspacos = linhaOriginal.replace(/\s+/g, '');
      const match = linhaSemEspacos.match(/^([A-Z])::=(.+)$/);

      if (!match) {
        throw new Error(`Linha inválida na gramática: ${linhaOriginal}`);
      }

      const naoTerminal = match[1];
      const alternativas = match[2].split('|').filter(Boolean);

      PRODUCOES[naoTerminal] = alternativas;
    } else {
      TOKENS_LITERAIS.push(linhaOriginal);
    }
  }

  TOKENS_LITERAIS = [...new Set(TOKENS_LITERAIS)];
}

function verificarAlternativa(alternativaOriginal) {
  const alternativa = alternativaOriginal.replace(/\s+/g, '');

  if (alternativa === 'ε') {
    return {
      epsilon: true,
      terminais: '',
      proximoNaoTerminal: null,
    };
  }

  let terminais = '';
  let proximoNaoTerminal = null;

  for (let indice = 0; indice < alternativa.length; indice += 1) {
    const caractere = alternativa[indice];

    if (ehMinuscula(caractere)) {
      terminais += caractere;
    } else if (ehMaiuscula(caractere)) {
      if (proximoNaoTerminal === null) {
        proximoNaoTerminal = caractere;
      }
    }
  }

  return {
    epsilon: false,
    terminais,
    proximoNaoTerminal,
  };
}

function montarAFNDTokensLiterais() {
  TOKENS_LITERAIS.forEach((tokenLiteral, indiceToken) => {
    let estadoAtual = ESTADO_INICIAL;
    const caracteres = [...tokenLiteral];

    for (const simbolo of caracteres) {
      const destino = proximoNomeEstado();
      addTransicaoAFND(estadoAtual, simbolo, destino);
      estadoAtual = destino;
    }

    marcarEstadoFinalAFND(estadoAtual, tokenLiteral, indiceToken + 1);
  });
}

function montarAFNDGramatica() {
  for (const [naoTerminalOrigem, alternativas] of Object.entries(PRODUCOES)) {
    const estadoOrigem = obterEstadoDoNaoTerminal(naoTerminalOrigem);

    for (const alternativa of alternativas) {
      const { epsilon, terminais, proximoNaoTerminal } = verificarAlternativa(alternativa);

      if (epsilon) {
        marcarEstadoFinalAFND(estadoOrigem, 'ID', 1000);
        continue;
      }

      let estadoAtual = estadoOrigem;
      const caracteres = [...terminais];

      for (let indice = 0; indice < caracteres.length; indice += 1) {
        const simbolo = caracteres[indice];
        const ultimoCaractere = indice === caracteres.length - 1;

        let destino;

        if (ultimoCaractere && proximoNaoTerminal) {
          destino = obterEstadoDoNaoTerminal(proximoNaoTerminal);
        } else {
          destino = proximoNomeEstado();
        }

        addTransicaoAFND(estadoAtual, simbolo, destino);
        estadoAtual = destino;
      }

      if (!proximoNaoTerminal) {
        marcarEstadoFinalAFND(estadoAtual, 'ID', 1000);
      }
    }
  }
}

// Monta o AFND que reconhece tokens literais e identificadores.
function montarAFND() {
  criarEstadoAFND(ESTADO_INICIAL);
  MAPA_NAO_TERMINAIS.set(ESTADO_INICIAL, ESTADO_INICIAL);

  montarAFNDTokensLiterais();
  montarAFNDGramatica();
}

function rotuloDoConjunto(conjuntoEstados) {
  let melhorRotulo = null;
  let melhorPrioridade = Number.MAX_SAFE_INTEGER;

  for (const nomeEstado of conjuntoEstados) {
    const estado = ESTADOS_AFND.get(nomeEstado);

    if (!estado || !estado.final) {
      continue;
    }

    if (estado.prioridade < melhorPrioridade) {
      melhorPrioridade = estado.prioridade;
      melhorRotulo = estado.rotulo;
    }
  }

  return melhorRotulo;
}

function addEstadoAFD(conjuntoEstados) {
  const nomesOrdenados = ordenarEstadosNaOrdem([...conjuntoEstados]);
  const conjuntoOrdenado = new Set(nomesOrdenados);
  const nome = nomeEstadoComposto(conjuntoOrdenado);

  if (MAPA_ESTADOS_AFD.has(nome)) {
    return MAPA_ESTADOS_AFD.get(nome);
  }

  const estado = {
    nome,
    conjunto: conjuntoOrdenado,
    final: conjuntoEhFinal(conjuntoOrdenado),
    rotulo: rotuloDoConjunto(conjuntoOrdenado),
    transicoes: {},
  };

  ESTADOS_AFD.push(estado);
  MAPA_ESTADOS_AFD.set(nome, estado);

  return estado;
}

function obterRotuloDoEstadoAFD(nomeEstado) {
  const estado = MAPA_ESTADOS_AFD.get(nomeEstado);

  if (!estado || !estado.rotulo) {
    return 'ERROR';
  }

  return estado.rotulo;
}

function obterDestinosAFND(conjuntoEstados, simbolo) {
  const destinos = new Set();

  for (const nomeEstado of conjuntoEstados) {
    const estado = ESTADOS_AFND.get(nomeEstado);

    if (!estado || !estado.transicoes[simbolo]) {
      continue;
    }

    for (const destino of estado.transicoes[simbolo]) {
      destinos.add(destino);
    }
  }

  return new Set(ordenarEstadosNaOrdem([...destinos]));
}

// Parte 4 - Determinizacao e reconhecimento lexico.
// Converte o AFND em AFD usando construcao por subconjuntos.
function determinizar() {
  ESTADOS_AFD = [];
  MAPA_ESTADOS_AFD = new Map();

  const fila = [];
  const visitados = new Set();

  const estadoInicialAFD = addEstadoAFD(new Set([ESTADO_INICIAL]));
  fila.push(estadoInicialAFD.nome);
  visitados.add(estadoInicialAFD.nome);

  while (fila.length > 0) {
    const nomeEstadoAtual = fila.shift();
    const estadoAtual = MAPA_ESTADOS_AFD.get(nomeEstadoAtual);

    for (const simbolo of ALFABETO) {
      const destinos = obterDestinosAFND(estadoAtual.conjunto, simbolo);

      if (destinos.size === 0) {
        continue;
      }

      const estadoDestino = addEstadoAFD(destinos);
      estadoAtual.transicoes[simbolo] = estadoDestino.nome;

      if (!visitados.has(estadoDestino.nome)) {
        visitados.add(estadoDestino.nome);
        fila.push(estadoDestino.nome);
      }
    }
  }
}

// Le a entrada principal, reconhece lexemas e gera a fita para o parser.
function reconhecerEntrada(caminhoEntrada = CAMINHO_ENTRADA) {
  if (!fs.existsSync(caminhoEntrada)) {
    throw new Error('Arquivo de entrada não encontrado.');
  }

  const conteudo = fs.readFileSync(caminhoEntrada, 'utf8').replace(/\r/g, '');

  FITA_SAIDA = [];
  FITA_PARSER = [];
  TABELA_DE_SIMBOLOS = [];

  let estadoCorrente = ESTADO_INICIAL;
  let linhaAtual = 1;
  let linhaDoLexema = 1;
  let lexemaAtual = '';

  for (let indice = 0; indice <= conteudo.length; indice += 1) {
    const fimDaEntrada = indice === conteudo.length;
    const simbolo = fimDaEntrada ? ' ' : conteudo[indice];

    if (fimDaEntrada || ehSeparador(simbolo)) {
      if (lexemaAtual.length > 0) {
        let identificador = estadoCorrente;
        let rotulo = obterRotuloDoEstadoAFD(estadoCorrente);

        if (!ehEstadoFinalAFD(estadoCorrente)) {
          identificador = ESTADO_ERRO;
          rotulo = 'ERROR';
        }

        const terminalParser = normalizarRotuloParaTerminal(rotulo);

        FITA_SAIDA.push(identificador);
        FITA_PARSER.push(terminalParser);

        TABELA_DE_SIMBOLOS.push({
          linha: linhaDoLexema,
          identificador,
          rotulo,
          terminalParser,
          lexema: lexemaAtual,
          indiceFita: FITA_PARSER.length - 1,
          consumidoNoSintatico: false,
          estadoShift: null,
          reducoesRelacionadas: [],
        });

        estadoCorrente = ESTADO_INICIAL;
        lexemaAtual = '';
      }

      if (!fimDaEntrada && simbolo === '\n') {
        linhaAtual += 1;
      }

      continue;
    }

    if (lexemaAtual.length === 0) {
      linhaDoLexema = linhaAtual;
    }

    lexemaAtual += simbolo;
    estadoCorrente = proximoEstadoAFD(estadoCorrente, simbolo);
  }

  FITA_SAIDA.push('$');
  FITA_PARSER.push('$');
}

// Parte 5 - Geracao das saidas usadas pela etapa sintatica.
function gerarTabelaAFND() {
  const linhas = [];

  for (const nomeEstado of ORDEM_ESTADOS_AFND) {
    const estado = ESTADOS_AFND.get(nomeEstado);
    const linha = {
      Estado: nomeExibicaoEstado(nomeEstado, estado.final),
    };

    for (const simbolo of ALFABETO) {
      linha[simbolo] = estado.transicoes[simbolo]
        ? ordenarEstadosNaOrdem([...estado.transicoes[simbolo]]).join(',')
        : '';
    }

    linhas.push(linha);
  }

  return linhas;
}

function gerarTabelaAFD() {
  const linhas = [];

  for (const estado of ESTADOS_AFD) {
    const linha = {
      Estado: nomeExibicaoEstado(estado.nome, estado.final),
    };

    for (const simbolo of ALFABETO) {
      linha[simbolo] = estado.transicoes[simbolo] ?? ESTADO_ERRO;
    }

    linhas.push(linha);
  }

  return linhas;
}

// Salva a fita lexica e a tabela de simbolos na pasta de saidas da Etapa 1.
function salvarSaidasEmArquivo() {
  if (!fs.existsSync(CAMINHO_SAIDAS)) {
    fs.mkdirSync(CAMINHO_SAIDAS, { recursive: true });
  }

  fs.writeFileSync(CAMINHO_FITA_JSON, JSON.stringify(FITA_PARSER, null, 2));
  fs.writeFileSync(CAMINHO_TS_JSON, JSON.stringify(TABELA_DE_SIMBOLOS, null, 2));
}

function imprimirResultado() {
  console.log('\nALFABETO');
  console.log(ALFABETO.join(' '));

  console.log('\nAFND');
  console.table(gerarTabelaAFND());

  console.log('\nAFD');
  console.table(gerarTabelaAFD());

  console.log('\nFITA (estados):', FITA_SAIDA.join(' '));
  console.log('FITA (parser):', FITA_PARSER.join(' '));

  console.log('\nTABELA DE SIMBOLOS');
  console.table(TABELA_DE_SIMBOLOS);

  console.log('\nArquivos gerados:');
  console.log(`- ${path.relative(CAMINHO_RAIZ, CAMINHO_FITA_JSON)}`);
  console.log(`- ${path.relative(CAMINHO_RAIZ, CAMINHO_TS_JSON)}`);
}

// Executa o fluxo lexico completo: carrega tokens, monta automatos e reconhece a entrada.
function executar() {
  resetarEstruturas();
  carregaTokens();
  montarAFND();
  determinizar();
  addEstadoErroNoAFD();
  reconhecerEntrada();
  salvarSaidasEmArquivo();
  imprimirResultado();
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar o analisador léxico:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
