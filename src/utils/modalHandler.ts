export function initModalHandler() {
  const modal = document.getElementById("event-modal") as HTMLDialogElement;
  const closeBtn = document.getElementById("close-modal-btn");

  if (modal && closeBtn) {
    // Fechar pelo botão
    closeBtn.addEventListener("click", () => {
      modal.close();
    });

    // Fechar clicando fora do modal (no backdrop)
    modal.addEventListener("click", (e) => {
      const dialogDimensions = modal.getBoundingClientRect();
      if (
        e.clientX < dialogDimensions.left ||
        e.clientX > dialogDimensions.right ||
        e.clientY < dialogDimensions.top ||
        e.clientY > dialogDimensions.bottom
      ) {
        modal.close();
      }
    });

    // Resetar formulario ao fechar o modal
    modal.addEventListener("close", () => {
      const form = document.getElementById(
        "event-registration-form",
      ) as HTMLFormElement;
      const submitBtn = document.getElementById(
        "submit-registration-btn",
      ) as HTMLButtonElement;
      const feedback = document.getElementById("form-feedback");
      const btnText = document.getElementById("submit-text");

      if (form) form.reset();

      // Reset validation states
      if (form) {
        const inputs = form.querySelectorAll("input[required]");
        inputs.forEach((input) => {
          (input as HTMLInputElement).dataset.touched = "false";
          const el = input as HTMLInputElement;
          el.classList.remove("border-red-500", "focus:ring-red-500");
          el.classList.add(
            "border-primary/20",
            "focus:ring-primary/50",
            "focus:border-primary",
          );

          const errorMsg = el.parentElement?.querySelector(".error-message");
          if (errorMsg) errorMsg.classList.add("hidden");
        });
      }

      if (submitBtn) submitBtn.disabled = true;

      // Limpia clases del feedback
      if (feedback) {
        feedback.classList.add("hidden");
        feedback.className =
          "hidden text-center mt-4 font-medium rounded-xl p-4 transition-all duration-300";
        feedback.textContent = "";
      }

      if (btnText) btnText.textContent = "Confirmar Inscrição";
    });
  }
}

export function initEventGridModal() {
  const openBtns = document.querySelectorAll(".open-event-modal-btn");
  const modal = document.getElementById("event-modal") as HTMLDialogElement;

  if (modal) {
    const titleEl = document.getElementById("modal-event-title");
    const dateEl = document.getElementById("modal-event-date");
    const idInput = document.getElementById(
      "modal-event-id",
    ) as HTMLInputElement;
    const temaInput = document.getElementById(
      "modal-event-tema",
    ) as HTMLInputElement;

    openBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-event-id");
        const tema = btn.getAttribute("data-event-tema");
        const dateText = btn.getAttribute("data-event-date");

        if (titleEl) titleEl.textContent = `Tema: ${tema || "A Definir"}`;
        if (dateEl) dateEl.textContent = `Data: ${dateText || ""}`;
        if (idInput) idInput.value = id || "";
        if (temaInput) temaInput.value = tema || "";

        modal.showModal();
      });
    });
  }
}
