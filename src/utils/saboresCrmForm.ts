import { registrationService } from "../services/registrationService";
import { track } from "../lib/track";

/**
 * Sabores de Inverno — wiring del formulario de la landing directa (canal CRM).
 *
 * Espeja la validación/formateo/envío/feedback del handler social
 * ([saboresRegistration.ts]) pero para un form server-rendered standalone
 * (sin modal ni carrusel): la página `/palestra/[id]` ya decidió en SSR si
 * mostrar el form (status OPEN). El `source` llega por `data-source` (default
 * "crm", el canal por defecto de las landings directas).
 *
 * Self-contained: reusa solo la capa de datos (registrationService → RPC) y el
 * SaboresFeedbackModal (mismos IDs `#sabores-feedback-*`).
 */
export function initSaboresCrmForm() {
  if ((window as any).__saboresCrmInit) return;
  (window as any).__saboresCrmInit = true;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;

  const form = $("sabores-crm-form") as HTMLFormElement | null;
  if (!form) return;

  const feedback = $("sabores-feedback") as HTMLDialogElement | null;
  const idInput = $("sabores-crm-event-id") as HTMLInputElement | null;
  const submitBtn = $("sabores-crm-submit") as HTMLButtonElement | null;
  const submitText = $("sabores-crm-submit-text");
  const spinner = $("sabores-crm-spinner");

  // Canal: las landings directas son CRM por defecto (?src=social lo cambia en SSR).
  const source = form.dataset.source === "social" ? "social" : "crm";

  const inputs = () =>
    Array.from(form.querySelectorAll<HTMLInputElement>("input[name]"));

  // ─────────────────────────── Validación ────────────────────────────────
  const validators: Record<string, (el: HTMLInputElement) => boolean> = {
    nome: (el) => el.value.trim().length > 2,
    email: (el) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value),
    telefone: (el) => el.value.replace(/\D/g, "").length >= 10,
    cpf: (el) => el.value.replace(/\D/g, "").length === 11,
    lgpd: (el) => el.checked,
    maioridade: (el) => !el.required || el.checked,
  };

  const validateField = (el: HTMLInputElement): boolean => {
    const v = validators[el.name];
    if (!v) return true;
    const ok = v(el);
    const err = el
      .closest("div,label")
      ?.querySelector<HTMLElement>(".sabores-error");
    const touched = el.dataset.touched === "true";
    if (touched && el.type !== "checkbox") {
      el.classList.toggle("border-red-500", !ok);
    }
    if (touched || el.type === "checkbox") err?.classList.toggle("hidden", ok);
    return ok;
  };

  const checkValidity = (): boolean => {
    const ok = inputs().every(validateField);
    if (submitBtn) submitBtn.disabled = !ok;
    return ok;
  };

  // Formateo en vivo + revalidación.
  inputs().forEach((el) => {
    const onInput = () => {
      el.dataset.touched = "true";
      if (el.name === "telefone") {
        let v = el.value.replace(/\D/g, "").slice(0, 11);
        v = v
          .replace(/^(\d{2})(\d)/g, "($1) $2")
          .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
        el.value = v;
      }
      if (el.name === "cpf") {
        let v = el.value.replace(/\D/g, "").slice(0, 11);
        v = v
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        el.value = v;
      }
      checkValidity();
    };
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    el.addEventListener("blur", () => {
      el.dataset.touched = "true";
      checkValidity();
    });
  });

  // Inicio del funnel (una sola vez).
  form.addEventListener(
    "focusin",
    () =>
      track("registration_started", {
        event_id: idInput?.value || "",
        source,
      }),
    { once: true },
  );

  // ─────────────────────────── Envío ─────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    inputs().forEach((el) => (el.dataset.touched = "true"));
    if (!checkValidity()) return;

    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = "Processando...";
    spinner?.classList.remove("hidden");

    const data = Object.fromEntries(new FormData(form).entries());
    const eventId = data.eventId as string;
    track("registration_submitted", { event_id: eventId, source });

    try {
      const result = await registrationService.submitRegistration(data, source);
      if (!result.success) {
        track("registration_failed", {
          event_id: eventId,
          source,
          error_type: result.error || "unknown",
        });
        showFeedback("warning", errorTitle(result.error), errorMessage(result.error));
        restoreSubmit();
        return;
      }
      track("registration_succeeded", { event_id: eventId, source });
      showFeedback(
        "success",
        "Inscrição confirmada!",
        "Sua inscrição foi realizada com sucesso. Te esperamos lá!",
      );
      form.reset();
      restoreSubmit("Concluído");
    } catch (err) {
      console.error("Sabores CRM registration error:", err);
      track("registration_failed", {
        event_id: eventId,
        source,
        error_type: "technical",
      });
      showFeedback(
        "error",
        "Erro técnico",
        "Ocorreu um erro ao processar sua inscrição. Tente novamente mais tarde.",
      );
      restoreSubmit("Tentar novamente");
    }
  });

  function restoreSubmit(text = "Confirmar inscrição") {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = text;
    spinner?.classList.add("hidden");
  }

  // ─────────────────────────── Feedback ──────────────────────────────────
  function showFeedback(
    type: "success" | "error" | "warning",
    title: string,
    message: string,
  ) {
    const icon = $("sabores-feedback-icon");
    const t = $("sabores-feedback-title");
    const m = $("sabores-feedback-message");
    if (icon)
      icon.textContent =
        type === "success" ? "🎉" : type === "error" ? "❌" : "⚠️";
    if (t) t.textContent = title;
    if (m) m.textContent = message;
    feedback?.showModal();
  }
  $("sabores-feedback-ok")?.addEventListener("click", () => feedback?.close());
  $("sabores-feedback-close")?.addEventListener("click", () =>
    feedback?.close(),
  );
  feedback?.addEventListener("click", (e) => {
    if (e.target === feedback) feedback.close();
  });

  checkValidity();
}

function errorTitle(code?: string): string {
  switch (code) {
    case "ALREADY_REGISTERED":
      return "Inscrição duplicada";
    case "QUOTA_FULL":
      return "Vagas esgotadas";
    case "NOT_OPEN_YET":
      return "Aguarde";
    case "EVENT_CLOSED":
      return "Evento encerrado";
    default:
      return "Atenção";
  }
}

function errorMessage(code?: string): string {
  switch (code) {
    case "ALREADY_REGISTERED":
      return "Este CPF já está inscrito em um evento desta campanha.";
    case "QUOTA_FULL":
      return "Desculpe, as vagas para este evento se esgotaram.";
    case "NOT_OPEN_YET":
      return "As inscrições para este evento ainda não abriram.";
    case "EVENT_CLOSED":
      return "As inscrições para este evento foram encerradas.";
    default:
      return "Não foi possível concluir a inscrição. Tente novamente.";
  }
}
