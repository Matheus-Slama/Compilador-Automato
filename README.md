# Projeto 2 - Reconhecedor Sintatico

Projeto pratico da disciplina de Construção de Compiladores.

O projeto esta separado por etapas:
- `etapa0 - analisador lexico/`: analisador lexico usado para gerar a fita de entrada do sintatico.
- `etapa1 - reconhecimento sintatico/`: GLC, FIRST/FOLLOW, itens LR(0), tabela SLR e reconhecimento.
- `etapa2 - analise semantica/`: analise semantica e tabela de simbolos enriquecida.
- `etapa3 - codigo intermediario/`: geracao de codigo intermediario.
- `etapa4 - otimizacao/`: otimizacao do codigo intermediario.
- `main.js`: executa todas as etapas em sequencia.

## Como executar

```bash
node main.js
```

## Como testar com outra entrada

Para testar o compilador, voce deve alterar principalmente estes arquivos:

- `etapa0 - analisador lexico/main_entrada.txt`: entrada que sera analisada.
- `etapa0 - analisador lexico/tokens.txt`: tokens literais e regra do identificador.
- `main.js`: arquivo que executa todas as etapas em sequencia.

### 1. Alterar a entrada

Abra o arquivo:

```txt
etapa0 - analisador lexico/main_entrada.txt
```

Escreva a entrada que deseja testar. Exemplo:

```txt
se a foi
```

Outros exemplos validos para a gramatica atual:

```txt
sai a
foi b
se c sai
a
```

Depois rode:

```bash
node main.js
```

O programa executa as etapas de analise lexica, sintatica, semantica, geracao de codigo intermediario e otimizacao.

### 2. Alterar os tokens

O arquivo de tokens fica em:

```txt
etapa0 - analisador lexico/tokens.txt
```

As primeiras linhas sao tokens literais reconhecidos diretamente pelo analisador lexico:

```txt
se
sai
foi
```

Depois vem a gramatica regular usada para reconhecer identificadores:

```txt
S::=aA|dA|fA|iA|nA|oA|tA|uA|vA
A::=aA|dA|fA|iA|nA|oA|tA|uA|vA|ε
```

Com essa regra, identificadores podem usar as letras `a`, `d`, `f`, `i`, `n`, `o`, `t`, `u` e `v`.

Se quiser aceitar outra letra, adicione ela nas producoes. Exemplo, para aceitar `b`:

```txt
S::=aA|bA|dA|fA|iA|nA|oA|tA|uA|vA
A::=aA|bA|dA|fA|iA|nA|oA|tA|uA|vA|ε
```

Depois disso, uma entrada como esta passa a ser reconhecida pelo lexico:

```txt
se b foi
```

### 3. Conferir as saidas

Depois de executar `node main.js`, os principais arquivos gerados ficam nas pastas `saidas` de cada etapa:

- `etapa1 - reconhecimento sintatico/saidas/fita_saida_lexica.json`
- `etapa1 - reconhecimento sintatico/saidas/resultado_sintatico.json`
- `etapa2 - analise semantica/saidas/resultado_semantico.json`
- `etapa3 - codigo intermediario/saidas/codigo_intermediario.json`
- `etapa4 - otimizacao/saidas/codigo_otimizado.json`

Se a entrada nao for aceita, o terminal mostra a etapa onde ocorreu o erro.

Tambem e possivel executar cada etapa separadamente:

```bash
node "etapa0 - analisador lexico/afd.js"
node "etapa1 - reconhecimento sintatico/parser_slr.js"
node "etapa2 - analise semantica/semantico.js"
node "etapa3 - codigo intermediario/gerador_intermediario.js"
node "etapa4 - otimizacao/otimizador.js"
```

## Etapa 1 - Reconhecimento Sintatico

Arquivos principais:
- `etapa0 - analisador lexico/afd.js`
- `etapa1 - reconhecimento sintatico/parser_slr.js`
- `etapa0 - analisador lexico/tokens.txt`
- `etapa0 - analisador lexico/main_entrada.txt`
- `etapa1 - reconhecimento sintatico/gramaticas_geradas/gramatica_sintatica_original.txt`
- `etapa1 - reconhecimento sintatico/gramaticas_geradas/gramatica_sintatica_fatorada.txt`

Saidas:
- `etapa1 - reconhecimento sintatico/saidas/fita_saida_lexica.json`
- `etapa1 - reconhecimento sintatico/saidas/tabela_simbolos.json`
- `etapa1 - reconhecimento sintatico/saidas/grammar_summary.json`
- `etapa1 - reconhecimento sintatico/saidas/first_follow.json`
- `etapa1 - reconhecimento sintatico/saidas/itens_validos.json`
- `etapa1 - reconhecimento sintatico/saidas/transicoes.json`
- `etapa1 - reconhecimento sintatico/saidas/tabela_slr.json`
- `etapa1 - reconhecimento sintatico/saidas/passos_parser.json`
- `etapa1 - reconhecimento sintatico/saidas/resultado_sintatico.json`

Gramática original:

```txt
P ::= LISTA
LISTA ::= COMANDO LISTA | COMANDO
COMANDO ::= se ID foi | se ID sai | sai ID | foi ID | ID
```

Gramatica fatorada usada pelo parser:

```txt
P ::= LISTA
LISTA ::= COMANDO LISTA_TAIL
LISTA_TAIL ::= COMANDO LISTA_TAIL | ε
COMANDO ::= se ID ACAO | sai ID | foi ID | ID
ACAO ::= foi | sai
```

## Etapa 2 - Analise Semantica

Arquivo principal:
- `etapa2 - analise semantica/semantico.js`

Caracteristica semantica implementada:
- os identificadores da entrada devem ser unicos.

Informacoes adicionadas na tabela de simbolos:
- categoria semantica;
- papel semantico;
- comando semantico;
- simbolo semantico;
- validade semantica.

Saidas:
- `etapa2 - analise semantica/saidas/resultado_semantico.json`
- `etapa2 - analise semantica/saidas/tabela_simbolos_semantica.json`

## Etapa 3 - Codigo Intermediario

Arquivo principal:
- `etapa3 - codigo intermediario/gerador_intermediario.js`

Regra demonstrada:
- `COMANDO`

Saidas:
- `etapa3 - codigo intermediario/saidas/codigo_intermediario.json`
- `etapa3 - codigo intermediario/saidas/resultado_geracao.json`

## Etapa 4 - Otimizacao

Arquivo principal:
- `etapa4 - otimizacao/otimizador.js`

Estrategia aplicada:
- remocao de `NOP`;
- remocao de atribuicoes redundantes do tipo `x = x`.

Saidas:
- `etapa4 - otimizacao/saidas/codigo_otimizado.json`
- `etapa4 - otimizacao/saidas/resultado_otimizacao.json`
