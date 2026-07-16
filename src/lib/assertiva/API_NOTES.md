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
  quando existe registro de parentesco.
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
