# Política de Cache — Grupo SRSM

Este doc existe porque já tivemos bug real de cache mostrando dado errado pra
pessoa errada (ver "Casos reais" abaixo). Antes de criar qualquer cache novo
(tabela com TTL, `useQuery`, `localStorage`/`sessionStorage`), leia isto.

## As 3 perguntas obrigatórias antes de cachear algo

1. **A chave do cache inclui TODAS as dimensões que mudam o conteúdo?**
   Se o mesmo "documento"/"id" pode gerar conteúdos diferentes dependendo de
   outro parâmetro (nível de consulta, empresa, filtro, versão do parser),
   esse parâmetro tem que fazer parte da chave — senão duas requisições
   diferentes colidem no mesmo slot de cache e uma "vaza" pra outra.

2. **A tela mostra o que foi PEDIDO, ou o que veio no objeto?**
   Reaproveitar cache mais completo pra responder um pedido mais simples é
   uma otimização legítima (evita gastar de novo). Mas a UI tem que decidir o
   que exibir com base no que o usuário pediu — nunca simplesmente renderizar
   todo campo presente no objeto, porque um cache mais rico devolvido "de
   graça" pode conter campos que o usuário não pediu pra ver naquele momento.

3. **O cache sobrevive a troca de usuário/empresa na mesma sessão de
   navegador?** `sessionStorage`/`localStorage` não são limpos ao trocar de
   conta na mesma aba — só quando a aba fecha de verdade. Qualquer dado
   sensível guardado aí precisa ser limpo explicitamente no logout.

## Onde cada tipo de cache vive hoje

| Tipo | Onde | TTL / invalidação |
|---|---|---|
| Cache de API paga (Assertiva) | `assertiva_cache_factoring` (tabela, `chave` versionada) | 30 dias, chave inclui `ASSERTIVA_CACHE_VERSION` + nível (`basico`/`completo`) — ver `src/lib/assertiva/server.ts` |
| Cache de leitura no cliente | `@tanstack/react-query` (`QueryProvider`, `staleTime: 60s` global) | por `queryKey` — inclua toda dimensão relevante (ver correção em `ClienteSheet.tsx`) |
| Preferência de UI persistida | `localStorage` (`srsm:empresa_id`, `sidebar-collapsed`) | `srsm:empresa_id` é limpo no `SIGNED_OUT` (`EmpresaContext.tsx`) — qualquer chave nova de preferência por usuário precisa do mesmo tratamento |
| Rascunho de formulário | `sessionStorage` via `src/lib/utils/formDraft.ts` | chaves centralizadas em `formDraft.ts` (`RASCUNHO_*`) — **sempre** adicionar chave nova à lista `TODAS_AS_CHAVES_DE_RASCUNHO` nesse arquivo, senão `limparTodosRascunhos()` (chamado no logout) não limpa |

## Casos reais que já aconteceram aqui

- **2026-08-06 — vazamento de nível de consulta (2 tentativas até a raiz)**:
  `assertiva_cache_factoring` guardava o relatório completo (com
  score/negativações) sob uma chave que uma consulta "básica" reaproveitava
  de propósito (economia). Primeira correção: fiz a tela de cadastro decidir
  o que renderizar com base no nível selecionado — resolveu ali, mas só ali.
  Segunda consulta, mesmo CPF, **outra tela** (o painel lateral "Relatório de
  Crédito Assertiva", que só chama `<RelatorioView relatorio={dadosAssertiva} />`
  direto) voltou a mostrar score, porque o objeto `dadosAssertiva` em si
  ainda carregava os campos — só a primeira tela tinha sido ensinada a
  escondê-los. **Correção definitiva**: `sanitizarParaBasico` em
  `src/lib/assertiva/client.ts` remove os campos só-de-Completo do objeto
  ANTES dele entrar em qualquer estado de tela, na função compartilhada
  `buscarRelatorioAssertiva` que as 3 telas chamam. Lição: quando o mesmo
  objeto é renderizado em mais de um lugar, sanitizar a UI individualmente
  não escala — sanitizar na fronteira de entrada dos dados sim, porque
  cobre todo consumidor atual e futuro de uma vez (ver `sanitizarParaBasico`
  + testes em `client.test.ts`).
- **2026-08-06 — rascunho de formulário sobrevivendo a troca de usuário**:
  `sessionStorage` não é limpo ao trocar de conta na mesma aba. Um rascunho
  de cadastro de cliente/venda/empréstimo do usuário anterior podia reaparecer
  pro próximo que logasse no mesmo computador/aba (turno compartilhado).
  Corrigido centralizando as chaves em `formDraft.ts` e limpando todas no
  evento `SIGNED_OUT` do `EmpresaContext`.

## Checklist pra quem for criar um cache novo

- [ ] A chave inclui toda dimensão que muda o formato/conteúdo do dado?
- [ ] Se reaproveitar cache "maior" pra responder pedido "menor", a UI filtra
      pelo que foi pedido, não pelo que veio?
- [ ] Se for tabela com TTL: incrementei a versão (`*_CACHE_VERSION`) quando
      mudo o formato do que é salvo?
- [ ] Se for `sessionStorage`/`localStorage` com dado por usuário: a chave
      está centralizada e cadastrada na limpeza de logout?
- [ ] Escrevi um teste ou pelo menos testei manualmente o caso "dado
      cacheado != dado que eu pedi agora"?
