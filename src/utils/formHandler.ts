import { registrationService } from "../services/registrationService";

export function initFormHandler() {
  const modal = document.getElementById("event-modal") as HTMLDialogElement;
  const form = document.getElementById(
    "event-registration-form",
  ) as HTMLFormElement;
  const submitBtn = document.getElementById(
    "submit-registration-btn",
  ) as HTMLButtonElement;
  const spinner = document.getElementById("submit-spinner");
  const feedback = document.getElementById("form-feedback");

  if (!form) return;

  const inputs = form.querySelectorAll("input[required]");

  const validators: Record<
    string,
    (val: string, el: HTMLInputElement) => boolean
  > = {
    nome: (val) => val.trim().length > 2,
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    telefone: (val) => val.replace(/\D/g, "").length >= 10,
    cpf: (val) => val.replace(/\D/g, "").length === 11,
    lgpd: (val, el) => el.checked,
  };

  const validateInput = (input: HTMLInputElement) => {
    const validator = validators[input.name];
    if (!validator) return true;

    const isValid = validator(input.value, input);
    const errorMsg = input.parentElement?.querySelector(".error-message");

    if (input.dataset.touched === "true") {
      if (!isValid) {
        input.classList.add("border-red-500", "focus:ring-red-500");
        input.classList.remove(
          "border-primary/20",
          "focus:ring-primary/50",
          "focus:border-primary",
        );
        if (errorMsg) errorMsg.classList.remove("hidden");
      } else {
        input.classList.remove("border-red-500", "focus:ring-red-500");
        input.classList.add(
          "border-primary/20",
          "focus:ring-primary/50",
          "focus:border-primary",
        );
        if (errorMsg) errorMsg.classList.add("hidden");
      }
    }
    return isValid;
  };

  const checkFormValidity = () => {
    let isFormValid = true;
    inputs.forEach((i) => {
      const input = i as HTMLInputElement;
      if (!validateInput(input)) {
        isFormValid = false;
      }
    });
    if (submitBtn) submitBtn.disabled = !isFormValid;
  };

  inputs.forEach((i) => {
    const input = i as HTMLInputElement;
    input.addEventListener("input", () => {
      input.dataset.touched = "true";
      if (input.name === "telefone") {
        let v = input.value.replace(/\D/g, "");
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d)(\d{4})$/, "$1-$2");
        input.value = v;
      }
      if (input.name === "cpf") {
        let v = input.value.replace(/\D/g, "");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        input.value = v;
      }
      checkFormValidity();
    });
    input.addEventListener("blur", () => {
      input.dataset.touched = "true";
      checkFormValidity();
    });
    input.addEventListener("change", () => {
      if (input.type === "checkbox") {
        input.dataset.touched = "true";
      }
      checkFormValidity();
    });
  });

  // initial check
  checkFormValidity();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    checkFormValidity();
    if (submitBtn && submitBtn.disabled) return;

    const btnText = document.getElementById("submit-text");

    // 1. Mostrar estado "Loading"
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Processando...";
    if (spinner) spinner.classList.remove("hidden");

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Capture source from URL (path /palestra/ implies crm by default)
    const urlParams = new URLSearchParams(window.location.search);
    const srcParam = urlParams.get('src');
    const isPalestraPath = window.location.pathname.includes('/palestra/');
    const source = srcParam ?? (isPalestraPath ? 'crm' : 'social');

    const feedbackModal = document.getElementById("feedback-modal") as HTMLDialogElement;
    const feedbackIcon = document.getElementById("feedback-icon");
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackMessage = document.getElementById("feedback-message");
    
    // Función auxiliar para configurar y mostrar el modal
    const showFeedback = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
      if (feedbackIcon && feedbackTitle && feedbackMessage) {
        if (type === 'success') {
          feedbackIcon.className = "mb-6 text-6xl text-green-500 animate-bounce";
          feedbackIcon.innerHTML = "🎉";
          feedbackTitle.className = "text-3xl font-black mb-4 text-green-600";
        } else if (type === 'error') {
          feedbackIcon.className = "mb-6 text-6xl text-red-500";
          feedbackIcon.innerHTML = "❌";
          feedbackTitle.className = "text-3xl font-black mb-4 text-red-600";
        } else if (type === 'warning') {
          feedbackIcon.className = "mb-6 text-6xl text-orange-500";
          feedbackIcon.innerHTML = "⚠️";
          feedbackTitle.className = "text-3xl font-black mb-4 text-orange-600";
        }
        
        feedbackTitle.textContent = title;
        feedbackMessage.textContent = message;
      }
      
      // Cerrar modal actual
      if (modal) modal.close();
      
      // Mostrar nuevo modal
      if (feedbackModal) {
        /* Pequeño timeout para permitir la animación de cierre del otro modal (opcional) */
        setTimeout(() => {
          feedbackModal.showModal();
        }, 100);
      }
    };

    try {
      const result = await registrationService.submitRegistration(data, source);

      if (!result.success) {
        const errorType = result.error;
        
        if (errorType === 'ALREADY_REGISTERED') {
          showFeedback('warning', 'Inscrição Duplicada', 'Este CPF já está inscrito para este evento.');
        } else if (errorType === 'QUOTA_FULL') {
          showFeedback('error', 'Vagas Esgotadas', 'Desculpe, as inscrições para esta fonte (CRM/Social) estão esgotadas.');
        } else if (errorType === 'NOT_OPEN_YET') {
          showFeedback('warning', 'Aguarde', 'As inscrições para este evento ainda não abriram.');
        } else if (errorType === 'EVENT_CLOSED') {
          showFeedback('error', 'Evento Encerrado', 'Desculpe, as inscrições para este evento foram encerradas.');
        } else {
          throw new Error(errorType || "Unknown error");
        }

        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = "Confirmar Inscrição";
        if (spinner) spinner.classList.add("hidden");
        return;
      }

      // 3. Manejo de Éxito
      showFeedback('success', 'Inscrição Confirmada!', 'Sua inscrição foi realizada com sucesso. Te esperamos lá!');

      if (btnText) btnText.textContent = "Concluído";
      if (spinner) spinner.classList.add("hidden");

    } catch (err) {
      console.error("DEBUG SUBMIT ERROR:", err);
      // 4. Manejo de Error de Conexión/Servidor
      showFeedback('error', 'Erro Técnico', 'Ocorreu um erro ao processar sua inscrição. Por favor, tente novamente mais tarde.');

      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Tentar Novamente";
      if (spinner) spinner.classList.add("hidden");
    }
  });
}
