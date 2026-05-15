export type CategoriaItem = {
  value: string
  label: string
  icone?: string
}

export const CATEGORIAS_PRODUTO: CategoriaItem[] = [
  { value: 'sala-de-estar',  label: 'Sala de Estar',    icone: '🛋️' },
  { value: 'quarto',         label: 'Quarto',            icone: '🛏️' },
  { value: 'cozinha-jantar', label: 'Cozinha e Jantar',  icone: '🍽️' },
  { value: 'escritorio',     label: 'Escritório',        icone: '💼' },
  { value: 'area-externa',   label: 'Área Externa',      icone: '🌿' },
  { value: 'infantil',       label: 'Infantil',          icone: '🧸' },
  { value: 'decoracao',      label: 'Decoração',         icone: '🎨' },
  { value: 'estofados',      label: 'Estofados',         icone: '🪑' },
]

export const CATEGORIAS_CONTA_PAGAR: CategoriaItem[] = [
  { value: 'aluguel',     label: 'Aluguel' },
  { value: 'agua',        label: 'Água' },
  { value: 'luz',         label: 'Luz / Energia' },
  { value: 'internet',    label: 'Internet' },
  { value: 'telefone',    label: 'Telefone' },
  { value: 'fornecedor',  label: 'Fornecedor' },
  { value: 'salario',     label: 'Salário' },
  { value: 'comissao',    label: 'Comissão' },
  { value: 'imposto',     label: 'Imposto / Tributo' },
  { value: 'manutencao',  label: 'Manutenção' },
  { value: 'marketing',   label: 'Marketing / Publicidade' },
  { value: 'frete',       label: 'Frete / Logística' },
  { value: 'servico',     label: 'Serviço' },
  { value: 'outros',      label: 'Outros' },
]

export const PARENTESCOS: CategoriaItem[] = [
  { value: 'conjuge',    label: 'Cônjuge / Companheiro(a)' },
  { value: 'pai_mae',    label: 'Pai / Mãe' },
  { value: 'filho_a',    label: 'Filho(a)' },
  { value: 'irmao_a',    label: 'Irmão(ã)' },
  { value: 'avo',        label: 'Avô / Avó' },
  { value: 'tio_a',      label: 'Tio(a)' },
  { value: 'sobrinho_a', label: 'Sobrinho(a)' },
  { value: 'primo_a',    label: 'Primo(a)' },
  { value: 'amigo_a',    label: 'Amigo(a)' },
  { value: 'colega',     label: 'Colega de Trabalho' },
  { value: 'vizinho_a',  label: 'Vizinho(a)' },
  { value: 'outros',     label: 'Outros' },
]

export const TIPOS_DOCUMENTO: CategoriaItem[] = [
  { value: 'rg',                     label: 'RG (Frente)' },
  { value: 'rg_verso',               label: 'RG (Verso)' },
  { value: 'cpf',                    label: 'CPF' },
  { value: 'cnh',                    label: 'CNH' },
  { value: 'comprovante_renda',      label: 'Comprovante de Renda' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'contrato_social',        label: 'Contrato Social' },
  { value: 'selfie',                 label: 'Selfie com Documento' },
  { value: 'outros',                 label: 'Outros' },
]

export const ESTADOS_CIVIS: CategoriaItem[] = [
  { value: 'solteiro',   label: 'Solteiro(a)' },
  { value: 'casado',     label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo',      label: 'Viúvo(a)' },
  { value: 'uniao_est',  label: 'União Estável' },
]

export const BANCOS_BRASIL: { codigo: string; nome: string }[] = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '069', nome: 'Banco Crefisa' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '197', nome: 'Stone' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '260', nome: 'Nu Pagamentos (Nubank)' },
  { codigo: '290', nome: 'PagBank (PagSeguro)' },
  { codigo: '318', nome: 'Banco BMG' },
  { codigo: '323', nome: 'MercadoPago' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '380', nome: 'PicPay' },
  { codigo: '389', nome: 'Banco Mercantil do Brasil' },
  { codigo: '422', nome: 'Banco Safra' },
  { codigo: '633', nome: 'Banco Rendimento' },
  { codigo: '637', nome: 'Banco Sofisa' },
  { codigo: '655', nome: 'Banco Votorantim' },
  { codigo: '707', nome: 'Banco Daycoval' },
  { codigo: '745', nome: 'Citibank' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '999', nome: 'Outro' },
]

export const TIPOS_CONTA_BANCARIA: CategoriaItem[] = [
  { value: 'corrente',  label: 'Conta Corrente' },
  { value: 'poupanca',  label: 'Conta Poupança' },
  { value: 'pagamento', label: 'Conta de Pagamento' },
  { value: 'salario',   label: 'Conta Salário' },
]
