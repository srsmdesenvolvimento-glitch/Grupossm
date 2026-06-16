const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const empresaId = 'b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2';
  const cpf = '05396126183';
  const numeroContrato = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  console.log('1. Checking/Creating client GUSTAVO GOMES FRANCO LEITE...');
  let clienteId = '';
  
  // Try to find if client already exists
  const { data: existingClient } = await supabase
    .from('clientes_factoring')
    .select('id')
    .eq('cpf', cpf)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (existingClient) {
    console.log(`Client already exists with ID: ${existingClient.id}`);
    clienteId = existingClient.id;
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from('clientes_factoring')
      .insert({
        empresa_id: empresaId,
        nome: 'GUSTAVO GOMES FRANCO LEITE',
        cpf: cpf,
        rg: '7192834',
        orgao_emissor: 'SSP/DF',
        data_nascimento: '2004-11-26',
        estado_civil: 'solteiro',
        profissao: 'Desenvolvedor',
        renda_mensal: 3500.00,
        telefone: '62992504174',
        email: 'gustavo@teste.com',
        cep: '74968491',
        endereco: 'Rua dos Maristas',
        numero: 'QD 22 LT 8',
        bairro: 'Residencial Village Garavelo',
        cidade: 'Aparecida de Goiânia',
        estado: 'GO',
        limite_credito: 10000,
        credito_utilizado: 0,
        score_interno: 85,
        total_emprestimos: 0,
        valor_total_emprestado: 0,
        documentos: [],
        status: 'ativo',
      })
      .select('id')
      .single();

    if (clientErr) throw clientErr;
    console.log(`Created new client with ID: ${newClient.id}`);
    clienteId = newClient.id;
  }

  console.log(`2. Creating mock loan ${numeroContrato}...`);
  const { data: loan, error: loanErr } = await supabase
    .from('emprestimos')
    .insert({
      empresa_id: empresaId,
      numero_contrato: numeroContrato,
      cliente_id: clienteId,
      valor_principal: 3000,
      taxa_juros: 5,
      tipo_taxa: 'mensal',
      prazo_meses: 6,
      valor_parcela: 562.5,
      total_pagar: 3375,
      total_juros: 375,
      valor_entrada: 0,
      saldo_devedor: 3375,
      data_primeiro_vencimento: '2026-07-16',
      status: 'analise',
      documentos: [],
      observacoes: 'Contrato de teste para assinatura eletrônica.',
    })
    .select('id')
    .single();

  if (loanErr) throw loanErr;
  console.log(`Created loan with ID: ${loan.id}`);

  console.log('3. Creating mock installments...');
  const installments = [];
  for (let i = 1; i <= 6; i++) {
    const date = new Date(2026, 6 + i, 16); // 2026-07-16, 2026-08-16, ...
    const dateString = date.toISOString().split('T')[0];
    
    installments.push({
      empresa_id: empresaId,
      emprestimo_id: loan.id,
      cliente_id: clienteId,
      numero_parcela: i,
      total_parcelas: 6,
      valor: 562.5,
      valor_principal: 500,
      valor_juros: 62.5,
      saldo_devedor_antes: 3000 - (i - 1) * 500,
      saldo_devedor_apos: 3000 - i * 500,
      data_vencimento: dateString,
      status: 'pendente',
      multa: 0,
      juros_mora: 0,
    });
  }

  const { error: instErr } = await supabase
    .from('parcelas_emprestimo')
    .insert(installments);

  if (instErr) throw instErr;
  console.log('Mock installments created successfully!');

  console.log('\n==================================================');
  console.log('Mock data ready! Use the link below to test the signature:');
  console.log(`http://localhost:3000/assinar/${loan.id}`);
  console.log('==================================================\n');
}

run().catch(console.error);
