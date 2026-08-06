# Assertiva Soluções — notas da integração real

Este doc existe porque o formato **real** das respostas da Assertiva diverge do
swagger em vários pontos, e cada divergência já causou pelo menos um bug em
produção. Antes de mexer em `parsers.ts` ou `route.ts`, leia isto.

## Produtos contratados (ver contrato)

- **Localize** (`/localize/v3/cpf|cnpj`, `/pessoas-de-referencia`) — dados
  cadastrais, endereços, telefones, vínculos.
- **Conexões** (`/localize-api/v1/base-cadastral/conexoes`) — rede de
  relacionamento (mãe, pai, cônjuge, sócios, empregador...).
- **Veículos** (`/veiculos/v3/historico-veiculos`).
- **Score/Crédito** (`/score/v3/pf|pj/credito`) — score, negativações,
  protestos, ações judiciais, cheques, renda/faturamento presumido.
- **Análise Comportamental / Análise 360** (`/credito/v1/pf|pj`) — assíncrona
  via webhook. Única fonte de imóveis (PJ) e de dívida ativa da
  União/IRPF/benefícios (PF).
- **"Mix" não está contratado** — sempre retorna 403. Não usar
  `MIX_BASE`; ficou só como referência histórica em `server.ts`.

## Quirks confirmados ao vivo (não confiar no swagger)

- **`conexoes`**: `resposta` vem como **array plano**, não agrupado por
  categoria (`parentes`/`socios`/etc.) como o swagger sugere. `parseConexoes`
  trata os dois formatos, mas o real é sempre o array plano.
- **`score/credito`**: com `acoes=true`, o campo `acoes` vem como **irmão**
  de `resposta`, não aninhado dentro dela.
- **Listas vazias** (`registrosDebitos`, `cheques`, `protestosPublicos`)
  vêm como `{}` quando não há nada — não como `[]` nem `null`. Ver
  `extrairListaComTotais`.
- **`/localize/v3/cpf` nunca retorna o nome do pai** — só da mãe
  (`maeNome`). Pai só aparece via `/conexoes` ou `/pessoas-de-referencia`,
  quando existe registro de parentesco. **Confirmado em 2026-08-06 varrendo
  os dois swaggers inteiros (Localize + Análise 360) procurando qualquer
  propriedade com "pai" no nome — zero ocorrências.** Não existe outra fonte
  possível dentro do plano contratado; a ausência varia pessoa a pessoa
  porque depende da base de relacionamento da própria Assertiva ter aquele
  vínculo específico indexado. Não é bug — é limitação real de dado.
- **`/conexoes` só tem 5 params** (`documento`, `tipo`, `idFinalidade`,
  `conjuge`, `telefones`) — não existe um parâmetro pra pedir "todas as
  categorias". Uma única chamada já retorna o array plano misturando todas
  as categorias que existirem pra aquele documento (parentes, sócios,
  empregador, empresas, convívio familiar, decisores). Os 8 schemas
  `ResponseConexoes*PF/PJ` do swagger (`oneOf`) são só artefato de
  documentação — na prática todos têm exatamente os mesmos campos por item:
  `nomeOuRazaoSocial`, `documento`, `tipoDocumento`, `tipoRelacao`, `relacao`,
  `telefone`, `tipoTelefone` (M/F), `naoPerturbe`, `whatsapp`,
  `dataNascimento`, `cargo`, `dataEntrada`/`dataAbertura`.
- **`/localize/v3/mais-telefones`** (não integrado até 2026-08-06) devolve
  MÚLTIPLOS telefones por documento (não só 1 como `/conexoes`), cada um com
  `relacao`, `naoPerturbe`, `ultimoContato` e — só nos móveis — `hotphone`
  (número validado/ativo recentemente) e `plus` (maior confiança). Exige
  `protocolo` de uma consulta de `/cpf`\|`/cnpj` do MESMO documento feita
  pouco antes — não dá pra reaproveitar protocolo de um cache antigo.
  Integrado em `route.ts` só para os `MAX_MAIS_TELEFONES` (5) vínculos mais
  próximos que tiveram lookup fresco (cache miss) — em cache hit, sem
  protocolo, pula silenciosamente.
- **`/localize/v3/possiveis-decisores`** (dedicado, CNPJ) tem MENOS dado que
  o que já vem em `/conexoes` (nem telefone tem, só cargo/cpf/nome/data
  nasc.) — confirmado que não vale integrar.
- **`DividasAtivasUniaoModule.registros[]`** (Análise 360 PF) tem `categoria`
  (enum `ETAPA_1`..`ETAPA_4`, `PROCESSAMENTO_INTERNO` — tabela em
  `CATEGORIA_DIVIDA_UNIAO` em `parsers.ts`) e `unidadeResponsavel` — os dois
  existiam na API desde sempre mas só passaram a ser parseados em 2026-08-06.
  `ETAPA_4` = acordo rompido/escalando pra leilão (crítico); `ETAPA_3` =
  parcelamento em dia (ok).
- **`possivelHistoricoProfissional`** é um **array** (histórico de vínculos
  empregatícios: empresa, CNPJ, cargo, setor, renda, data), não um objeto
  único — usar o array inteiro (`historico_profissional`), não só `[0]`
  (bug corrigido em 2026-07-14: só o cargo/renda do primeiro item eram
  aproveitados, empresa e CNPJ eram descartados).
- **Protesto** só traz um código curto de cartório, nunca o nome completo.
- **Ação judicial** não tem valor por item — só o agregado
  (`valor_total_acoes`).
- **`idRange` do Score é uma escala diferente por produto**: PJ usa 23–28,
  PF usa 1–6. Não reaproveitar a mesma tabela de risco entre os dois
  (`RISCO_POR_ID_RANGE` vs `RISCO_POR_ID_RANGE_PF`).
- **`pessoas-de-referencia`** usa um algoritmo diferente de `/conexoes` —
  pode achar gente que `/conexoes` não acha (ex.: empregador). Por isso é
  somado (`mesclarVinculos`), nunca usado como substituto.

## Análise 360 — módulos confirmados contra o swagger real (2026-07-15)

Fui direto no swagger oficial (`https://integracao.assertivasolucoes.com.br/v3/swagger/credito/swagger.json`)
pra conferir campo a campo. Módulos hoje parseados: `score`, `perfilSocioeconomico`
(completo, incluindo histórico empresarial e indicadores de moradia/CEP),
`dividasAtivasUniao`, `restituicaoIRPF`, `beneficios`, `composicaoDomiciliar`,
`limiteCredito`, `imoveis` (PJ), `quadroSocietario` (PJ), `antifraude` (score,
PF+PJ), `reputacoes` (PJ — Google Meu Negócio/Reclame Aqui etc.), `movimentacoes`
(PJ — alterações cadastrais), `concorrencias` (PJ — segmento/homonímia/tendência).

**Nunca testado ao vivo em produção** — o disparo (`POST /credito/v1/pf|pj`)
exige `NEXT_PUBLIC_APP_URL` pública pro webhook, e não dá pra testar em
localhost sem gastar uma consulta paga sem conseguir receber o resultado.
Os parsers seguem o schema oficial, mas **validar contra o primeiro payload
real assim que chegar em produção** — todo o histórico deste doc mostra que
o swagger já errou antes (`conexoes`, `acoes`, listas vazias).

## Produto "Consulta em Lote" — contratado, NÃO integrado

O contrato (Proposta Q-18742-1, páginas 22-26) lista um catálogo de "Campos
Adicionais" bem mais rico do que qualquer coisa que já usamos: pai/mãe/cônjuge/
filho/irmão/**avó** com CPF+telefone+celular+endereço próprios, telefone
comercial do empregador, CBO, faixa salarial, e pra PJ até parentes dos sócios.

Procurei esse produto no swagger (tentei ~25 variações de slug: "lote",
"enriquecimento", "consulta-chave", "campos-adicionais" etc.) e **não achei
nenhum endpoint REST correspondente** — só bati em 404. Os únicos produtos que
respondem no `/v3/swagger/{produto}/swagger.json` são `localize`, `veiculos`,
`credito`, `autentica`, `recupere`. Isso sugere fortemente que "Consulta em
Lote" é processado por **upload de arquivo no portal web**
(app.assertivasolucoes.com.br), não por API em tempo real — mas não é 100%
confirmado. **Antes de tentar integrar isso, confirmar com o contato comercial
da Assertiva** (Jessica Anjos, jessica.anjos@assertivasolucoes.com.br) se
existe uma variante "por Consulta/Chave" (nome citado na proposta) que aceite
um CPF/CNPJ por vez via API — só vale gastar esforço de código depois disso.

## Priorização de vínculos (2026-08-06)

`MAX_VINCULOS_ENRIQUECER` (25) e `MAX_MAIS_TELEFONES` (5) em `route.ts` são
tetos de CUSTO — cada vínculo enriquecido é 1 consulta paga extra (cacheada
30 dias), e `mais-telefones` é mais uma em cima disso. Antes de aplicar os
tetos, `ordenarVinculosPorProximidade` (parsers.ts) reordena a lista pondo
família direta (mãe/pai/cônjuge/filho) primeiro, depois irmãos/avós, depois
sócios/empregador/decisores. Isso garante que pessoa com muitos vínculos
societários (ex.: sócio de empresa grande) não "engula" o teto com sócios
distantes antes de enriquecer a família — que é quem mais importa pra
localizar o devedor numa cobrança. Se `MAX_VINCULOS_ENRIQUECER` for alterado,
reavaliar custo (consultas Assertiva são pagas por chamada).

## Endereço: precisão e geolocalização (2026-08-06)

`Enderecos.precisaoCep` (ex.: `"CONFIRMADA"`) e `latitude`/`longitude` vêm
prontos em qualquer endereço retornado por `/cpf`\|`/cnpj` (e por tabela
herdam pros perfis de vínculo enriquecidos) — agora capturados em
`RelatorioEndereco`. Não confiar em endereço com `precisao_cep` diferente de
`"CONFIRMADA"` como se fosse exato (é aproximado — cuidado ao mandar
cobrador pro local).

## Campos intencionalmente não removidos: `RelatorioTelefone.ddd`/`.operadora`

Esses dois campos nunca são preenchidos com dado real — `numero` já vem
formatado inteiro (ex. `"(11) 99898-9898"`) e nem `ddd` nem `operadora`
existem em nenhum schema real da Assertiva. São campos "mortos" mas foram
mantidos no tipo por decisão consciente em 2026-08-06: já existem testes e
código dependendo do shape, e remover não muda comportamento nenhum (sempre
foram `undefined`/`''` em produção) — só risco de quebrar algo por zero
ganho. Se um dia for limpar, checar usos em toda a UI antes.

## Cache

`assertiva_cache_factoring` guarda o resultado já parseado por até 30 dias
(`chaveCacheAssertiva`, em `server.ts`). **Sempre que `parsers.ts` mudar o
formato dos dados retornados, incremente `ASSERTIVA_CACHE_VERSION`** — sem
isso, documentos já cacheados continuam servindo o formato antigo por até 30
dias, mascarando o fix (foi exatamente assim que o bug de vínculos ficou
"não resolvido" por dias em 2026-07).

## Arquivos-chave

- `server.ts` — auth OAuth2, URLs base, versão do cache.
- `parsers.ts` — toda a lógica de parsing (funções puras, sem I/O).
- `route.ts` (`/api/assertiva/relatorio`) — orquestra as chamadas + cache.
- `analise-360/route.ts` + `webhook/analise-360/route.ts` — fluxo assíncrono.
- `__tests__/parsers.test.ts` — regressão pros formatos reais confirmados
  aqui; qualquer novo quirk descoberto deveria virar um teste.
