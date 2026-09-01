/**
 * Encontro de Sabores Condor — wiring do formulário de inscrição.
 *
 * Segue o padrão do repo: um `init*()` por campanha, self-contained, que reusa
 * só a camada de dados (registrationService → RPC). Mesmo desenho do
 * saboresRegistration.ts e do saboresCrmForm.ts.
 *
 * DUAS COISAS QUE NÃO ESTÃO AQUI, DE PROPÓSITO:
 *
 * 1. Quais aceites são obrigatórios. Cada edição do evento tem regras próprias,
 *    então isso vem de `formulario.aceites[].obrigatorio` no content.json, vira
 *    `required` no markup, e aqui o validador só obedece ao `required`. Mudar a
 *    exigência na próxima edição é subir o content.json ao Minio.
 *
 * 2. O texto das mensagens. Viaja no markup, em `data-erro` de cada campo e nos
 *    `data-erro-*` do <form>. Assim a cópia continua vindo do Minio e este
 *    bundle não carrega nenhuma string traduzível.
 *
 * DIFERENÇA DELIBERADA em relação ao utils/formHandler.ts compartilhado: aqui o
 * CPF é validado de verdade, com os dígitos verificadores. O do repo só confere
 * se há 11 dígitos, então aceita 00000000000. O briefing pede «validação de
 * CPF», e no Brasil isso quer dizer os dígitos.
 *
 * A validação do cliente é conveniência de UX. Quem decide de verdade é a RPC
 * `inscrever_participante`, que checa a cota dentro da transação: sem isso, dois
 * envios simultâneos com uma vaga livre entrariam os dois.
 */
import { registrationService } from "../services/registrationService";
import { track } from "../lib/track";

type Validador = (valor: string, el: HTMLInputElement) => boolean;

/** Dígitos verificadores do CPF. Rejeita também os onze dígitos repetidos,
 *  que passam no cálculo mas não são CPF válidos (000…, 111…, 999…). */
export function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Celular brasileiro: 10 ou 11 dígitos e DDD real (11–99, sem os não atribuídos). */
export function telefoneValido(valor: string): boolean {
  const tel = valor.replace(/\D/g, "");
  if (tel.length !== 10 && tel.length !== 11) return false;
  const ddd = Number(tel.slice(0, 2));
  const DDD_VALIDOS = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
    37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
    65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
    89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  ];
  if (!DDD_VALIDOS.includes(ddd)) return false;
  // Com 11 dígitos, o celular começa por 9.
  if (tel.length === 11 && tel[2] !== "9") return false;
  return true;
}

/**
 * Os checkboxes NÃO checam `el.checked` direto: checam `!el.required ||
 * el.checked`. É o mesmo critério do saboresRegistration.ts, e é o que permite
 * que um aceite deixe de ser obrigatório sem tocar neste arquivo.
 */
const VALIDADORES: Record<string, Validador> = {
  nome: (v) => v.trim().length > 2 && v.trim().includes(" "),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  cpf: (v) => cpfValido(v),
  telefone: (v) => telefoneValido(v),
  maioridade: (_v, el) => !el.required || el.checked,
  restricao: (_v, el) => !el.required || el.checked,
  lgpd: (_v, el) => !el.required || el.checked,
};

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Classifica o motivo que a RPC `inscrever_participante` devolve em
 * `{ success: false, error }`.
 *
 * A RPC responde com códigos em maiúsculas — `NOT_OPEN_YET` foi o primeiro
 * observado, ao testar antes da data de abertura. Não temos acesso ao corpo da
 * função, então casamos por trechos em vez de listar códigos exatos: um código
 * novo ainda cai numa categoria plausível em vez de virar o genérico «verifique
 * seus dados», que engana quando o problema não são os dados.
 *
 * A ordem importa: `NOT_OPEN_YET` é testado antes de tudo.
 */
type MotivoRecusa = 'nao_aberto' | 'esgotado' | 'cpf_duplicado' | 'erro_rpc';

function classificarRecusa(motivo: string): MotivoRecusa {
  const m = motivo.toUpperCase();
  if (/NOT_OPEN|NAO_ABERT|NOT_STARTED|BEFORE/.test(m)) return 'nao_aberto';
  if (/FULL|SOLD|ESGOTAD|LOTAD|NO_SLOT|SEM_VAGA|CAPACITY/.test(m)) return 'esgotado';
  if (/DUPLIC|ALREADY|CPF|EXISTS/.test(m)) return 'cpf_duplicado';
  return 'erro_rpc';
}

/**
 * Modal da LP web. Padrão do repo: <dialog> nativo, Esc fecha de graça e o
 * clique fora do quadro também (compara-se o ponto com o rect do diálogo,
 * porque o <dialog> ocupa a tela toda e o ::backdrop não recebe cliques).
 */
/**
 * Devolve o modal ao estado inicial ao ser reaberto.
 *
 * Depois de uma inscrição concluída o formulário fica escondido e o bloco de
 * sucesso visível. Sem isto, quem reabre o modal volta a ver «Inscrição
 * realizada com sucesso» em vez de um formulário — o mesmo ecrã de sempre,
 * como se nada tivesse acontecido.
 *
 * Se a inscrição anterior foi concluída, os campos são limpos: quem reabre é
 * outra pessoa. Se o modal foi fechado a meio, os valores ficam — quem estava
 * a preencher não quer recomeçar.
 */
function reiniciar(
  modal: HTMLDialogElement,
  form: HTMLFormElement | null,
): void {
  const sucesso = modal.querySelector<HTMLElement>("#form-sucesso");
  const aviso = modal.querySelector<HTMLElement>("#form-aviso");

  if (form && sucesso && !sucesso.hidden) {
    form.reset();
    for (const err of form.querySelectorAll<HTMLElement>('[id^="erro-"]')) {
      err.textContent = "";
    }
    for (const el of form.querySelectorAll<HTMLInputElement>("[name]")) {
      delete el.dataset.tocado;
      el.setAttribute("aria-invalid", "false");
    }
    sucesso.hidden = true;
    form.hidden = false;
  }

  if (aviso) {
    aviso.textContent = "";
    delete aviso.dataset.tipo;
  }
}

/**
 * Trava o scroll da página enquanto o modal está aberto.
 *
 * O <dialog> já bloqueia o CLIQUE no que está por trás, mas não o scroll: no
 * mobile o dedo continua a rolar a página de fundo e o formulário sai de
 * vista. O diálogo contém o gesto quando se chega ao seu próprio fim (ver a
 * classe de overscroll no ModalInscricao.astro); isto trata do resto.
 *
 * NÃO escrever aqui o nome dessa classe: este arquivo mora em `src/utils/`, que
 * as quatro folhas de estilo em produção varrem, e o Tailwind extrai nomes de
 * classe até de comentários. Escrevê-lo custou 48 bytes de CSS morto em maes,
 * mulher, pascoa e sabores — medido.
 */
function travarFundo(): void {
  document.body.dataset.overflowAnterior = document.body.style.overflow;
  document.body.style.overflow = "hidden";
}

function soltarFundo(): void {
  document.body.style.overflow = document.body.dataset.overflowAnterior ?? "";
  delete document.body.dataset.overflowAnterior;
}

export function montarModalInscricao(): void {
  const modal = document.querySelector<HTMLDialogElement>("#encontro-modal");
  if (!modal) return;

  // `close` cobre TODAS as saídas: o botão ×, o clique fora e o Esc — que o
  // <dialog> trata sozinho e não passa por nenhum handler nosso.
  modal.addEventListener("close", soltarFundo);

  for (const disparador of document.querySelectorAll<HTMLElement>(
    "[data-abre-inscricao]",
  )) {
    disparador.addEventListener("click", (ev) => {
      ev.preventDefault();
      const form = modal.querySelector<HTMLFormElement>("#form-inscricao");
      reiniciar(modal, form);
      modal.showModal();
      travarFundo();
      track("event_modal_opened", {
        event_id: form?.dataset.eventId ?? "",
        source: form?.dataset.source ?? "social",
      });
      modal.querySelector<HTMLInputElement>("input, button")?.focus();
    });
  }
  for (const fechar of modal.querySelectorAll<HTMLElement>(
    "[data-fecha-inscricao]",
  )) {
    fechar.addEventListener("click", () => modal.close());
  }
  modal.addEventListener("click", (ev) => {
    const r = modal.getBoundingClientRect();
    const fora =
      ev.clientX < r.left ||
      ev.clientX > r.right ||
      ev.clientY < r.top ||
      ev.clientY > r.bottom;
    if (fora) modal.close();
  });

  montarFormulario();
}

export function montarFormulario(): void {
  const form = document.querySelector<HTMLFormElement>("#form-inscricao");
  if (!form) return;

  const aviso = document.querySelector<HTMLElement>("#form-aviso");
  const botao = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const campos = [...form.querySelectorAll<HTMLInputElement>("[name]")];
  const d = form.dataset;
  const eventId = d.eventId ?? "";
  const source = d.source === "crm" ? "crm" : "social";
  let enviando = false;

  const erroDe = (el: HTMLInputElement) =>
    document.getElementById(`erro-${el.name}`);

  const validar = (el: HTMLInputElement, mostrar = true): boolean => {
    const fn = VALIDADORES[el.name];
    if (!fn) return true;
    const ok = fn(el.value, el);
    const err = erroDe(el);
    if (mostrar && err) {
      // A mensagem vem do próprio campo, renderizada pelo servidor a partir do
      // content.json. Nenhuma string mora neste arquivo.
      err.textContent = ok ? "" : (el.dataset.erro ?? "");
      el.setAttribute("aria-invalid", ok ? "false" : "true");
    }
    return ok;
  };

  for (const el of campos) {
    // Só avisa depois que o campo é abandonado pela primeira vez: marcar em
    // vermelho enquanto a primeira letra está sendo digitada é hostil.
    el.addEventListener("blur", () => {
      el.dataset.tocado = "true";
      validar(el);
    });
    el.addEventListener("input", () => {
      if (el.name === "cpf") el.value = mascaraCpf(el.value);
      if (el.name === "telefone") el.value = mascaraTelefone(el.value);
      if (el.dataset.tocado === "true") validar(el);
    });
    if (el.type === "checkbox")
      el.addEventListener("change", () => validar(el));
  }

  // Início do funil, uma única vez por carga.
  form.addEventListener(
    "focusin",
    () => track("registration_started", { event_id: eventId, source }),
    { once: true },
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (enviando) return; // envio duplo

    const invalidos = campos.filter((el) => !validar(el));
    if (invalidos.length) {
      invalidos[0].focus();
      if (aviso) {
        // Com UM único campo por corrigir, repetir a mensagem dele diz qual e
        // porquê; «verifique os campos destacados» não acrescenta nada, porque
        // o campo já está destacado e com o erro por baixo. Com vários campos
        // é o contrário: a genérica é a que resume.
        aviso.textContent =
          invalidos.length === 1
            ? (invalidos[0].dataset.erro ?? d.erroFormulario ?? "")
            : (d.erroFormulario ?? "");
        aviso.dataset.tipo = "erro";
      }
      return;
    }

    enviando = true;
    if (botao) {
      botao.disabled = true;
      botao.dataset.textoOriginal = botao.textContent ?? "";
      botao.textContent = d.enviando ?? "";
    }
    if (aviso) {
      aviso.textContent = "";
      delete aviso.dataset.tipo;
    }

    track("registration_submitted", { event_id: eventId, source });

    const dados = Object.fromEntries(new FormData(form).entries());
    try {
      // O canal é declarado pelo próprio formulário:
      //   a LP web   → social  (cota qtd_social, as 15 vagas da LP)
      //   o CRM      → crm     (cota qtd_crm, as outras 15)
      //
      // PENDÊNCIA CONHECIDA — os três aceites não chegam ao banco. O
      // registrationService monta um payload fixo (p_nome, p_email, p_cpf,
      // p_telefone, p_source, p_tema, p_nome_filho, p_cpf_filho,
      // p_maioridade_filho) e `maioridade`, `restricao` e `lgpd` não estão
      // nele. Não é específico desta campanha: o sabores também coleta `lgpd`
      // como obrigatório e o perde do mesmo jeito. Resolver mexe no serviço
      // compartilhado e na RPC, então é decisão de projeto, não desta LP.
      const res = await registrationService.submitRegistration(
        { ...dados, eventId },
        source,
      );
      if (res.success) {
        track("registration_succeeded", { event_id: eventId, source });
        form.hidden = true;
        const sucesso = document.querySelector<HTMLElement>("#form-sucesso");
        if (sucesso) {
          sucesso.hidden = false;
          sucesso.focus();
        }
        return;
      }
      // Erros de negócio que a RPC devolve.
      // O motivo TEM que aparecer no console: sem isto uma recusa que não case
      // com nenhum padrão vira a mensagem genérica sem deixar rasto — foi
      // exatamente o que aconteceu ao testar, e custou uma ida e volta.
      console.error("[Encontro] RPC recusou a inscrição:", res);
      const motivo = classificarRecusa(String(res.error ?? ""));
      track("registration_failed", { event_id: eventId, source, reason: motivo });
      if (motivo === "esgotado") {
        track("vagas_esgotadas_viewed", { event_id: eventId, source });
      }
      if (aviso) {
        aviso.textContent =
          motivo === "nao_aberto"
            ? (d.erroNaoAberto ?? "")
            : motivo === "esgotado"
              ? (d.erroEsgotado ?? "")
              : motivo === "cpf_duplicado"
                ? (d.erroCpfDuplicado ?? "")
                : (d.erroEnvio ?? "");
        aviso.dataset.tipo = "erro";
      }
    } catch (err) {
      console.error("[Encontro] Exceção ao enviar a inscrição:", err);
      track("registration_failed", {
        event_id: eventId,
        source,
        reason: "excecao",
      });
      if (aviso) {
        aviso.textContent = d.erroEnvio ?? "";
        aviso.dataset.tipo = "erro";
      }
    } finally {
      enviando = false;
      if (botao) {
        botao.disabled = false;
        botao.textContent = botao.dataset.textoOriginal || (d.enviar ?? "");
      }
    }
  });
}
