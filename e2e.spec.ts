import { test, expect } from '@playwright/test';

test.describe('Event Registration Flow', () => {
  test('Should successfully register a new user and reject duplicates', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    // 1. Navegar a la página principal
    await page.goto('http://localhost:4321/');

    // Esperar a que los eventos carguen (buscar el botón de inscripción de algún evento activo)
    const btnInscricao = page.locator('.open-event-modal-btn:not([disabled])').first();
    await expect(btnInscricao).toBeVisible();

    // Guardar el evento al que nos vamos a inscribir (por ejemplo, el tema)
    const eventTema = await btnInscricao.getAttribute('data-event-tema');
    console.log(`Intentando inscribirse a: ${eventTema}`);

    // 2. Abrir Modal
    await btnInscricao.click();
    
    // Verificar que el modal se abrió
    const modal = page.locator('#event-modal');
    await expect(modal).toBeVisible();

    // 3. Llenar Formulario (Inscripción Exitosa)
    // Usamos un CPF dinámico/aleatorio para asegurarnos que la primera pase
    const randomCpf = `1234567${Math.floor(1000 + Math.random() * 9000)}`;
    
    await page.fill('input[name="nome"]', 'Test User E2E');
    await page.fill('input[name="email"]', `test-${randomCpf}@test.com`);
    await page.fill('input[name="telefone"]', '11999999999');
    await page.fill('input[name="cpf"]', randomCpf);
    await page.check('input[name="lgpd"]');

    // Submit
    const submitBtn = page.locator('#submit-registration-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Verificar mensaje de éxito
    const feedback = page.locator('#form-feedback');
    await expect(feedback).toBeVisible({ timeout: 10000 });
    await expect(feedback).toContainText('sucesso', { ignoreCase: true });
    
    console.log('✅ Primera inscripción (Exitosa) OK');

    // Esperar a que el modal se cierre automáticamente (según formHandler.ts son 2.5s)
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 5. Intentar inscripción duplicada con el MISMO CPF
    console.log(`Intentando inscripción DUPLICADA con CPF: ${randomCpf}`);
    await btnInscricao.click();
    await expect(modal).toBeVisible();

    await page.fill('input[name="nome"]', 'Test Duplicado');
    await page.fill('input[name="email"]', `dup-${randomCpf}@test.com`);
    await page.fill('input[name="telefone"]', '11999999999');
    await page.fill('input[name="cpf"]', randomCpf);
    await page.check('input[name="lgpd"]');

    await submitBtn.click();

    // 6. Verificar mensaje de error de duplicidad
    await expect(feedback).toBeVisible({ timeout: 10000 });
    await expect(feedback).toContainText('já está inscrito', { ignoreCase: true });
    
    console.log('✅ Segunda inscripción (Duplicada Rechazada) OK');
  });
});
