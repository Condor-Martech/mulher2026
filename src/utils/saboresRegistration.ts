import { registrationService } from "../services/registrationService";
import { track } from "../lib/track";

/**
 * Sabores de Inverno — wiring del bloque de eventos (Slice 2/3, canal SOCIAL):
 *  - Tabs por fecha (mostrar/ocultar paneles).
 *  - Abrir modal desde cada ticket (poblar datos + gate +18 por evento).
 *  - Validación, formateo, envío vía registrationService y feedback.
 * Self-contained: reusa solo la capa de datos (registrationService → RPC).
 */
export function initSaboresEvents() {
  // Evita doble binding si el script corre más de una vez por carga.
  if ((window as any).__saboresEventsInit) return;
  (window as any).__saboresEventsInit = true;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;

  // ─────────────────────────── Tabs por ciudad ──────────────────────────
  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>("[data-city-tab]"),
  );
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("[data-city-panel]"),
  );
  if (tabs.length) {
    const activate = (key: string) => {
      tabs.forEach((t) => {
        const on = t.dataset.cityTab === key;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((p) =>
        p.classList.toggle("hidden-panel", p.dataset.cityPanel !== key),
      );
    };
    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        if (t.dataset.cityTab) activate(t.dataset.cityTab);
      }),
    );
  }

  // ──────────────── Hint "deslize para ver mais" (carrusel) ───────────────
  // Se oculta en cuanto el usuario desliza cualquier panel horizontalmente.
  const hint = document.querySelector<HTMLElement>(".carousel-hint");
  if (hint) {
    const hideHint = () => hint.classList.add("is-hidden");
    document
      .querySelectorAll<HTMLElement>(".events-grid")
      .forEach((grid) =>
        grid.addEventListener("scroll", hideHint, { passive: true, once: true }),
      );
  }

  // ─────────────────────────── Modal de inscripción ──────────────────────
  const modal = $("sabores-modal") as HTMLDialogElement | null;
  const feedback = $("sabores-feedback") as HTMLDialogElement | null;
  const form = $("sabores-form") as HTMLFormElement | null;
  if (!modal || !form) return;

  const idInput = $("sabores-event-id") as HTMLInputElement | null;
  const temaInput = $("sabores-event-tema") as HTMLInputElement | null;
  const ageBlock = $("sabores-age-block");
  const ageInput = $("sabores-maioridade") as HTMLInputElement | null;
  const submitBtn = $("sabores-submit") as HTMLButtonElement | null;
  const submitText = $("sabores-submit-text");
  const spinner = $("sabores-spinner");

  const inputs = () =>
    Array.from(form.querySelectorAll<HTMLInputElement>("input[name]"));

  // Abrir modal desde un ticket.
  document
    .querySelectorAll<HTMLButtonElement>(".open-sabores-modal")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.dataset.eventId || "";
        const tema = btn.dataset.eventTema || "";
        if (idInput) idInput.value = id;
        if (temaInput) temaInput.value = tema;
        const titleEl = $("sabores-modal-title");
        if (titleEl) titleEl.textContent = tema || "Evento";
        const dateEl = $("sabores-modal-date");
        if (dateEl) dateEl.textContent = btn.dataset.eventDate || "";
        const cityEl = $("sabores-modal-city");
        if (cityEl)
          cityEl.textContent = [btn.dataset.eventCity, btn.dataset.eventLocation]
            .filter(Boolean)
            .join(" · ");

        // Gate +18 por evento.
        const requiresAge = btn.dataset.eventRequiresAge === "1";
        if (ageBlock && ageInput) {
          ageBlock.classList.toggle("hidden", !requiresAge);
          ageBlock.classList.toggle("flex", requiresAge);
          ageInput.required = requiresAge;
          if (!requiresAge) ageInput.checked = false;
        }

        resetValidation();
        checkValidity();
        track("event_modal_opened", { event_id: id });
        modal.showModal();
      });
    });

  // Cerrar.
  $("sabores-close")?.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
  modal.addEventListener("close", resetForm);

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
    if ((touched || el.type === "checkbox") && el.type !== "checkbox") {
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

  function resetValidation() {
    inputs().forEach((el) => {
      el.dataset.touched = "false";
      el.classList.remove("border-red-500");
    });
    form!
      .querySelectorAll(".sabores-error")
      .forEach((s) => s.classList.add("hidden"));
  }

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
        source: "social",
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
    track("registration_submitted", { event_id: eventId, source: "social" });

    try {
      const result = await registrationService.submitRegistration(
        data,
        "social",
      );
      if (!result.success) {
        track("registration_failed", {
          event_id: eventId,
          source: "social",
          error_type: result.error || "unknown",
        });
        showFeedback("warning", errorTitle(result.error), errorMessage(result.error));
        restoreSubmit();
        return;
      }
      track("registration_succeeded", { event_id: eventId, source: "social" });
      showFeedback(
        "success",
        "Inscrição confirmada!",
        "Sua inscrição foi realizada com sucesso. Te esperamos lá!",
      );
      form.reset();
      restoreSubmit("Concluído");
    } catch (err) {
      console.error("Sabores registration error:", err);
      track("registration_failed", {
        event_id: eventId,
        source: "social",
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

  function resetForm() {
    form!.reset();
    resetValidation();
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = "Confirmar inscrição";
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
    try {
      modal!.close();
    } catch {}
    setTimeout(() => feedback?.showModal(), 120);
  }
  $("sabores-feedback-ok")?.addEventListener("click", () => feedback?.close());
  $("sabores-feedback-close")?.addEventListener("click", () =>
    feedback?.close(),
  );
  feedback?.addEventListener("click", (e) => {
    if (e.target === feedback) feedback.close();
  });
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
