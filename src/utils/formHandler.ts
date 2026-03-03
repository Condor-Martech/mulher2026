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

    if (feedback) {
      feedback.classList.add("hidden");
      feedback.className =
        "hidden text-center mt-4 font-medium rounded-xl p-4 transition-all duration-300";
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Capture source from URL
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('src') || 'social';

    try {
      const result = await registrationService.submitRegistration(data, source);

      if (!result.success) {
        const errorType = result.error;
        
        if (errorType === 'ALREADY_REGISTERED') {
          if (feedback) {
            feedback.innerHTML = "⚠️ Este CPF já está inscrito para este evento.";
            feedback.className = "block text-center mt-4 font-medium rounded-xl p-4 bg-orange-100 text-orange-700 border border-orange-200";
            feedback.classList.remove("hidden");
          }
        } else if (errorType === 'QUOTA_FULL') {
          if (feedback) {
            feedback.innerHTML = "🚫 Desculpe, as inscrições para esta fonte (CRM/Social) estão esgotadas.";
            feedback.className = "block text-center mt-4 font-medium rounded-xl p-4 bg-red-100 text-red-700 border border-red-200";
            feedback.classList.remove("hidden");
          }
        } else if (errorType === 'NOT_OPEN_YET') {
          if (feedback) {
            feedback.innerHTML = "⏳ As inscrições para este evento ainda não abriram.";
            feedback.className = "block text-center mt-4 font-medium rounded-xl p-4 bg-blue-100 text-blue-700 border border-blue-200";
            feedback.classList.remove("hidden");
          }
        } else {
          throw new Error(errorType || "Unknown error");
        }

        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = "Confirmar Inscrição";
        if (spinner) spinner.classList.add("hidden");
        return;
      }

      // 3. Manejo de Éxito
      if (feedback) {
        feedback.innerHTML = "🎉 Inscrição realizada com sucesso!";
        feedback.className = "block text-center mt-4 font-medium rounded-xl p-4 bg-green-100 text-green-700 border border-green-200 animate-[pulse_1.5s_ease-in-out_infinite]";
        feedback.classList.remove("hidden");
      }

      if (btnText) btnText.textContent = "Concluído";
      if (spinner) spinner.classList.add("hidden");

      // Timeout para fechar el modal
      setTimeout(() => {
        if (modal) modal.close();
      }, 2500);
    } catch (err) {
      // 4. Manejo de Error de Conexión/Servidor
      if (feedback) {
        feedback.textContent = "❌ Ocorreu um erro técnico. Tente novamente.";
        feedback.classList.add(
          "block",
          "bg-red-100",
          "text-red-700",
          "border",
          "border-red-200",
        );
        feedback.classList.remove("hidden");
      }

      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Tentar Novamente";
      if (spinner) spinner.classList.add("hidden");
    }
  });
}
