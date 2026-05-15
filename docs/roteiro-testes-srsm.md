# Roteiro de Testes — Grupo SRSM

## 1. Autenticação

- [ ] Login com e-mail e senha válidos → redireciona ao dashboard correto
- [ ] Login com senha errada → exibe mensagem de erro clara
- [ ] Logout → redireciona para /login
- [ ] Sessão expirada → redireciona automaticamente para /login
- [ ] Acesso direto a rota protegida sem login → redireciona para /login

---

## 2. Seleção e Troca de Empresa

- [ ] Tela de seleção exibe apenas empresas do usuário
- [ ] Clicar em empresa redireciona ao dashboard correto (empório → /emporio/dashboard, factoring → /factoring/dashboard)
- [ ] Trocar empresa pelo Header → cores, menu e dados mudam
- [ ] Trocar empresa pela Sidebar → mesmo comportamento
- [ ] Dados de uma empresa não vazam para a outra

---

## 3. Permissões por Papel

- [ ] Admin: acesso a configurações, relatórios, exclusão, aprovação
- [ ] Gerente: pode vender, aprovar desconto, ver financeiro; não pode alterar configurações críticas
- [ ] Operador: pode cadastrar cliente, registrar pagamento, criar venda; não pode excluir ou configurar
- [ ] Visualizador: só visualização, botões de ação ocultos/desabilitados

---

## 4. Clientes — Empório

- [ ] Listar clientes: busca por nome, CPF, telefone
- [ ] Cadastrar cliente: todos os campos obrigatórios validados
- [ ] CPF inválido → erro ao salvar
- [ ] Editar cliente → dados atualizados
- [ ] Perfil do cliente: exibe compras, saldo devedor, histórico
- [ ] Botão WhatsApp abre link correto com número do cliente

---

## 5. Produtos e Estoque — Empório

- [ ] Listar produtos: filtrar por categoria, status
- [ ] Cadastrar produto com imagem: upload funciona
- [ ] Editar produto: preço e estoque atualizados
- [ ] Produto zerado: badge visual correto
- [ ] Estoque abaixo do mínimo: alerta visível
- [ ] Ajuste de estoque: motivo obrigatório

---

## 6. Vendas — Empório

- [ ] Criar venda: busca produto, adiciona ao carrinho, define cliente
- [ ] Aplicar desconto: exige permissão (operador não pode, gerente pode)
- [ ] Forma de pagamento: todos os tipos funcionam
- [ ] Crediário: gera parcelas corretamente
- [ ] Venda aprovada: estoque decrementado, cliente atualizado
- [ ] Cancelar venda: exige motivo, estoque revertido
- [ ] Gerar recibo de venda

---

## 7. Financeiro — Empório

- [ ] Contas a receber: filtrar por status, data
- [ ] Registrar pagamento de parcela
- [ ] Contas a pagar: criar, editar, pagar
- [ ] Fluxo de caixa: entradas e saídas corretos
- [ ] Totais batem com movimentações registradas

---

## 8. Catálogo Público — Empório

- [ ] Acessar /catalogo/[slug] sem login
- [ ] Produtos visíveis: apenas com `disponivel_catalogo = true`
- [ ] Busca de produto: funciona por nome
- [ ] Filtro por categoria: exibe apenas produtos corretos
- [ ] Botão WhatsApp abre conversa com mensagem pré-preenchida
- [ ] Layout mobile: responsivo, fácil de usar no celular

---

## 9. Clientes — Factoring

- [ ] Listar: busca por nome, CPF; score exibido
- [ ] Cadastrar: wizard 7 etapas, validações por etapa
- [ ] CPF inválido → erro em etapa 1
- [ ] Preenchimento de CEP: preenche endereço automaticamente
- [ ] Perfil: ScoreGauge animado, aba Score e Risco, empréstimos, parcelas
- [ ] Aba Score: fatores positivos/negativos, recomendação, limite sugerido, taxa sugerida
- [ ] Botão WhatsApp abre conversa com número do cliente

---

## 10. Score de Crédito

- [ ] Score calculado corretamente (0–100)
- [ ] Cliente sem histórico: score neutro (~50)
- [ ] Cliente inadimplente: score reduzido
- [ ] Cliente com histórico positivo: score elevado
- [ ] ScoreGauge anima ao carregar
- [ ] Painel admin (configurações): editar pesos das regras
- [ ] Salvar pesos: persiste no banco
- [ ] Calcular score com pesos customizados: resultado diferente dos padrões
- [ ] Simulação de score: sliders atualizam o preview em tempo real

---

## 11. Empréstimos — Factoring

- [ ] Cadastrar empréstimo: wizard 4 etapas
- [ ] Simulador: tabelas Price e SAC corretas
- [ ] Score e limite exibidos antes de confirmar
- [ ] Parcelas geradas corretamente (quantidade, datas, valores)
- [ ] Status: análise → aprovado → ativo → quitado
- [ ] Contrato: número sequencial único por ano

---

## 12. Pagamentos — Factoring

- [ ] Buscar cliente por nome/CPF
- [ ] Selecionar uma ou várias parcelas
- [ ] Aplicar desconto em R$ ou %: desconto não pode exceder total
- [ ] Motivo obrigatório para desconto
- [ ] Forma de pagamento: todos os tipos disponíveis
- [ ] Troco calculado corretamente (dinheiro)
- [ ] Confirmar pagamento: parcela marcada como paga, movimentação registrada
- [ ] Quitação automática: empréstimo quitado quando todas as parcelas são pagas
- [ ] Feedback visual animado ao confirmar

---

## 13. Inadimplentes — Factoring

- [ ] Cards coloridos por nível de atraso (1-7d cinza, 8-30d laranja, 31-60d vermelho, 60+ vermelho forte)
- [ ] Busca por nome, CPF, telefone
- [ ] Cobrar via WhatsApp: abre link com mensagem pré-preenchida
- [ ] Ver perfil: redireciona ao perfil do cliente

---

## 14. Mensagens

- [ ] Templates: editor com variáveis clicáveis
- [ ] Preview ao vivo atualiza ao digitar
- [ ] Salvar template: persiste no banco
- [ ] Fila: listar, cancelar, reenviar
- [ ] Histórico: timeline por dia, filtros funcionam

---

## 15. Configurações

### Empório
- [ ] Financeiro: prazo padrão, prefixo venda, WhatsApp
- [ ] Mensagens: editar templates, preview
- [ ] Empresa: nome, CNPJ, endereço
- [ ] Usuários: convidar, mudar papel, remover acesso

### Factoring
- [ ] Financeiro: taxas, prazos, multa, mora
- [ ] Score e Risco: editar pesos, salvar, simular
- [ ] Mensagens: editar templates com variáveis FACTORING
- [ ] Contrato: prefixo, próximo número
- [ ] Empresa: dados cadastrais
- [ ] Usuários: mesmo que empório

---

## 16. Segurança e Isolamento

- [ ] URL com ID de outro tenant retorna 404 ou dados vazios
- [ ] Endpoint de API sem cabeçalho CRON_SECRET retorna 401
- [ ] Usuário sem acesso à empresa não vê dados
- [ ] Chave de serviço não exposta no frontend

---

## 17. Responsividade

- [ ] Sidebar mobile: abre/fecha com animação suave
- [ ] Tabelas: scroll horizontal em telas pequenas
- [ ] Catálogo público: layout mobile impecável
- [ ] Formulários: campos empilhados no celular
- [ ] Dashboard: cards empilhados em 1 coluna no mobile
- [ ] Pagamento: painel de pagamento acessível no mobile
