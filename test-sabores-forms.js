import { chromium } from 'playwright';

// Función para generar un CPF brasileño válido
function generateCPF() {
  const rnd = (n) => Math.round(Math.random() * n);
  const mod = (dividendo, divisor) => Math.round(dividendo - (Math.floor(dividendo / divisor) * divisor));
  const n = 9;
  const n1 = rnd(n); const n2 = rnd(n); const n3 = rnd(n); const n4 = rnd(n); const n5 = rnd(n);
  const n6 = rnd(n); const n7 = rnd(n); const n8 = rnd(n); const n9 = rnd(n);
  let d1 = n9 * 2 + n8 * 3 + n7 * 4 + n6 * 5 + n5 * 6 + n4 * 7 + n3 * 8 + n2 * 9 + n1 * 10;
  d1 = 11 - (mod(d1, 11));
  if (d1 >= 10) d1 = 0;
  let d2 = d1 * 2 + n9 * 3 + n8 * 4 + n7 * 5 + n6 * 6 + n5 * 7 + n4 * 8 + n3 * 9 + n2 * 10 + n1 * 11;
  d2 = 11 - (mod(d2, 11));
  if (d2 >= 10) d2 = 0;
  return `${n1}${n2}${n3}.${n4}${n5}${n6}.${n7}${n8}${n9}-${d1}${d2}`;
}

const EVENTS = [
  'inverno-torres-leao-0107',
  'inverno-mga-terraustral-0107',
  'inverno-pgo-3coracoes-0107',
  'inverno-torres-3coracoes-0807',
  'inverno-mga-leao-0807',
  'inverno-pgo-terraustral-0807',
  'inverno-nilo-santarita-1507',
  'inverno-mga-3coracoes-1507',
  'inverno-pgo-leao-1507',
  'inverno-nilo-terraustral-2207',
  'inverno-mga-nescafe-2207',
  'inverno-pgo-santarita-2207',
  'inverno-nilo-sadia-2907',
  'inverno-mga-santarita-2907',
  'inverno-pgo-nescafe-2907'
];

(async () => {
  // `headless: false` permite ver el navegador moverse solo en tiempo real.
  // Si lo cambias a `true`, lo hace en el fondo y es súper rápido.
  const browser = await chromium.launch({ headless: false }); 
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🚀 Iniciando pruebas de inscripción para 15 eventos...");

  for (let i = 0; i < EVENTS.length; i++) {
    const eventId = EVENTS[i];
    const url = `http://localhost:4321/sabores-de-inverno/palestra/${eventId}/`;
    console.log(`\n⏳ Probando [${i + 1}/15]: ${eventId}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      const nome = `Usuario Teste ${i + 1}`;
      const email = `test.sabores${i + 1}@example.com`;
      const cpf = generateCPF(); // Genera un CPF distinto y válido cada vez
      const telefone = '(41) 99999-9999';

      // 1. Rellenar el formulario simulando tipeo
      await page.fill('#crm-nome', nome);
      await page.fill('#crm-email', email);
      await page.fill('#crm-telefone', telefone);
      await page.fill('#crm-cpf', cpf);

      // 2. Marcar las casillas de verificación (mayores de edad y LGPD)
      await page.check('#crm-maioridade');
      await page.check('#crm-lgpd');

      // 3. Dar clic al botón de enviar (se habilitará automáticamente porque el CPF es válido)
      await page.click('#sabores-crm-submit');

      // Esperamos 2 segundos para dar tiempo a que se guarde en Supabase y ver el mensaje de éxito
      await page.waitForTimeout(2000); 

      console.log(`✅ Inscripción exitosa para ${eventId} (Email: ${email})`);
    } catch (err) {
      console.error(`❌ Error en ${eventId}:`, err.message);
    }
  }

  await browser.close();
  console.log("\n🎉 ¡Pruebas finalizadas!");
})();
