import test from 'node:test';
import assert from 'node:assert';
import { gerarContratoComAssinaturaPDF } from '../src/lib/utils/documentos';

// Mock browser global variables that might be needed by jsPDF if executed in a pure node environment
if (typeof window === 'undefined') {
  (global as any).window = {};
}

test('PDF Generator - gerarContratoComAssinaturaPDF returns a Blob/Buffer on server-side', async (t) => {
  const mockParams = {
    contrato: {
      numero_contrato: 'EMP-2026-TEST',
      valor_principal: 1000,
      taxa_juros: 2.5,
      prazo_meses: 12,
      valor_parcela: 100,
      total_pagar: 1200,
      total_juros: 200,
      data_liberacao: '2026-06-16',
      garantias: 'Notebook gamer',
      observacoes: 'Test contract notes [Mora: 0.033% ao dia]'
    },
    cliente: {
      nome: 'TEST CLIENT',
      cpf: '12345678901',
      telefone: '11999999999',
      endereco: 'Rua de Teste',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01001-000'
    },
    parcelas: [
      {
        numero_parcela: 1,
        data_vencimento: '2026-07-16',
        valor: 100,
        valor_principal: 80,
        valor_juros: 20
      }
    ],
    assinatura: {
      signed_at: '2026-06-16T16:00:00Z',
      ip: '192.168.1.1',
      user_agent: 'Mozilla/5.0 Test Browser',
      geolocation: 'Lat: -23.5505, Long: -46.6333',
      // Small 1x1 transparent PNG base64 for testing
      signature_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      selfie_url: '',
      doc_url: ''
    }
  };

  await t.test('Successfully generates PDF Blob on server side without FileReader errors', async () => {
    // Calling the function with output option set to blob
    const result = await gerarContratoComAssinaturaPDF(mockParams, { output: 'blob' });
    
    // Assert the result is returned successfully and is truthy
    assert.ok(result, 'PDF generation should return a truthy result');
    
    // Assert it is an object
    assert.strictEqual(typeof result, 'object', 'Result should be an object (Blob)');
  });
});
