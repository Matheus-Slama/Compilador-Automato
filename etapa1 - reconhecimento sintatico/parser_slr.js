const fs = require('fs');
const path = require('path');

const EPSILON = 'ε';
const FIM_DE_ENTRADA = '$';

const CAMINHO_GRAMATICAS = path.join(__dirname, 'gramaticas_geradas');
const CAMINHO_GRAMATICA_ORIGINAL = path.join(CAMINHO_GRAMATICAS, 'gramatica_sintatica_original.txt');
const CAMINHO_GRAMATICA_PROCESSADA = path.join(CAMINHO_GRAMATICAS, 'gramatica_sintatica_fatorada.txt');
const CAMINHO_SAIDAS = path.join(__dirname, 'saidas');
const CAMINHO_FITA_LEXICA = path.join(CAMINHO_SAIDAS, 'fita_saida_lexica.json');
const CAMINHO_TS = path.join(CAMINHO_SAIDAS, 'tabela_simbolos.json');

let NOME_SIMBOLO_INICIAL = null;
let NOME_SIMBOLO_AUMENTADO = null;

let NAO_TERMINAIS = [];
let TERMINAIS = [];
let PRODUCOES_ORIGINAIS = [];
let PRODUCOES = [];
let MAPA_PRODUCOES_POR_LADO_ESQUERDO = new Map();

let ANALISE_INUTEIS = {
  alcancaveis: [],
  geradores: [],
  inuteis: [],
};

let FIRST = new Map();
let FOLLOW = new Map();

let COLECAO_ITENS = [];
let TRANSICOES = [];
let MAPA_TRANSICOES = new Map();
let TABELA_ACTION = new Map();
let TABELA_GOTO = new Map();
let CONFLITOS = [];

let FITA_ENTRADA = [];
let TABELA_DE_SIMBOLOS = [];
let PASSOS_PARSER = [];
let ERROS_SINTATICOS = [];

function resetarEstruturas() {
  NOME_SIMBOLO_INICIAL = null;
  NOME_SIMBOLO_AUMENTADO = null;

  NAO_TERMINAIS = [];
  TERMINAIS = [];
  PRODUCOES_ORIGINAIS = [];
  PRODUCOES = [];
  MAPA_PRODUCOES_POR_LADO_ESQUERDO = new Map();

  ANALISE_INUTEIS = {
    alcancaveis: [],
    geradores: [],
    inuteis: [],
  };

  FIRST = new Map();
  FOLLOW = new Map();

  COLECAO_ITENS = [];
  TRANSICOES = [];
  MAPA_TRANSICOES = new Map();
  TABELA_ACTION = new Map();
  TABELA_GOTO = new Map();
  CONFLITOS = [];

  FITA_ENTRADA = [];
  TABELA_DE_SIMBOLOS = [];
  PASSOS_PARSER = [];
  ERROS_SINTATICOS = [];
}

// Parte 1 - Carregamento e normalizacao da gramatica usada na Etapa 1.
function lerLinhasValidas(caminhoArquivo) {
  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${path.basename(caminhoArquivo)}`);
  }

  return fs
    .readFileSync(caminhoArquivo, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0 && !linha.startsWith('#'));
}

function extrairProducoesDoArquivo(caminhoArquivo) {
  const linhas = lerLinhasValidas(caminhoArquivo);
  const naoTerminais = [];
  const producoesBrutas = [];

  for (const linha of linhas) {
    const [ladoEsquerdoBruto, ladoDireitoBruto] = linha.split('::=').map((parte) => parte.trim());

    if (!ladoEsquerdoBruto || !ladoDireitoBruto) {
      throw new Error(`Linha de gramática inválida: ${linha}`);
    }

    if (!naoTerminais.includes(ladoEsquerdoBruto)) {
      naoTerminais.push(ladoEsquerdoBruto);
    }

    producoesBrutas.push({
      ladoEsquerdo: ladoEsquerdoBruto,
      alternativasBrutas: ladoDireitoBruto.split('|').map((parte) => parte.trim()),
    });
  }

  const producoes = [];

  for (const producaoBruta of producoesBrutas) {
    for (const alternativaBruta of producaoBruta.alternativasBrutas) {
      const simbolos = alternativaBruta === EPSILON
        ? []
        : alternativaBruta.split(/\s+/).filter(Boolean);

      producoes.push({
        indice: producoes.length,
        ladoEsquerdo: producaoBruta.ladoEsquerdo,
        ladoDireito: simbolos,
      });
    }
  }

  return {
    naoTerminais,
    producoes,
  };
}

function montarTerminais() {
  const terminais = new Set();

  for (const producao of PRODUCOES_ORIGINAIS) {
    for (const simbolo of producao.ladoDireito) {
      if (!NAO_TERMINAIS.includes(simbolo)) {
        terminais.add(simbolo);
      }
    }
  }

  TERMINAIS = [...terminais];
}

function construirMapaDeProducoes() {
  MAPA_PRODUCOES_POR_LADO_ESQUERDO = new Map();

  for (const producao of PRODUCOES) {
    if (!MAPA_PRODUCOES_POR_LADO_ESQUERDO.has(producao.ladoEsquerdo)) {
      MAPA_PRODUCOES_POR_LADO_ESQUERDO.set(producao.ladoEsquerdo, []);
    }

    MAPA_PRODUCOES_POR_LADO_ESQUERDO.get(producao.ladoEsquerdo).push(producao);
  }
}

// Verifica quais nao-terminais nao geram ou nao sao alcancaveis.
function analisarSimbolosInuteis() {
  const geradores = new Set();
  let alterou = true;

  while (alterou) {
    alterou = false;

    for (const producao of PRODUCOES_ORIGINAIS) {
      const todosGeram = producao.ladoDireito.every((simbolo) => {
        if (!NAO_TERMINAIS.includes(simbolo)) {
          return true;
        }

        return geradores.has(simbolo);
      });

      if (todosGeram && !geradores.has(producao.ladoEsquerdo)) {
        geradores.add(producao.ladoEsquerdo);
        alterou = true;
      }
    }
  }

  const alcancaveis = new Set([NOME_SIMBOLO_INICIAL]);
  const fila = [NOME_SIMBOLO_INICIAL];

  while (fila.length > 0) {
    const atual = fila.shift();
    const producoesDoSimbolo = PRODUCOES_ORIGINAIS.filter((producao) => producao.ladoEsquerdo === atual);

    for (const producao of producoesDoSimbolo) {
      for (const simbolo of producao.ladoDireito) {
        if (NAO_TERMINAIS.includes(simbolo) && !alcancaveis.has(simbolo)) {
          alcancaveis.add(simbolo);
          fila.push(simbolo);
        }
      }
    }
  }

  const inuteis = NAO_TERMINAIS
    .filter((simbolo) => simbolo !== NOME_SIMBOLO_AUMENTADO)
    .filter((simbolo) => !geradores.has(simbolo) || !alcancaveis.has(simbolo));

  ANALISE_INUTEIS = {
    alcancaveis: [...alcancaveis],
    geradores: [...geradores],
    inuteis,
  };
}

function gerarNomeAumentado(base) {
  let nome = `${base}_AUG`;
  let contador = 1;

  while (NAO_TERMINAIS.includes(nome)) {
    nome = `${base}_AUG_${contador}`;
    contador += 1;
  }

  return nome;
}

// Carrega a gramatica original e a gramatica fatorada usada pelo parser.
function carregarGramatica() {
  const gramOriginal = extrairProducoesDoArquivo(CAMINHO_GRAMATICA_ORIGINAL);
  const gramProcessada = extrairProducoesDoArquivo(CAMINHO_GRAMATICA_PROCESSADA);

  NOME_SIMBOLO_INICIAL = gramProcessada.naoTerminais[0];
  NOME_SIMBOLO_AUMENTADO = gerarNomeAumentado(NOME_SIMBOLO_INICIAL);

  NAO_TERMINAIS = [...gramProcessada.naoTerminais, NOME_SIMBOLO_AUMENTADO];
  PRODUCOES_ORIGINAIS = gramProcessada.producoes.map((producao, indice) => ({
    indice,
    ladoEsquerdo: producao.ladoEsquerdo,
    ladoDireito: [...producao.ladoDireito],
  }));

  PRODUCOES = [
    {
      indice: 0,
      ladoEsquerdo: NOME_SIMBOLO_AUMENTADO,
      ladoDireito: [NOME_SIMBOLO_INICIAL],
    },
    ...PRODUCOES_ORIGINAIS.map((producao, indice) => ({
      indice: indice + 1,
      ladoEsquerdo: producao.ladoEsquerdo,
      ladoDireito: [...producao.ladoDireito],
    })),
  ];

  montarTerminais();
  construirMapaDeProducoes();
  analisarSimbolosInuteis();

  return {
    original: gramOriginal,
    processada: gramProcessada,
  };
}

// Parte 2 - Calculo de FIRST/FOLLOW exigido na Etapa 1.
function iniciarFirst() {
  FIRST = new Map();

  for (const terminal of TERMINAIS) {
    FIRST.set(terminal, new Set([terminal]));
  }

  FIRST.set(EPSILON, new Set([EPSILON]));

  for (const naoTerminal of NAO_TERMINAIS) {
    if (!FIRST.has(naoTerminal)) {
      FIRST.set(naoTerminal, new Set());
    }
  }
}

function addConjunto(destino, origem, removerEpsilon = false) {
  let alterou = false;

  for (const simbolo of origem) {
    if (removerEpsilon && simbolo === EPSILON) {
      continue;
    }

    if (!destino.has(simbolo)) {
      destino.add(simbolo);
      alterou = true;
    }
  }

  return alterou;
}

function firstDaSequencia(simbolos) {
  if (simbolos.length === 0) {
    return new Set([EPSILON]);
  }

  const resultado = new Set();
  let todosPodemGerarEpsilon = true;

  for (const simbolo of simbolos) {
    const firstDoSimbolo = FIRST.get(simbolo) ?? new Set([simbolo]);
    addConjunto(resultado, firstDoSimbolo, true);

    if (!firstDoSimbolo.has(EPSILON)) {
      todosPodemGerarEpsilon = false;
      break;
    }
  }

  if (todosPodemGerarEpsilon) {
    resultado.add(EPSILON);
  }

  return resultado;
}

// Calcula o conjunto FIRST de cada simbolo da gramatica.
function construirFirst() {
  iniciarFirst();

  let alterou = true;

  while (alterou) {
    alterou = false;

    for (const producao of PRODUCOES_ORIGINAIS) {
      const firstLadoDireito = firstDaSequencia(producao.ladoDireito);
      const firstLadoEsquerdo = FIRST.get(producao.ladoEsquerdo);

      if (addConjunto(firstLadoEsquerdo, firstLadoDireito)) {
        alterou = true;
      }
    }
  }
}

function iniciarFollow() {
  FOLLOW = new Map();

  for (const naoTerminal of NAO_TERMINAIS) {
    FOLLOW.set(naoTerminal, new Set());
  }

  FOLLOW.get(NOME_SIMBOLO_INICIAL).add(FIM_DE_ENTRADA);
}

// Calcula o conjunto FOLLOW de cada nao-terminal.
function construirFollow() {
  iniciarFollow();

  let alterou = true;

  while (alterou) {
    alterou = false;

    for (const producao of PRODUCOES_ORIGINAIS) {
      for (let indice = 0; indice < producao.ladoDireito.length; indice += 1) {
        const simboloAtual = producao.ladoDireito[indice];

        if (!NAO_TERMINAIS.includes(simboloAtual)) {
          continue;
        }

        const restante = producao.ladoDireito.slice(indice + 1);
        const firstRestante = firstDaSequencia(restante);
        const followAtual = FOLLOW.get(simboloAtual);

        if (addConjunto(followAtual, firstRestante, true)) {
          alterou = true;
        }

        if (restante.length === 0 || firstRestante.has(EPSILON)) {
          const followOrigem = FOLLOW.get(producao.ladoEsquerdo);

          if (addConjunto(followAtual, followOrigem)) {
            alterou = true;
          }
        }
      }
    }
  }
}

// Parte 3 - Itens LR(0) canonicos e transicoes.
function criarItem(indiceProducao, ponto) {
  return {
    indiceProducao,
    ponto,
  };
}

function serializarItem(item) {
  return `${item.indiceProducao}@${item.ponto}`;
}

function serializarConjuntoItens(itens) {
  return itens
    .map((item) => serializarItem(item))
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function simboloAposPonto(item) {
  const producao = PRODUCOES[item.indiceProducao];
  return producao.ladoDireito[item.ponto] ?? null;
}

function itemEstaCompleto(item) {
  const producao = PRODUCOES[item.indiceProducao];
  return item.ponto >= producao.ladoDireito.length;
}

// Calcula o fechamento de um conjunto de itens LR(0).
function closure(itensBase) {
  const itens = [...itensBase];
  const visitados = new Set(itens.map((item) => serializarItem(item)));

  for (let indice = 0; indice < itens.length; indice += 1) {
    const item = itens[indice];
    const simbolo = simboloAposPonto(item);

    if (!simbolo || !NAO_TERMINAIS.includes(simbolo)) {
      continue;
    }

    const producoesDoSimbolo = MAPA_PRODUCOES_POR_LADO_ESQUERDO.get(simbolo) ?? [];

    for (const producao of producoesDoSimbolo) {
      const novoItem = criarItem(producao.indice, 0);
      const chave = serializarItem(novoItem);

      if (!visitados.has(chave)) {
        visitados.add(chave);
        itens.push(novoItem);
      }
    }
  }

  return itens.sort((itemA, itemB) => {
    if (itemA.indiceProducao !== itemB.indiceProducao) {
      return itemA.indiceProducao - itemB.indiceProducao;
    }

    return itemA.ponto - itemB.ponto;
  });
}

// Calcula a transicao GOTO para um conjunto de itens e um simbolo.
function gotoLR(itens, simbolo) {
  const avancados = [];

  for (const item of itens) {
    if (simboloAposPonto(item) === simbolo) {
      avancados.push(criarItem(item.indiceProducao, item.ponto + 1));
    }
  }

  if (avancados.length === 0) {
    return [];
  }

  return closure(avancados);
}

function adicionarEstadoItens(itens) {
  const chave = serializarConjuntoItens(itens);
  const estadoExistente = COLECAO_ITENS.find((estado) => estado.chave === chave);

  if (estadoExistente) {
    return estadoExistente;
  }

  const novoEstado = {
    indice: COLECAO_ITENS.length,
    itens,
    chave,
  };

  COLECAO_ITENS.push(novoEstado);
  return novoEstado;
}

function registrarTransicao(origem, simbolo, destino) {
  const chave = `${origem}|${simbolo}`;

  if (!MAPA_TRANSICOES.has(chave)) {
    MAPA_TRANSICOES.set(chave, destino);
    TRANSICOES.push({ origem, simbolo, destino });
  }
}

// Constroi a colecao canonica de itens LR(0) e suas transicoes.
function construirColecaoCanonica() {
  COLECAO_ITENS = [];
  TRANSICOES = [];
  MAPA_TRANSICOES = new Map();

  const estadoInicial = adicionarEstadoItens(closure([criarItem(0, 0)]));
  const fila = [estadoInicial];

  while (fila.length > 0) {
    const estadoAtual = fila.shift();
    const simbolosPossiveis = new Set();

    for (const item of estadoAtual.itens) {
      const simbolo = simboloAposPonto(item);

      if (simbolo) {
        simbolosPossiveis.add(simbolo);
      }
    }

    for (const simbolo of simbolosPossiveis) {
      const itensDestino = gotoLR(estadoAtual.itens, simbolo);

      if (itensDestino.length === 0) {
        continue;
      }

      const estadoDestino = adicionarEstadoItens(itensDestino);
      registrarTransicao(estadoAtual.indice, simbolo, estadoDestino.indice);

      if (!fila.some((estado) => estado.indice === estadoDestino.indice)
        && !TRANSICOES.some((transicao) => transicao.origem === estadoDestino.indice)) {
        const jaProcessado = estadoDestino.indice < estadoAtual.indice;

        if (!jaProcessado) {
          fila.push(estadoDestino);
        }
      }
    }
  }
}

// Parte 4 - Geracao da tabela SLR.
function chaveTabela(estado, simbolo) {
  return `${estado}|${simbolo}`;
}

function registrarAction(estado, simbolo, acao) {
  const chave = chaveTabela(estado, simbolo);

  if (TABELA_ACTION.has(chave) && TABELA_ACTION.get(chave) !== acao) {
    CONFLITOS.push({ tipo: 'ACTION', estado, simbolo, existente: TABELA_ACTION.get(chave), novo: acao });
    return;
  }

  TABELA_ACTION.set(chave, acao);
}

function registrarGoto(estado, simbolo, destino) {
  const chave = chaveTabela(estado, simbolo);

  if (TABELA_GOTO.has(chave) && TABELA_GOTO.get(chave) !== destino) {
    CONFLITOS.push({ tipo: 'GOTO', estado, simbolo, existente: TABELA_GOTO.get(chave), novo: destino });
    return;
  }

  TABELA_GOTO.set(chave, destino);
}

// Constroi a tabela SLR com ACTION e GOTO.
function construirTabelaSLR() {
  TABELA_ACTION = new Map();
  TABELA_GOTO = new Map();
  CONFLITOS = [];

  for (const transicao of TRANSICOES) {
    if (TERMINAIS.includes(transicao.simbolo)) {
      registrarAction(transicao.origem, transicao.simbolo, `s${transicao.destino}`);
    } else {
      registrarGoto(transicao.origem, transicao.simbolo, transicao.destino);
    }
  }

  for (const estado of COLECAO_ITENS) {
    for (const item of estado.itens) {
      const producao = PRODUCOES[item.indiceProducao];

      if (!itemEstaCompleto(item)) {
        continue;
      }

      if (producao.ladoEsquerdo === NOME_SIMBOLO_AUMENTADO) {
        registrarAction(estado.indice, FIM_DE_ENTRADA, 'acc');
        continue;
      }

      const followDoLadoEsquerdo = FOLLOW.get(producao.ladoEsquerdo) ?? new Set();

      for (const simboloFollow of followDoLadoEsquerdo) {
        registrarAction(estado.indice, simboloFollow, `r${producao.indice}`);
      }
    }
  }
}

// Parte 5 - Carregamento da saida lexica e execucao do parser.
function carregarSaidaLexica() {
  if (!fs.existsSync(CAMINHO_FITA_LEXICA) || !fs.existsSync(CAMINHO_TS)) {
    throw new Error('Saída léxica não encontrada. Execute o afd.js antes do parser.');
  }

  FITA_ENTRADA = JSON.parse(fs.readFileSync(CAMINHO_FITA_LEXICA, 'utf8'));
  TABELA_DE_SIMBOLOS = JSON.parse(fs.readFileSync(CAMINHO_TS, 'utf8'));

  const temErroLexico = FITA_ENTRADA.includes('ERROR');

  if (temErroLexico) {
    throw new Error('A fita léxica contém ERROR. Corrija os erros léxicos antes de executar o parser.');
  }
}

function obterAction(estado, simbolo) {
  return TABELA_ACTION.get(chaveTabela(estado, simbolo)) ?? null;
}

function obterGoto(estado, simbolo) {
  return TABELA_GOTO.get(chaveTabela(estado, simbolo)) ?? null;
}

function pilhaParaTexto(pilha) {
  return pilha.join(' ');
}

function entradaRestanteParaTexto(indiceAtual) {
  return FITA_ENTRADA.slice(indiceAtual).join(' ');
}

function registrarReducaoNaTabelaSimbolos(indiceEntrada, producao) {
  for (let indice = 0; indice < indiceEntrada && indice < TABELA_DE_SIMBOLOS.length; indice += 1) {
    TABELA_DE_SIMBOLOS[indice].reducoesRelacionadas = TABELA_DE_SIMBOLOS[indice].reducoesRelacionadas ?? [];

    if (!TABELA_DE_SIMBOLOS[indice].reducoesRelacionadas.includes(producao.indice)) {
      TABELA_DE_SIMBOLOS[indice].reducoesRelacionadas.push(producao.indice);
    }
  }
}

// Executa o parser shift-reduce usando a tabela SLR.
function reconhecerSintaticamente() {
  PASSOS_PARSER = [];
  ERROS_SINTATICOS = [];

  const pilha = [0];
  let indiceEntrada = 0;
  let contadorPassos = 1;

  while (true) {
    const estadoAtual = pilha[pilha.length - 1];
    const simboloAtual = FITA_ENTRADA[indiceEntrada];
    const acao = obterAction(estadoAtual, simboloAtual);

    PASSOS_PARSER.push({
      passo: contadorPassos,
      pilha: pilhaParaTexto(pilha),
      entrada: entradaRestanteParaTexto(indiceEntrada),
      acao: acao ?? 'erro',
    });

    contadorPassos += 1;

    if (!acao) {
      ERROS_SINTATICOS.push({
        posicaoFita: indiceEntrada,
        simboloRecebido: simboloAtual,
        estado: estadoAtual,
        esperado: TERMINAIS.filter((terminal) => obterAction(estadoAtual, terminal)),
        mensagem: `Erro sintático no estado ${estadoAtual} ao ler '${simboloAtual}'.`,
      });
      return false;
    }

    if (acao === 'acc') {
      return true;
    }

    if (acao.startsWith('s')) {
      const proximoEstado = Number(acao.slice(1));
      pilha.push(simboloAtual);
      pilha.push(proximoEstado);

      if (indiceEntrada < TABELA_DE_SIMBOLOS.length) {
        TABELA_DE_SIMBOLOS[indiceEntrada].consumidoNoSintatico = true;
        TABELA_DE_SIMBOLOS[indiceEntrada].estadoShift = proximoEstado;
      }

      indiceEntrada += 1;
      continue;
    }

    if (acao.startsWith('r')) {
      const indiceProducao = Number(acao.slice(1));
      const producao = PRODUCOES.find((item) => item.indice === indiceProducao);
      const tamanhoLadoDireito = producao.ladoDireito.length;

      for (let indice = 0; indice < tamanhoLadoDireito * 2; indice += 1) {
        pilha.pop();
      }

      const estadoTopo = pilha[pilha.length - 1];
      const destinoGoto = obterGoto(estadoTopo, producao.ladoEsquerdo);

      if (destinoGoto === null || destinoGoto === undefined) {
        ERROS_SINTATICOS.push({
          posicaoFita: indiceEntrada,
          simboloRecebido: simboloAtual,
          estado: estadoTopo,
          esperado: [producao.ladoEsquerdo],
          mensagem: `Erro sintático após redução ${producao.indice}: goto ausente para ${producao.ladoEsquerdo}.`,
        });
        return false;
      }

      pilha.push(producao.ladoEsquerdo);
      pilha.push(destinoGoto);
      registrarReducaoNaTabelaSimbolos(indiceEntrada, producao);
      continue;
    }
  }
}

// Parte 6 - Formatacao e geracao dos arquivos de saida.
function formatarProducao(producao) {
  const ladoDireito = producao.ladoDireito.length > 0 ? producao.ladoDireito.join(' ') : EPSILON;
  return `${producao.ladoEsquerdo} ::= ${ladoDireito}`;
}

function formatarItem(item) {
  const producao = PRODUCOES[item.indiceProducao];
  const simbolos = [...producao.ladoDireito];
  simbolos.splice(item.ponto, 0, '•');

  if (simbolos.length === 1 && simbolos[0] === '•') {
    simbolos.push(EPSILON);
  }

  return `${producao.ladoEsquerdo} ::= ${simbolos.join(' ')}`;
}

function mapearConjuntos(mapa) {
  const objeto = {};

  for (const [chave, conjunto] of mapa.entries()) {
    objeto[chave] = [...conjunto];
  }

  return objeto;
}

function gerarTabelaSLRSerializada() {
  const linhas = [];
  const colunasAction = [...TERMINAIS, FIM_DE_ENTRADA];
  const colunasGoto = NAO_TERMINAIS.filter((simbolo) => simbolo !== NOME_SIMBOLO_AUMENTADO);

  for (const estado of COLECAO_ITENS) {
    const linha = {
      estado: estado.indice,
    };

    for (const terminal of colunasAction) {
      linha[terminal] = obterAction(estado.indice, terminal) ?? '';
    }

    for (const naoTerminal of colunasGoto) {
      const destino = obterGoto(estado.indice, naoTerminal);
      linha[naoTerminal] = destino ?? '';
    }

    linhas.push(linha);
  }

  return linhas;
}

function garantirDiretorioSaidas() {
  if (!fs.existsSync(CAMINHO_SAIDAS)) {
    fs.mkdirSync(CAMINHO_SAIDAS, { recursive: true });
  }
}

// Salva FIRST/FOLLOW, itens, transicoes, tabela SLR, passos e resultado.
function salvarArtefatos() {
  garantirDiretorioSaidas();

  const artefatos = {
    grammar_summary: {
      simboloInicial: NOME_SIMBOLO_INICIAL,
      simboloAumentado: NOME_SIMBOLO_AUMENTADO,
      terminais: TERMINAIS,
      naoTerminais: NAO_TERMINAIS,
      producoes: PRODUCOES.map((producao) => ({
        indice: producao.indice,
        texto: formatarProducao(producao),
      })),
      inuteis: ANALISE_INUTEIS,
    },
    first_follow: {
      first: mapearConjuntos(FIRST),
      follow: mapearConjuntos(FOLLOW),
    },
    itens_validos: COLECAO_ITENS.map((estado) => ({
      estado: estado.indice,
      itens: estado.itens.map((item) => formatarItem(item)),
    })),
    transicoes: TRANSICOES,
    tabela_slr: gerarTabelaSLRSerializada(),
    conflitos: CONFLITOS,
    passos_parser: PASSOS_PARSER,
    erros_sintaticos: ERROS_SINTATICOS,
    tabela_simbolos_atualizada: TABELA_DE_SIMBOLOS,
  };

  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'grammar_summary.json'), JSON.stringify(artefatos.grammar_summary, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'first_follow.json'), JSON.stringify(artefatos.first_follow, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'itens_validos.json'), JSON.stringify(artefatos.itens_validos, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'transicoes.json'), JSON.stringify(artefatos.transicoes, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'tabela_slr.json'), JSON.stringify(artefatos.tabela_slr, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'passos_parser.json'), JSON.stringify(artefatos.passos_parser, null, 2));
  fs.writeFileSync(path.join(CAMINHO_SAIDAS, 'resultado_sintatico.json'), JSON.stringify({
    aceito: ERROS_SINTATICOS.length === 0,
    erros: ERROS_SINTATICOS,
    conflitos: CONFLITOS,
  }, null, 2));
  fs.writeFileSync(CAMINHO_TS, JSON.stringify(TABELA_DE_SIMBOLOS, null, 2));
}

function imprimirResumo() {
  console.log('1. GLC original e GLC fatorada carregadas do projeto.');
  console.log('2. Verificação de símbolos inúteis.');
  console.log('3. Construção de FIRST e FOLLOW.');
  console.log('4. Construção da coleção canônica LR(0), itens válidos e transições.');
  console.log('5. Construção da tabela SLR.');
  console.log('6. Reconhecimento sintático usando a fita de saída do léxico.');
  console.log('7. Atualização da tabela de símbolos para as próximas etapas.');

  console.log('\nGLC FATORADA USADA NO PARSER');
  for (const producao of PRODUCOES_ORIGINAIS) {
    console.log(`- ${formatarProducao(producao)}`);
  }

  console.log('\nSIMBOLOS INUTEIS');
  console.log(ANALISE_INUTEIS.inuteis.length > 0 ? ANALISE_INUTEIS.inuteis.join(', ') : 'Nenhum símbolo inútil encontrado.');

  console.log('\nFIRST');
  for (const naoTerminal of NAO_TERMINAIS.filter((simbolo) => simbolo !== NOME_SIMBOLO_AUMENTADO)) {
    console.log(`${naoTerminal}: { ${[...(FIRST.get(naoTerminal) ?? [])].join(', ')} }`);
  }

  console.log('\nFOLLOW');
  for (const naoTerminal of NAO_TERMINAIS.filter((simbolo) => simbolo !== NOME_SIMBOLO_AUMENTADO)) {
    console.log(`${naoTerminal}: { ${[...(FOLLOW.get(naoTerminal) ?? [])].join(', ')} }`);
  }

  console.log('\nTABELA SLR');
  console.table(gerarTabelaSLRSerializada());

  console.log('\nPASSOS DO PARSER');
  console.table(PASSOS_PARSER);

  if (ERROS_SINTATICOS.length > 0) {
    console.log('\nERROS SINTATICOS');
    console.table(ERROS_SINTATICOS);
  } else {
    console.log('\nResultado: ACEITE');
  }

  if (CONFLITOS.length > 0) {
    console.log('\nCONFLITOS NA TABELA SLR');
    console.table(CONFLITOS);
  }

  console.log('\nArquivos gerados em saidas/.');
}

// Executa a Etapa 1 sintatica completa.
function executar() {
  resetarEstruturas();
  carregarGramatica();
  construirFirst();
  construirFollow();
  construirColecaoCanonica();
  construirTabelaSLR();
  carregarSaidaLexica();
  reconhecerSintaticamente();
  salvarArtefatos();
  imprimirResumo();
}

if (require.main === module) {
  try {
    executar();
  } catch (error) {
    console.error('\nErro ao executar o analisador sintático:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  executar,
};
