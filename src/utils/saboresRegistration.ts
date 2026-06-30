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
      panels.forEach((p) => {
        const hidden = p.dataset.cityPanel !== key;
        p.classList.toggle("hidden-panel", hidden);
        if (!hidden) {
          // El panel recién mostrado: volver al inicio y recalcular flechas
          // (sus medidas eran 0 mientras estaba en display:none).
          const track = p.querySelector<HTMLElement>("[data-events-track]");
          if (track) track.scrollLeft = 0;
          (p as any).__refreshArrows?.();
        }
      });
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

  // ─────────────────────── Flechas de navegación (carrusel) ───────────────
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  document.querySelectorAll<HTMLElement>("[data-city-panel]").forEach((panel) => {
    const track = panel.querySelector<HTMLElement>("[data-events-track]");
    // Flechas de escritorio (superpuestas) + flechas mobile (barra inferior).
    const prevs = panel.querySelectorAll<HTMLButtonElement>(
      ".carousel-prev, .carousel-prev-m",
    );
    const nexts = panel.querySelectorAll<HTMLButtonElement>(
      ".carousel-next, .carousel-next-m",
    );
    if (!track || !prevs.length || !nexts.length) return;

    const controls = panel.querySelector<HTMLElement>(".carousel-controls");
    const dotsWrap = panel.querySelector<HTMLElement>("[data-dots]");
    const cards = Array.from(track.children) as HTMLElement[];

    // Un punto por card (solo-mobile). Click → ir a esa card.
    if (dotsWrap) {
      cards.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Ir para edição ${i + 1}`);
        dot.addEventListener("click", () =>
          track.scrollTo({
            left: cards[i].offsetLeft,
            behavior: prefersReduced ? "auto" : "smooth",
          }),
        );
        dotsWrap.appendChild(dot);
      });
    }
    const dots = dotsWrap
      ? (Array.from(dotsWrap.children) as HTMLElement[])
      : [];

    // Estado de las flechas/puntos según la posición de scroll. Si no hay
    // overflow (≤ las que caben) las flechas quedan disabled → ocultas vía CSS
    // y la barra mobile se esconde por completo.
    const refresh = () => {
      const max = track.scrollWidth - track.clientWidth;
      const overflowing = max > 4; // tolerancia en px
      const x = track.scrollLeft;
      prevs.forEach((b) => (b.disabled = !overflowing || x <= 1));
      nexts.forEach((b) => (b.disabled = !overflowing || x >= max - 1));
      controls?.classList.toggle("is-hidden", !overflowing);
      if (dots.length) {
        let active = 0;
        let best = Infinity;
        cards.forEach((c, i) => {
          const d = Math.abs(c.offsetLeft - x);
          if (d < best) {
            best = d;
            active = i;
          }
        });
        dots.forEach((d, i) => d.classList.toggle("active", i === active));
      }
    };

    const page = (dir: number) => {
      const amount = Math.round(track.clientWidth * 0.85) * dir;
      track.scrollBy({ left: amount, behavior: prefersReduced ? "auto" : "smooth" });
    };

    prevs.forEach((b) => b.addEventListener("click", () => page(-1)));
    nexts.forEach((b) => b.addEventListener("click", () => page(1)));
    track.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    refresh();

    // Expuesto para refrescar al activar el panel (ver tabs).
    (panel as any).__refreshArrows = refresh;
  });

  // ─────────────────────────── Modal de inscripción ──────────────────────
  const modal = $("sabores-modal") as HTMLDialogElement | null;
  const feedback = $("sabores-feedback") as HTMLDialogElement | null;
  const form = $("sabores-form") as HTMLFormElement | null;
  if (!modal || !form) return;

  const idInput = $("sabores-event-id") as HTMLInputElement | null;
  const temaInput = $("sabores-event-tema") as HTMLInputElement | null;
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
        const place = [btn.dataset.eventCity, btn.dataset.eventLocation]
          .filter(Boolean)
          .join(" · ");
        const cityEl = $("sabores-modal-city");
        if (cityEl) cityEl.textContent = place;
        // "Local" como link a Google Maps si el evento trae mapsUrl; si no, texto plano.
        const mapEl = $("sabores-modal-map") as HTMLAnchorElement | null;
        const cityPlainEl = $("sabores-modal-city-plain");
        const mapsUrl = btn.dataset.eventMapsUrl || "";
        if (mapEl && cityPlainEl) {
          if (mapsUrl) {
            mapEl.href = mapsUrl;
            mapEl.setAttribute("aria-label", `Ver ${place} no Google Maps`);
            mapEl.classList.remove("hidden");
            mapEl.classList.add("flex");
            cityPlainEl.classList.add("hidden");
          } else {
            cityPlainEl.textContent = place;
            cityPlainEl.classList.remove("hidden");
            mapEl.classList.add("hidden");
            mapEl.classList.remove("flex");
          }
        }
        const palNameEl = $("sabores-modal-palestrante-name");
        const pal = btn.dataset.eventPalestrante || "";
        if (palNameEl) palNameEl.textContent = pal;
        $("sabores-modal-palestrante")?.classList.toggle("hidden", !pal);

        // +18 obrigatório em todos os eventos: o checkbox já é `required` no markup.
        resetValidation();
        checkValidity();
        track("event_modal_opened", { event_id: id });
        modal.showModal();
        // Bloquear el scroll de la página de fondo mientras el modal está abierto
        // (evita el "scroll detrás" en laptops de pantalla baja).
        document.documentElement.classList.add("modal-open");
      });
    });

  // Cerrar.
  $("sabores-close")?.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
  // Se dispara con cualquier cierre (botón, clic fuera, Escape) → restaura scroll.
  modal.addEventListener("close", () => {
    document.documentElement.classList.remove("modal-open");
    resetForm();
  });

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
    setTimeout(() => {
      feedback?.showModal();
      // Mantener el scroll bloqueado también con el feedback abierto (el close
      // del modal anterior lo había quitado).
      document.documentElement.classList.add("modal-open");
    }, 120);
  }
  $("sabores-feedback-ok")?.addEventListener("click", () => feedback?.close());
  $("sabores-feedback-close")?.addEventListener("click", () =>
    feedback?.close(),
  );
  feedback?.addEventListener("click", (e) => {
    if (e.target === feedback) feedback.close();
  });
  // Restaurar scroll cuando el feedback se cierra (cualquier vía).
  feedback?.addEventListener("close", () => {
    document.documentElement.classList.remove("modal-open");
  });
}

function errorTitle(code?: string): string {
  switch (code) {
    case "ALREADY_REGISTERED":
      return "CPF já cadastrado no evento";
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
