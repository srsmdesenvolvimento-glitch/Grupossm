# Melhorias Futuras — Grupo SRSM

Roadmap organizado por prioridade. P0 = bloqueador de lançamento. P1 = próximo sprint. P2 = backlog.

---

## P0 — Antes do lançamento

### Autenticação
- [ ] Recuperação de senha por e-mail (Supabase Auth reset)
- [ ] Página de convite de usuário funcional (token via e-mail)
- [ ] Timeout de sessão com aviso antes de expirar

### Segurança
- [ ] Row Level Security (RLS) habilitado em todas as tabelas no Supabase
- [ ] Variável `CRON_SECRET` configurada em produção
- [ ] Auditoria: log de operações críticas (exclusão de cliente, aprovação de empréstimo)

### Financeiro Factoring
- [ ] Renegociação de parcelas: estender prazo, nova taxa
- [ ] Extrato PDF por cliente (resumo de empréstimos + parcelas)

---

## P1 — Próximo sprint

### Clientes — Factoring
- [ ] Importação em lote via CSV (nome, CPF, telefone, endereço)
- [ ] Histórico de alterações de status (ativo → bloqueado → ativo)
- [ ] Campo "data do último contato" para acompanhamento de cobrança
- [ ] Busca avançada: por score, por valor em aberto, por cidade

### Clientes — Empório
- [ ] Perfil premium completo (análogo ao factoring): compras, saldo, histórico
- [ ] Importação via CSV

### Score de Crédito
- [ ] Integração com bureaus externos (Serasa/SPC via API parceira) — opcional
- [ ] Histórico de score: gráfico de evolução ao longo do tempo
- [ ] Exportar relatório de análise de crédito em PDF

### Empréstimos
- [ ] Contrato gerado automaticamente em PDF (assinatura digital futura)
- [ ] Fluxo de renegociação com nova tabela Price/SAC
- [ ] Aprovação multi-nível: operador propõe → gerente aprova → admin libera

### Vendas — Empório
- [ ] Impressão de recibo (PDF ou térmica 80mm)
- [ ] Integração com leitor de código de barras (câmera do dispositivo)
- [ ] Desconto por categoria de produto

### Estoque — Empório
- [ ] Relatório de giro de estoque por período
- [ ] Alerta automático (e-mail/WhatsApp) quando produto atinge mínimo
- [ ] Múltiplos fornecedores por produto com histórico de preço

---

## P2 — Backlog

### Mensagens
- [ ] Disparo em massa com filtro (todos inadimplentes, todos com parcela vencendo em X dias)
- [ ] Agendamento de mensagem individual com data/hora
- [ ] WhatsApp Business API oficial (Meta) para alto volume
- [ ] Integração com e-mail (SendGrid/Resend) como fallback

### Relatórios
- [ ] Dashboard financeiro consolidado (Empório + Factoring juntos para admin master)
- [ ] Relatório de comissões por vendedor (Empório)
- [ ] DRE simplificado mensal (Factoring)
- [ ] Exportar qualquer tabela para Excel/CSV

### Mobile
- [ ] PWA (Progressive Web App) com ícone na tela inicial
- [ ] Notificações push para pagamentos recebidos e parcelas vencidas
- [ ] Modo offline básico para consulta de clientes (Service Worker)

### Produto
- [ ] Multi-idioma (pt-BR base, en futura)
- [ ] Tema claro/escuro (dark mode para sidebar já existe, estender para conteúdo)
- [ ] Onboarding guiado para novos usuários (tour interativo)
- [ ] Painel de super-admin: gerenciar todas as empresas do grupo
- [ ] API pública documentada (OpenAPI 3.1) para integrações externas

### Infra
- [ ] CI/CD: pipeline GitHub Actions com lint + typecheck + build
- [ ] Testes automatizados E2E com Playwright (golden paths)
- [ ] Monitoramento de erros com Sentry
- [ ] Backup diário do banco de dados (Supabase já faz, configurar retenção)
- [ ] Rate limiting na API (Upstash Redis)

---

## Decisões técnicas pendentes

| Decisão | Opções | Recomendação |
|---|---|---|
| PDF de contratos | react-pdf / puppeteer / jsPDF | react-pdf (server component) |
| Assinatura digital | DocuSign / D4Sign / ClickSign | D4Sign (custo menor, BR) |
| Bureaus de crédito | Serasa API / SPC / Quod | Quod (melhor API + preço) |
| Push notifications | Web Push / OneSignal / Firebase | OneSignal (free tier generoso) |
| Deploy | Vercel / Railway / ECS | Vercel (zero config, já integrado) |
