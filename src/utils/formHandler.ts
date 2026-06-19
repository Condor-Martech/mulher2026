import { registrationService } from "../services/registrationService";
import { track } from "../lib/track";

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

  console.log("Initializing Form Handler...");

  if (!form) {
    console.warn("Registration form not found!");
    return;
  }

  const inputs = form.querySelectorAll("input[required]");

  // Analytics: el primer focus en el form = inicio del funnel (una sola vez).
  form.addEventListener(
    "focusin",
    () => {
      const eventId = (new FormData(form).get("eventId") as string) || "";
      const srcParam = new URLSearchParams(window.location.search).get("src");
      const isRegPath =
        window.location.pathname.includes("/palestra/") ||
        window.location.pathname.includes("/programacao/");
      const source = srcParam ?? (isRegPath ? "crm" : "social");
      track("registration_started", { event_id: eventId, source });
    },
    { once: true },
  );

  const validators: Record<
    string,
    (val: string, el: HTMLInputElement) => boolean
  > = {
    nome: (val) => val.trim().length > 2,
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    telefone: (val) => val.replace(/\D/g, "").length >= 10,
    cpf: (val) => {
      const cpf = val.replace(/\D/g, "");
      if (cpf.length !== 11) return false;
      const isMaes = window.location.pathname.includes('/maes/');
      if (isMaes) {
        const cpfFilhoInput = document.getElementById("cpf_filho") as HTMLInputElement;
        if (cpfFilhoInput && cpfFilhoInput.value.replace(/\D/g, "") === cpf && cpf !== "") {
          return false;
        }
      }
      return true;
    },
    nome_filho: (val) => {
      const isMaes = window.location.pathname.includes('/maes/');
      if (!isMaes) return true; // Solo requerido en madres
      return val.trim().length > 2;
    },
    cpf_filho: (val) => {
      const isMaes = window.location.pathname.includes('/maes/');
      if (!isMaes) return true;
      const cpfFilho = val.replace(/\D/g, "");
      if (cpfFilho.length !== 11) return false;
      const cpfInput = document.getElementById("cpf") as HTMLInputElement;
      if (cpfInput && cpfInput.value.replace(/\D/g, "") === cpfFilho && cpfFilho !== "") {
        return false;
      }
      return true;
    },
    nascimento_filho: (val) => {
      const isMaes = window.location.pathname.includes('/maes/');
      if (!isMaes) return true;
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = val.match(dateRegex);
      if (!match) return false;
      const [_, dayStr, monthStr, yearStr] = match;
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return false;
      }
      
      const today = new Date();
      let age = today.getFullYear() - year;
      const m = today.getMonth() - (month - 1);
      if (m < 0 || (m === 0 && today.getDate() < day)) {
        age--;
      }
      return age >= 18;
    },
    maioridade_filho: (val, el) => {
      const isMaes = window.location.pathname.includes('/maes/');
      if (!isMaes) return true;
      return el.checked;
    },
    lgpd: (val, el) => el.checked,
  };

  const validateInput = (input: HTMLInputElement) => {
    const validator = validators[input.name];
    if (!validator) return true;

    const isValid = validator(input.value, input);
    
    // Improved error message finding (checks parent then siblings)
    let errorMsg = input.parentElement?.querySelector(".error-message");
    if (!errorMsg) {
      errorMsg = input.parentElement?.parentElement?.querySelector(".error-message");
    }

    const isMaes = window.location.pathname.includes('/maes/');
    const primaryColor = isMaes ? "maes-primary" : "primary";

    if (input.dataset.touched === "true" || (input.type === "checkbox" && !isValid)) {
      if (!isValid) {
        input.classList.add("border-red-500", "focus:ring-red-500");
        input.classList.remove(
          `border-${primaryColor}/20`,
          `focus:ring-${primaryColor}/50`,
          `focus:border-${primaryColor}`,
        );
        if (errorMsg) errorMsg.classList.remove("hidden");
      } else {
        input.classList.remove("border-red-500", "focus:ring-red-500");
        input.classList.add(
          `border-${primaryColor}/20`,
          `focus:ring-${primaryColor}/50`,
          `focus:border-${primaryColor}`,
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
    
    if (submitBtn) {
      submitBtn.disabled = !isFormValid;
      // Visual feedback for disabled button
      if (submitBtn.disabled) {
        submitBtn.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }
  };

  inputs.forEach((i) => {
    const input = i as HTMLInputElement;
    
    const onInputOrChange = () => {
      input.dataset.touched = "true";
      if (input.name === "telefone") {
        let v = input.value.replace(/\D/g, "");
        v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        v = v.replace(/(\d)(\d{4})$/, "$1-$2");
        input.value = v;
      }
      if (input.name === "cpf" || input.name === "cpf_filho") {
        let v = input.value.replace(/\D/g, "");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        input.value = v;
      }
      if (input.name === "nascimento_filho") {
        let v = input.value.replace(/\D/g, "");
        if (v.length > 8) v = v.slice(0, 8);
        v = v.replace(/^(\d{2})(\d)/, "$1/$2");
        v = v.replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
        input.value = v;
      }
      checkFormValidity();
    };

    input.addEventListener("input", onInputOrChange);
    input.addEventListener("blur", () => {
      input.dataset.touched = "true";
      checkFormValidity();
    });
    input.addEventListener("change", onInputOrChange);
  });

  // initial check
  checkFormValidity();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    checkFormValidity();
    if (submitBtn && submitBtn.disabled) return;

    const btnText = document.getElementById("submit-text");

    // 1. Mostrar estado "Loading"
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-70");
    }
    if (btnText) btnText.textContent = "Processando...";
    if (spinner) spinner.classList.remove("hidden");

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Capture source from URL (path /palestra/ implies crm by default)
    const urlParams = new URLSearchParams(window.location.search);
    const srcParam = urlParams.get('src');
    const isRegistrationPath = window.location.pathname.includes('/palestra/') || window.location.pathname.includes('/programacao/');
    const source = srcParam ?? (isRegistrationPath ? 'crm' : 'social');

    // Analytics: dedup de fallos (un solo registration_failed por envío).
    let failureTracked = false;
    const trackFailure = (errorType: string) => {
      if (failureTracked) return;
      failureTracked = true;
      track("registration_failed", {
        event_id: data.eventId as string,
        source,
        error_type: errorType,
      });
    };

    track("registration_submitted", {
      event_id: data.eventId as string,
      source,
    });

    const feedbackModal = document.getElementById("feedback-modal") as HTMLDialogElement;
    const feedbackIcon = document.getElementById("feedback-icon");
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackMessage = document.getElementById("feedback-message");
    
    // Función auxiliar para configurar y mostrar el modal
    const showFeedback = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
      const isMaes = window.location.pathname.includes('/maes/');
      
      if (feedbackIcon && feedbackTitle && feedbackMessage) {
        feedbackIcon.className = "mb-6 text-6xl" + (type === 'success' ? " animate-bounce" : "");
        feedbackIcon.innerHTML = type === 'success' ? "🎉" : type === 'error' ? "❌" : "⚠️";
        
        if (type === 'success') {
          feedbackTitle.className = `text-3xl font-black mb-4 ${isMaes ? 'text-maes-primary' : 'text-green-600'}`;
        } else if (type === 'error') {
          feedbackTitle.className = `text-3xl font-black mb-4 ${isMaes ? 'text-maes-wine' : 'text-red-600'}`;
        } else {
          feedbackTitle.className = `text-3xl font-black mb-4 ${isMaes ? 'text-maes-primary' : 'text-orange-600'}`;
        }
        
        feedbackTitle.textContent = title;
        feedbackMessage.textContent = message;
      }
      
      if (modal && typeof (modal as any).close === 'function') {
        try { modal.close(); } catch(e) {}
      }
      
      if (feedbackModal) {
        console.log("Opening feedback modal:", type, title);
        setTimeout(() => {
          feedbackModal.showModal();
        }, 100);
      } else {
        console.error("Feedback modal not found in DOM!");
        // Fallback if modal fails
        alert(`${title}: ${message}`);
      }
    };

    try {
      console.log("Submitting registration...", { data, source });
      const result = await registrationService.submitRegistration(data, source);

      if (!result.success) {
        const errorType = result.error;
        console.warn("Registration failed:", errorType);
        trackFailure(errorType ?? "unknown");

        if (errorType === 'SAME_CPF') {
          showFeedback('warning', 'CPFs Iguais', 'O CPF do titular não pode ser o mesmo do acompanhante.');
        } else if (errorType === 'ALREADY_REGISTERED') {
          showFeedback('warning', 'Inscrição Duplicada', 'Um dos CPFs informados já está inscrito para um evento desta campanha.');
        } else if (errorType === 'UNDERAGE_CHILD') {
          showFeedback('error', 'Requisito de Idade', 'O(a) filho(a) deve ser maior de 18 anos para participar deste evento.');
        } else if (errorType === 'QUOTA_FULL') {
          showFeedback('error', 'Vagas Esgotadas', 'Desculpe, as inscrições para esta fonte (CRM/Social) estão esgotadas.');
        } else if (errorType === 'NOT_OPEN_YET') {
          showFeedback('warning', 'Aguarde', 'As inscrições para este evento ainda não abriram.');
        } else if (errorType === 'EVENT_CLOSED') {
          showFeedback('error', 'Evento Encerrado', 'Desculpe, as inscrições para este evento foram encerradas.');
        } else {
          throw new Error(errorType || "Unknown error");
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("opacity-70");
        }
        if (btnText) btnText.textContent = "Confirmar Inscrição";
        if (spinner) spinner.classList.add("hidden");
        return;
      }

      // 3. Manejo de Éxito
      console.log("Registration successful!");
      track("registration_succeeded", {
        event_id: data.eventId as string,
        source,
      });
      showFeedback('success', 'Inscrição Confirmada!', 'Sua inscrição foi realizada com sucesso. Te esperamos lá!');

      if (form) form.reset();
      if (btnText) btnText.textContent = "Concluído";
      if (spinner) spinner.classList.add("hidden");

    } catch (err) {
      console.error("DEBUG SUBMIT ERROR:", err);
      trackFailure("technical");
      // 4. Manejo de Error de Conexión/Servidor
      showFeedback('error', 'Erro Técnico', 'Ocorreu um erro ao processar sua inscrição. Por favor, tente novamente mais tarde.');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70");
      }
      if (btnText) btnText.textContent = "Tentar Novamente";
      if (spinner) spinner.classList.add("hidden");
    }
  });
}
