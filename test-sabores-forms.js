import { chromium } from 'playwright';

// ─────────────────────────────────────────────────────────────────────────────
// Test E2E de inscripción Sabores de Inverno.
//
// Por CADA palestra valida AMBOS canales (CRM y social = ?src=social):
//   • Si la palestra está OPEN  → inscribe y espera el feedback de éxito.
//   • Si está FULL/SOON/FINISHED → verifica que el form NO se renderiza y que
//     se muestra el bloque de estado correspondiente (p.ej. "Vagas Esgotadas"),
//     es decir, que el sistema BLOQUEA la inscripción.
//
// Uso:  node test-sabores-forms.js
// Requiere un server corriendo (dev `pnpm dev` o el contenedor). Cambiá BASE.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = process.env.SABORES_BASE || 'http://localhost:4321';

// CPF brasileño válido (distinto en cada llamada)
function generateCPF() {
  const rnd = (n) => Math.round(Math.random() * n);
  const mod = (d, v) => Math.round(d - (Math.floor(d / v) * v));
  const a = Array.from({ length: 9 }, () => rnd(9));
  let d1 = a[8]*2+a[7]*3+a[6]*4+a[5]*5+a[4]*6+a[3]*7+a[2]*8+a[1]*9+a[0]*10; d1 = 11-mod(d1,11); if (d1>=10) d1=0;
  let d2 = d1*2+a[8]*3+a[7]*4+a[6]*5+a[5]*6+a[4]*7+a[3]*8+a[2]*9+a[1]*10+a[0]*11; d2 = 11-mod(d2,11); if (d2>=10) d2=0;
  return `${a[0]}${a[1]}${a[2]}.${a[3]}${a[4]}${a[5]}.${a[6]}${a[7]}${a[8]}-${d1}${d2}`;
}

const EVENTS = [
  'inverno-torres-leao-0107', 'inverno-mga-terraustral-0107', 'inverno-pgo-3coracoes-0107',
  'inverno-torres-3coracoes-0807', 'inverno-mga-leao-0807', 'inverno-pgo-terraustral-0807',
  'inverno-nilo-santarita-1507', 'inverno-mga-3coracoes-1507', 'inverno-pgo-leao-1507',
  'inverno-nilo-terraustral-2207', 'inverno-mga-nescafe-2207', 'inverno-pgo-santarita-2207',
  'inverno-nilo-sadia-2907', 'inverno-mga-santarita-2907', 'inverno-pgo-nescafe-2907',
];

const CHANNELS = [
  { key: 'crm', suffix: '' },
  { key: 'social', suffix: '?src=social' },
];

const results = { open_ok: 0, open_fail: 0, blocked_ok: 0, blocked_fail: 0 };

// Caso OPEN: inscribe y espera el modal de éxito.
async function testOpen(page, label) {
  await page.fill('#crm-nome', `Test ${label}`);
  await page.fill('#crm-email', `test.${label.replace(/[^a-z0-9]/gi, '.')}.${Date.now()}@example.com`);
  await page.fill('#crm-telefone', '(41) 99999-9999');
  await page.fill('#crm-cpf', generateCPF());
  await page.check('#crm-maioridade');
  await page.check('#crm-lgpd');
  await page.click('#sabores-crm-submit');

  // Esperar a que el modal de feedback se abra
  await page.waitForSelector('#sabores-feedback[open]', { timeout: 10000 });
  const icon = (await page.locator('#sabores-feedback-icon').textContent().catch(() => '')) || '';
  const title = (await page.locator('#sabores-feedback-title').textContent().catch(() => '')) || '';

  if (icon.includes('🎉') || /sucesso/i.test(title)) {
    results.open_ok++;
    console.log(`  ✅ OPEN inscrito OK → "${title.trim()}"`);
  } else {
    // El form estaba OPEN pero el submit fue rechazado (p.ej. se llenó justo): lo reportamos.
    results.open_fail++;
    console.log(`  ⚠️  OPEN pero rechazado → "${title.trim()}"`);
  }
}

// Caso NO-OPEN (FULL/SOON/FINISHED): el form no debe existir y debe verse el bloque de estado.
async function testBlocked(page, state) {
  const formCount = await page.locator('#sabores-crm-form').count();
  if (formCount > 0) {
    results.blocked_fail++;
    console.log(`  ❌ estado ${state} pero el FORM SÍ aparece (debería estar bloqueado)`);
    return;
  }
  // Verificar que se muestra algún bloque de estado (título tipo "Vagas Esgotadas", etc.)
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasBlock = /Vagas Esgotadas|Em breve|Encerrad|Esgotad/i.test(bodyText);
  if (hasBlock) {
    results.blocked_ok++;
    console.log(`  ✅ ${state} bloqueado correctamente (sin form, muestra bloque de estado)`);
  } else {
    results.blocked_fail++;
    console.log(`  ⚠️  ${state} sin form pero no detecté el bloque de estado`);
  }
}

(async () => {
  console.log(`🧪 Test inscripción Sabores — ${EVENTS.length} palestras x 2 canales, contra ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  for (let i = 0; i < EVENTS.length; i++) {
    const event = EVENTS[i];
    console.log(`\n[${i + 1}/${EVENTS.length}] ${event}`);
    for (const channel of CHANNELS) {
      const label = `${event}-${channel.key}`;
      try {
        await page.goto(`${BASE}/sabores-de-inverno/palestra/${event}/${channel.suffix}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const isOpen = (await page.locator('#sabores-crm-form').count()) > 0;
        const state = isOpen ? 'OPEN' : (await page.locator('[data-status]').first().getAttribute('data-status').catch(() => 'UNKNOWN'));
        process.stdout.write(`  · ${channel.key.toUpperCase()} [${state}] `);
        if (isOpen) await testOpen(page, label);
        else await testBlocked(page, state);
      } catch (err) {
        console.log(`  ❌ ${channel.key} error: ${err.message.split('\n')[0]}`);
        results.open_fail++;
      }
    }
  }

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🎯 Resultado:`);
  console.log(`   OPEN inscritos OK:        ${results.open_ok}`);
  console.log(`   OPEN rechazados/errores:  ${results.open_fail}`);
  console.log(`   Bloqueados OK (FULL/etc): ${results.blocked_ok}`);
  console.log(`   Bloqueados mal:           ${results.blocked_fail}`);
  const failed = results.open_fail + results.blocked_fail;
  console.log(`\n${failed === 0 ? '✅ TODO OK' : `❌ ${failed} fallo(s)`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
