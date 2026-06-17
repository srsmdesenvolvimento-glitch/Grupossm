async function run() {
  const apiUrl = 'https://evolution-deploy-237v.onrender.com';
  const apiKey = 'srsm_secret_key';
  const instanceName = 'srsm';
  const number = '5562981764801';

  console.log('Sending text message using fetch...');
  const startTime = Date.now();
  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: number,
        text: 'Teste de velocidade de envio direto da Evolution API no Render.',
        options: {
          delay: 0
        }
      }),
    });

    const duration = Date.now() - startTime;
    console.log('STATUS:', res.status);
    console.log('DURATION:', duration, 'ms');
    const body = await res.text();
    console.log('BODY:', body);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
